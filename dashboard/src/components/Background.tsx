import { motion, useScroll, useTransform } from 'motion/react';

/**
 * The scrapyard at night: drifting rust and steel glow behind everything,
 * so the glass panels have something to refract. Fixed, behind content.
 */
export function Background() {
  const { scrollYProgress } = useScroll();
  const shift = useTransform(scrollYProgress, [0, 1], ['0%', '-18%']);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <motion.div style={{ y: shift }} className="absolute inset-0">
        <div className="absolute -left-[10vw] -top-[12vh] h-[62vh] w-[62vh] rounded-full bg-rust-500/30 blur-[110px] animate-drift-a" />
        <div className="absolute right-[-8vw] top-[18vh] h-[56vh] w-[56vh] rounded-full bg-[#3a6b7c]/25 blur-[120px] animate-drift-b" />
        <div className="absolute bottom-[-20vh] left-[28vw] h-[60vh] w-[70vh] rounded-full bg-[#f5a524]/14 blur-[130px] animate-drift-c" />
        <div className="absolute left-[55vw] top-[95vh] h-[50vh] w-[50vh] rounded-full bg-rust-600/20 blur-[120px] animate-drift-a" />
      </motion.div>
      {/* Bolt grid */}
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgb(255 236 220 / 0.18) 1px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)',
        }}
      />
      {/* Film grain */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
