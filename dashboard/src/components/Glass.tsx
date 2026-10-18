import { forwardRef, useCallback, type HTMLAttributes, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';

/** Updates --mx/--my so the sheen follows the pointer on small interactive cards. */
export function useSheen() {
  return useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }, []);
}

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  interactive?: boolean;
}

/** A liquid-glass surface. Pointer-driven sheen is reserved for interactive cards. */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass({ className, strong, interactive, onPointerMove, ...props }, ref) {
  const sheen = useSheen();
  const handlePointerMove = interactive
    ? (event: PointerEvent<HTMLDivElement>) => {
        sheen(event);
        onPointerMove?.(event);
      }
    : onPointerMove;

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn('glass rounded-2xl', interactive && 'glass-sheen transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 [--sheen:0.35] hover:[--sheen:1]', strong && 'glass-strong', className)}
      {...props}
    />
  );
});
