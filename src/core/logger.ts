const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

let threshold: number = LEVELS.info;

export function setLogLevel(level: Level): void {
  threshold = LEVELS[level];
}

function write(level: Level, scope: string, message: string, extra: unknown[]): void {
  if (LEVELS[level] < threshold) return;
  const time = new Date().toISOString().slice(11, 19);
  const line = `${COLORS[level]}${time} ${level.toUpperCase().padEnd(5)}${RESET} \x1b[35m[${scope}]${RESET} ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(line, ...extra);
}

export interface Logger {
  debug(message: string, ...extra: unknown[]): void;
  info(message: string, ...extra: unknown[]): void;
  warn(message: string, ...extra: unknown[]): void;
  error(message: string, ...extra: unknown[]): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, ...e) => write('debug', scope, m, e),
    info: (m, ...e) => write('info', scope, m, e),
    warn: (m, ...e) => write('warn', scope, m, e),
    error: (m, ...e) => write('error', scope, m, e),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

export const logger = createLogger('clanky');
