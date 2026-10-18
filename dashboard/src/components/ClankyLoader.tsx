import { cn } from '@/lib/utils';
import { LogoMark } from './Logo';

type ClankyLoaderProps = {
  className?: string;
  size?: 'compact' | 'large';
  label?: string;
};

export function ClankyLoader({ className, size = 'large', label = 'Loading' }: ClankyLoaderProps) {
  const compact = size === 'compact';

  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center gap-3', className)}>
      <span className={cn('relative grid place-items-center', compact ? 'size-14' : 'size-20')} aria-hidden="true">
        <span className="absolute inset-1 rounded-full border border-white/10" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-rust-500/50 border-t-rust-300" />
        <span className="absolute inset-0 animate-[spin_2.8s_linear_infinite]">
          <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-hazard shadow-[0_0_10px_rgb(245_197_66/0.8)]" />
        </span>
        <span className="absolute inset-[22%] animate-pulse rounded-full bg-rust-500/20 blur-md" />
        <LogoMark
          className={cn('relative z-10 drop-shadow-[0_0_12px_rgb(226_112_47/0.3)] animate-[clanky-float_1.8s_ease-in-out_infinite]', compact ? 'size-8' : 'size-12')}
          animated
        />
      </span>
      <span className={cn('text-[13px] font-medium text-muted', compact && 'sr-only')}>{label}</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <span className="size-1 rounded-full bg-rust-300 animate-[clanky-signal_1.1s_ease-in-out_infinite]" />
        <span className="size-1 rounded-full bg-rust-300 animate-[clanky-signal_1.1s_ease-in-out_infinite] [animation-delay:140ms]" />
        <span className="size-1 rounded-full bg-rust-300 animate-[clanky-signal_1.1s_ease-in-out_infinite] [animation-delay:280ms]" />
      </span>
    </div>
  );
}
