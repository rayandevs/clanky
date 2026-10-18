import { QueryClient } from '@tanstack/react-query';
import type { WelcomeEvent } from './types';
import { DEMO } from './utils';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Talks to the bot's API. In demo builds, a local mock answers instead. */
export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (DEMO) {
    const { demoApi } = await import('./demo');
    return demoApi<T>(method, path, body);
  }
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-Clanky': '1' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  // Session ended somewhere else: refresh the login state so the gate shows.
  if (response.status === 401 && path !== '/api/me') void queryClient.invalidateQueries({ queryKey: ['/api/me'] });
  if (!response.ok) throw new ApiError(response.status, data.message ?? 'Something went wrong.', data.error);
  return data as T;
}

export const get = <T,>(path: string) => api<T>('GET', path);

/** Upload an artwork image as raw bytes; demo mode simulates the write. */
async function uploadArtwork(path: string, file: File): Promise<{ ok: true; width?: number; height?: number }> {
  if (DEMO) {
    const { demoApi } = await import('./demo');
    return demoApi('POST', path, { name: file.name, contentType: file.type, size: file.size }) as Promise<{ ok: true; width?: number; height?: number }>;
  }
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': file.type, 'X-Clanky': '1' },
    body: file,
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string; width?: number; height?: number };
  if (response.status === 401) void queryClient.invalidateQueries({ queryKey: ['/api/me'] });
  if (!response.ok) throw new ApiError(response.status, data.message ?? 'Could not upload that image.', data.error);
  return data as { ok: true; width?: number; height?: number };
}

export const uploadTicketArtwork = (guildId: string, panelId: string, file: File) => uploadArtwork(`/api/guilds/${guildId}/tickets/panels/${panelId}/artwork`, file);
export const uploadWelcomeArtwork = (guildId: string, event: WelcomeEvent, file: File) => uploadArtwork(`/api/guilds/${guildId}/welcome/${event}/artwork`, file);

/** URL of the most recently uploaded welcome-card background for an event. */
export const welcomeArtworkUrl = (guildId: string, event: WelcomeEvent, version = 0) => `/api/guilds/${guildId}/welcome/${event}/artwork?v=${version}`;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => get(queryKey.join('/')),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 2,
    },
  },
});

export const loginUrl = (next = '/dashboard') => `/api/auth/login?next=${encodeURIComponent(next)}`;

/** URL of a Salvage image card (the same image the bot sends). */
export function cardUrl(kind: 'profile' | 'bag' | 'collection', params: { page?: number; zone?: string; v?: number } = {}) {
  if (DEMO) return `./demo/${kind}${kind === 'collection' ? `-${params.zone ?? 'scrapyard'}` : ''}.png`;
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.zone) q.set('zone', params.zone);
  q.set('v', String(params.v ?? 0));
  return `/api/me/salvage/card/${kind}?${q}`;
}
