import { motion, type HTMLMotionProps } from 'motion/react';

/** Fades content in (with a little lift and focus) as it scrolls into view. */
export function Reveal({ delay = 0, y = 18, className, children, ...props }: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`stamp inline-flex items-center gap-2 text-rust-300 ${className ?? ''}`}>
      <span className="h-px w-6 bg-rust-400/70" />
      {children}
    </p>
  );
}
