/**
 * Custom IDs follow `prefix:action:arg1:arg2`. The prefix routes the
 * interaction to a component handler; the rest is passed as args.
 */
const SEPARATOR = ':';

export function cid(...parts: Array<string | number | boolean>): string {
  const id = parts.map(String).join(SEPARATOR);
  if (id.length > 100) throw new RangeError(`Custom ID too long (${id.length}/100): ${id}`);
  return id;
}

export function parseCid(customId: string): { prefix: string; args: string[] } {
  const [prefix = '', ...args] = customId.split(SEPARATOR);
  return { prefix, args };
}
