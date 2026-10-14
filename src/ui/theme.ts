export const colors = {
  brand: 0x7c5cff,
  success: 0x3ba55d,
  error: 0xed4245,
  warning: 0xfaa61a,
  info: 0x5865f2,
  muted: 0x4f545c,
} as const;

export function hexToInt(hex: string): number | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return Number.parseInt(clean, 16);
}

export function intToHex(value: number): string {
  return `#${value.toString(16).padStart(6, '0').toUpperCase()}`;
}
