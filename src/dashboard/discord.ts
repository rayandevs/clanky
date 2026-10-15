import { env } from '../config/env.js';

/**
 * Minimal Discord REST calls made with the *user's* OAuth2 token.
 * Everything else uses the bot's own gateway cache.
 */

const API = 'https://discord.com/api/v10';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OAuthUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface OAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export class DiscordHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new DiscordHttpError(response.status, `Discord ${path} failed with ${response.status}`);
  return (await response.json()) as T;
}

function tokenRequest(body: Record<string, string>) {
  return call<OAuthTokens>('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET ?? '', ...body }),
  });
}

export const refreshTokens = (refreshToken: string) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

/** Short cache so page loads don't hit Discord's strict guild list rate limit. */
const guildCache = new Map<string, { at: number; guilds: OAuthGuild[] }>();

export const discordApi = {
  exchangeCode: (code: string, redirectUri: string) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  me: (token: string) => call<OAuthUser>('/users/@me', { headers: { Authorization: `Bearer ${token}` } }),
  async guilds(userId: string, token: string, fresh = false): Promise<OAuthGuild[]> {
    const hit = guildCache.get(userId);
    if (hit && !fresh && Date.now() - hit.at < 60_000) return hit.guilds;
    const guilds = await call<OAuthGuild[]>('/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` } });
    guildCache.set(userId, { at: Date.now(), guilds });
    return guilds;
  },
  forget(userId: string) {
    guildCache.delete(userId);
  },
};
