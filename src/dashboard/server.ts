import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Clanky } from '../client/Clanky.js';
import { env, isDev } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { DiscordHttpError } from './discord.js';
import { attachSession, AuthError, authRoutes, cookieSecret, loginEnabled } from './auth.js';
import { guildRoutes } from './routes/guilds.js';
import { meRoutes } from './routes/me.js';
import { publicRoutes } from './routes/public.js';
import { dashboardVersion } from './version.js';

const log = createLogger('dashboard');
const DIST = fileURLToPath(new URL('../../dashboard/dist/', import.meta.url));

/**
 * The dashboard runs inside the bot process: same Discord client, same
 * database connection, same settings service. Changes apply instantly
 * because the bot and the dashboard share one cache.
 */
export async function createDashboard(client: Clanky): Promise<FastifyInstance> {
  const app = Fastify({ trustProxy: env.DASHBOARD_TRUST_PROXY, logger: false, bodyLimit: 256 * 1024 });
  for (const contentType of ['image/png', 'image/jpeg', 'image/webp']) {
    app.addContentTypeParser(contentType, { parseAs: 'buffer', bodyLimit: 4 * 1024 * 1024 }, (_request, body, done) => done(null, body));
  }

  await app.register(cookie, { secret: cookieSecret });
  await app.register(rateLimit, { global: false });

  // Mutating API calls must carry this header. Browsers can't add it
  // cross-site without CORS, so it blocks CSRF together with SameSite cookies.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers['x-clanky'] !== '1') {
      return reply.code(403).send({ error: 'csrf', message: 'Missing request header.' });
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError || (error instanceof DiscordHttpError && error.status === 401)) return reply.code(401).send({ error: 'unauthorized', message: 'Please log in again.' });
    if (error instanceof ZodError) return reply.code(400).send({ error: 'invalid', message: 'Some values are not valid.' });
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) log.error(`${request.method} ${request.url} failed`, error);
    return reply.code(status).send({ error: 'server', message: status >= 500 ? 'Something went wrong.' : (error as Error).message });
  });

  app.decorateRequest('session', null);
  app.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/')) await attachSession(request);
  });
  await app.register(authRoutes);
  await app.register(async (scope) => publicRoutes(scope, client));
  await app.register(async (scope) => meRoutes(scope, client));
  await app.register(async (scope) => guildRoutes(scope, client));

  if (existsSync(DIST)) {
    await app.register(fastifyStatic, { root: DIST, wildcard: false, maxAge: isDev ? 0 : '1h' });
    // Single page app: every non-API route serves index.html.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
      return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
    });
  } else {
    log.warn('dashboard/dist not found. Run `npm run dashboard:build` to serve the website (the API still works).');
  }

  return app;
}

export async function startDashboard(client: Clanky): Promise<FastifyInstance | null> {
  if (!env.DASHBOARD_ENABLED) return null;
  const app = await createDashboard(client);
  await app.listen({ port: env.DASHBOARD_PORT, host: env.DASHBOARD_HOST });
  log.info(`Dashboard ${dashboardVersion.label} running at ${env.DASHBOARD_URL}${loginEnabled ? '' : ' (login off: set DISCORD_CLIENT_SECRET)'}`);
  return app;
}
