import { cn } from '@/lib/utils';

/** Clanky's mark: a hex bolt head with two glowing eyes. */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn('shrink-0', className)} role="img" aria-label="Clanky">
      <defs>
        <linearGradient id="clanky-rust" x1="10" y1="6" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F9A170" />
          <stop offset=".45" stopColor="#E2702F" />
          <stop offset="1" stopColor="#96401A" />
        </linearGradient>
        <radialGradient id="clanky-eye" cx=".5" cy=".4" r=".7">
          <stop stopColor="#FFF1C9" />
          <stop offset="1" stopColor="#FFB547" />
        </radialGradient>
      </defs>
      <path d="M32 3.5 57 18v28L32 60.5 7 46V18Z" fill="url(#clanky-rust)" />
      <path d="M32 3.5 57 18v28L32 60.5 7 46V18Z" stroke="#FFD9BF" strokeOpacity=".45" strokeWidth="1.2" />
      <path d="M32 3.5 57 18 32 32Z" fill="#fff" fillOpacity=".1" />
      <circle cx="32" cy="32" r="18.5" fill="#160f0c" fillOpacity=".6" />
      <circle cx="32" cy="32" r="18.5" stroke="#FFD9BF" strokeOpacity=".18" />
      <g className={animated ? 'origin-center animate-[blink_5s_ease-in-out_infinite]' : undefined} style={{ transformBox: 'fill-box' }}>
        <rect x="21" y="25" width="8" height="12" rx="4" fill="url(#clanky-eye)" />
        <rect x="35" y="25" width="8" height="12" rx="4" fill="url(#clanky-eye)" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="size-8" animated />
      <span className="font-display text-[22px] font-extrabold tracking-tight">Clanky</span>
    </span>
  );
}
