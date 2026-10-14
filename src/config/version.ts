import { readFileSync } from 'node:fs';

/**
 * Bot version system.
 *
 * The single source of truth is the "version" field in package.json, written
 * as SemVer with an optional pre-release channel, e.g. `0.1.0-beta.1`.
 * Bump it with `npm run release:beta` and add a matching entry to
 * `changelog.ts`. On startup Clanky compares the running version with what
 * each server last saw and posts "What's new" where admins opted in.
 */

export type ReleaseChannel = 'alpha' | 'beta' | 'rc' | 'stable';

export interface BotVersion {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  channel: ReleaseChannel;
  build: number;
  /** Human label, e.g. "v0.1.0 Beta 1" */
  label: string;
  /** Short label, e.g. "0.1.0-beta.1" */
  short: string;
  codename: string;
}

const CHANNEL_NAMES: Record<ReleaseChannel, string> = {
  alpha: 'Alpha',
  beta: 'Beta',
  rc: 'Release Candidate',
  stable: '',
};

const CODENAMES: Record<string, string> = {
  '0.1': 'Spark',
};

export function parseVersion(raw: string): BotVersion {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(raw);
  if (!match) throw new Error(`Invalid version "${raw}". Expected e.g. 0.1.0-beta.1`);
  const [, major, minor, patch, channel = 'stable', build = '0'] = match;
  const ch = channel as ReleaseChannel;
  const base = `v${major}.${minor}.${patch}`;
  return {
    raw,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    channel: ch,
    build: Number(build),
    label: ch === 'stable' ? base : `${base} ${CHANNEL_NAMES[ch]} ${build}`,
    short: raw,
    codename: CODENAMES[`${major}.${minor}`] ?? 'Unnamed',
  };
}

const CHANNEL_ORDER: Record<ReleaseChannel, number> = { alpha: 0, beta: 1, rc: 2, stable: 3 };

/** Returns <0 if a is older than b, 0 if equal, >0 if newer. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  return (
    va.major - vb.major ||
    va.minor - vb.minor ||
    va.patch - vb.patch ||
    CHANNEL_ORDER[va.channel] - CHANNEL_ORDER[vb.channel] ||
    va.build - vb.build
  );
}

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export const version: BotVersion = parseVersion(pkg.version);
