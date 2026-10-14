const store = new Map<string, number>();

/** Returns remaining cooldown in ms, or 0 and starts the cooldown. */
export function useCooldown(key: string, seconds: number): number {
  const now = Date.now();
  const until = store.get(key) ?? 0;
  if (until > now) return until - now;
  store.set(key, now + seconds * 1000);
  return 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, until] of store) if (until <= now) store.delete(key);
}, 60_000).unref();
