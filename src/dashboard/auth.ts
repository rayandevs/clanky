import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { DashboardSessionModel, type DashboardSessionRecord } from '../database/models/index.js';
import { discordApi, refreshTokens, type OAuthTokens } from './discord.js';

const log = createLogger('dashboard');

export const SESSION_COOKIE = 'clanky_sid';
const STATE_COOKIE = 'clanky_oauth';
const SESSION_DAYS = 14;
export const SCOPES = ['identify', 'guilds'];

/* ───────────────────────── Encryption ───────────────────────── */

const secret =
  env.DASHBOARD_SESSION_SECRET ??
  (() => {
    log.warn('DASHBOARD_SESSION_SECRET is not set. Using a random one, so logins reset on every restart.');
    return randomBytes(48).toString('base64url');
  })();

const key = createHash('sha256').update(`clanky:${secret}`).digest();
export const cookieSecret = createHash('sha256').update(`clanky-cookie:${secret}`).digest('base64url');

function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

function decrypt<T>(payload: string): T | null {
  try {
    const [iv, tag, data] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv!);
    decipher.setAuthTag(tag!);
    return JSON.parse(Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8')) as T;
  } catch {
    return null;
  }
}

const hashSid = (sid: string) => createHash('sha256').update(sid).digest('hex');

/* ───────────────────────── Sessions ───────────────────────── */

export interface Session {
  record: DashboardSessionRecord;
  /** Fresh access token (refreshed when needed). */
  accessToken: () => Promise<string>;
}

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
  }
}

const secureCookies = env.DASHBOARD_URL.startsWith('https://');
const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: secureCookies, signed: true };

async function loadSession(request: FastifyRequest): Promise<Session | null> {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  const sid = hashSid(unsigned.value);
  const record = await DashboardSessionModel.findOne({ sid, expiresAt: { $gt: new Date() } }).lean<DashboardSessionRecord>();
  if (!record) return null;

  let cached: OAuthTokens | null = decrypt<OAuthTokens>(record.tokens);
  return {
    record,
    accessToken: async () => {
      if (!cached) throw new AuthError();
      if (record.tokenExpiresAt.getTime() - Date.now() > 60_000) return cached.access_token;
      // Token is about to expire: refresh it once and save.
      const next = await refreshTokens(cached.refresh_token).catch(() => null);
      if (!next) throw new AuthError();
      cached = next;
      record.tokenExpiresAt = new Date(Date.now() + next.expires_in * 1000);
      await DashboardSessionModel.updateOne({ sid }, { $set: { tokens: encrypt(next), tokenExpiresAt: record.tokenExpiresAt } });
      return next.access_token;
    },
  };
}

export class AuthError extends Error {
  constructor() {
    super('Not logged in');
  }
}

/** Use as a preHandler on routes that need a logged-in user. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session) return reply.code(401).send({ error: 'unauthorized', message: 'Please log in first.' });
}

/* ───────────────────────── OAuth routes ───────────────────────── */

export const loginEnabled = Boolean(env.DISCORD_CLIENT_SECRET);
const redirectUri = `${env.DASHBOARD_URL}/api/auth/callback`;

/** Only allow redirects back into the dashboard itself. */
const safeNext = (value: unknown) => (typeof value === 'string' && /^\/(?!\/)[\w\-/#?=&.%]*$/.test(value) ? value : '/dashboard');

/** Root-level hook (registered in server.ts so every route sees the session). */
export async function attachSession(request: FastifyRequest) {
  request.session = await loadSession(request).catch((error) => {
    log.warn('Could not load session', error);
    return null;
  });
}

export async function authRoutes(app: FastifyInstance) {

  app.get('/api/auth/login', async (request, reply) => {
    if (!loginEnabled) return reply.redirect('/?login=disabled');
    const state = randomBytes(24).toString('base64url');
    const next = safeNext((request.query as { next?: string }).next);
    reply.setCookie(STATE_COOKIE, `${state}|${next}`, { ...cookieOptions, maxAge: 600 });
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
      prompt: 'none',
    }).toString();
    return reply.redirect(url.toString());
  });

  app.get('/api/auth/callback', async (request, reply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };
    const stored = request.cookies[STATE_COOKIE] ? request.unsignCookie(request.cookies[STATE_COOKIE]) : null;
    reply.clearCookie(STATE_COOKIE, { path: '/' });
    if (error || !code || !state || !stored?.valid || !stored.value) return reply.redirect('/?login=failed');

    const [expected, next] = stored.value.split('|');
    const a = Buffer.from(state);
    const b = Buffer.from(expected ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return reply.redirect('/?login=failed');

    try {
      const tokens = await discordApi.exchangeCode(code, redirectUri);
      const user = await discordApi.me(tokens.access_token);
      const sid = randomBytes(32).toString('base64url');
      await DashboardSessionModel.create({
        sid: hashSid(sid),
        userId: user.id,
        username: user.username,
        globalName: user.global_name,
        avatar: user.avatar,
        tokens: encrypt(tokens),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      });
      reply.setCookie(SESSION_COOKIE, sid, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400 });
      log.info(`${user.username} logged in to the dashboard`);
      return reply.redirect(safeNext(next));
    } catch (err) {
      log.warn('Login failed', err);
      return reply.redirect('/?login=failed');
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.session) await DashboardSessionModel.deleteOne({ sid: request.session.record.sid });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}

export async function endAllSessions(userId: string) {
  await DashboardSessionModel.deleteMany({ userId });
}
