const UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const ALIASES: Record<string, string> = {
  sec: 's', secs: 's', second: 's', seconds: 's',
  min: 'm', mins: 'm', minute: 'm', minutes: 'm',
  hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  day: 'd', days: 'd',
  week: 'w', weeks: 'w',
};

/** Parses "1h30m", "2 days", "45s" into milliseconds. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const clean = input.trim().toLowerCase();
  const pattern = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;
  let total = 0;
  let matched = '';
  for (const match of clean.matchAll(pattern)) {
    const unit = ALIASES[match[2]!] ?? match[2]!;
    const size = UNITS[unit];
    if (!size) return null;
    total += Number(match[1]) * size;
    matched += match[0];
  }
  if (!total || matched.replace(/\s/g, '') !== clean.replace(/\s/g, '')) return null;
  return Math.round(total);
}

/** Formats milliseconds as "1d 2h 5m". */
export function formatDuration(ms: number): string {
  const parts: string[] = [];
  let rest = Math.max(0, Math.round(ms / 1000));
  for (const [unit, seconds] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]] as const) {
    const value = Math.floor(rest / seconds);
    if (value) parts.push(`${value}${unit}`);
    rest %= seconds;
  }
  return parts.slice(0, 3).join(' ') || '0s';
}

/** Discord timestamp markdown, shown in each user's own timezone. */
export function timestamp(date: Date | number, style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f'): string {
  const ms = typeof date === 'number' ? date : date.getTime();
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}
