/** A hex bolt, seen from above. Decorative. */
export function Bolt({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden fill="none">
      <defs>
        <linearGradient id="bolt-steel" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e3e9ee" />
          <stop offset=".5" stopColor="#9aa6b2" />
          <stop offset="1" stopColor="#4d5863" />
        </linearGradient>
      </defs>
      <path d="M32 4 56 18v28L32 60 8 46V18Z" fill="url(#bolt-steel)" />
      <path d="M32 4 56 18v28L32 60 8 46V18Z" stroke="#fff" strokeOpacity=".35" />
      <circle cx="32" cy="32" r="13" fill="#2b3036" fillOpacity=".55" />
      <circle cx="32" cy="32" r="13" stroke="#fff" strokeOpacity=".2" />
      <path d="M22 26c6-3 14-3 20 0" stroke="#fff" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A rusty variant with orange patina. */
export function RustyBolt({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden fill="none">
      <defs>
        <linearGradient id="bolt-rust" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f9a170" />
          <stop offset=".55" stopColor="#b5541f" />
          <stop offset="1" stopColor="#5e2a12" />
        </linearGradient>
      </defs>
      <path d="M32 4 56 18v28L32 60 8 46V18Z" fill="url(#bolt-rust)" />
      <path d="M32 4 56 18v28L32 60 8 46V18Z" stroke="#ffd2b0" strokeOpacity=".3" />
      <circle cx="32" cy="32" r="13" fill="#2a160c" fillOpacity=".5" />
      <circle cx="20" cy="22" r="3" fill="#7a3415" fillOpacity=".7" />
      <circle cx="44" cy="44" r="4" fill="#7a3415" fillOpacity=".6" />
    </svg>
  );
}
