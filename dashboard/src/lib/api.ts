import { QueryClient } from '@tanstack/react-query';
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
