import { readFileSync } from 'node:fs';
import { parseVersion, type BotVersion } from '../config/version.js';

/**
 * Dashboard version system. Separate from the bot's version.
 *
 * Source of truth: the "version" in dashboard/package.json, e.g.
 * `0.1.0-beta.1`. Bump it with `npm run dashboard:release` and add a
 * matching entry to dashboard/changelog.json. Git tags use the
 * `dashboard-v` prefix so they never clash with bot tags (`v…`).
 */

export interface DashboardRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

const root = new URL('../../dashboard/', import.meta.url);

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(new URL(file, root), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const CODENAMES: Record<string, string> = { '0.1': 'Rench' };

const pkg = readJson<{ version: string }>('package.json', { version: '0.0.0-alpha.0' });
const parsed = parseVersion(pkg.version);

export const dashboardVersion: BotVersion = {
  ...parsed,
  codename: CODENAMES[`${parsed.major}.${parsed.minor}`] ?? 'Unnamed',
};

export const dashboardChangelog: DashboardRelease[] = readJson<DashboardRelease[]>('changelog.json', []);
