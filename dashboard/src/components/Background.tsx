/**
 * Static scrapyard-at-night color behind the dashboard. Keeping this as a
 * fixed CSS background avoids scroll-linked React updates, huge blurred layers
 * and full-viewport SVG filter repaints.
 */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse at 12% 8%, rgb(194 87 29 / 0.18), transparent 42%)',
            'radial-gradient(ellipse at 88% 34%, rgb(58 107 124 / 0.13), transparent 43%)',
            'radial-gradient(ellipse at 52% 100%, rgb(245 165 36 / 0.07), transparent 48%)',
          ].join(', '),
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgb(255 236 220 / 0.18) 1px, transparent 1.5px)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}
