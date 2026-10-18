import { Slider as SliderPrimitive, Switch as SwitchPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import { Loader2 } from 'lucide-react';
import { animate, motion, useInView } from 'motion/react';
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn, twemoji } from '@/lib/utils';

/* ───────────────────────── Button ───────────────────────── */

type Variant = 'primary' | 'glass' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'text-[#1a0f08] bg-[linear-gradient(180deg,#f9a170,#e2702f_55%,#c2571d)] shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_-2px_0_rgb(0_0_0/0.18),0_10px_30px_-10px_rgb(226_112_47/0.8)] hover:brightness-110',
  glass: 'glass text-text hover:bg-white/[0.08]',
  ghost: 'text-muted hover:text-text hover:bg-white/[0.06]',
  danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
  outline: 'border border-line text-text hover:bg-white/[0.05]',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-2xl gap-2.5',
  icon: 'size-9 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = 'glass', size = 'md', loading, disabled, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/** Same look as Button, for links. */
export function buttonClass(variant: Variant = 'glass', size: Size = 'md', className?: string) {
  return cn('relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-200 active:scale-[0.97]', variants[variant], sizes[size], className);
}

/* ───────────────────────── Switch ───────────────────────── */

export function Switch({ checked, onChange, disabled, label, testId }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; testId?: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
      className={cn(
        'relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-rust-400/60 bg-rust-500 shadow-[0_0_18px_-4px_rgb(226_112_47/0.9),inset_0_1px_0_rgb(255_255_255/0.35)]' : 'border-line bg-white/[0.07] shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)]',
      )}
    >
      <SwitchPrimitive.Thumb asChild>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          className={cn('block size-5 rounded-full bg-[linear-gradient(180deg,#fff,#e8ded6)] shadow-[0_2px_6px_rgb(0_0_0/0.4)]', checked ? 'ml-[22px]' : 'ml-[2px]')}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

/* ───────────────────────── Fields ───────────────────────── */

export function Field({ label, description, children, error, inline, htmlFor }: { label: string; description?: ReactNode; children: ReactNode; error?: string | null; inline?: boolean; htmlFor?: string }) {
  return (
    <div className={cn('py-4', inline && 'flex items-center justify-between gap-6')}>
      <div className={cn('min-w-0', !inline && 'mb-2.5')}>
        <label htmlFor={htmlFor} className="block text-[14px] font-semibold text-text">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className={cn(inline ? 'shrink-0' : 'w-full')}>{children}</div>
      {error && <p className="mt-1.5 text-[13px] text-bad">{error}</p>}
    </div>
  );
}

const inputBase =
  'w-full rounded-xl border border-line bg-black/25 px-3.5 text-[14px] text-text placeholder:text-faint shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)] transition-colors focus:border-rust-400/60 focus:bg-black/35 focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputBase, 'h-10', className)} {...props} />;
});

export function Textarea({ className, maxLength, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  return (
    <div className="relative">
      <textarea value={value} maxLength={maxLength} className={cn(inputBase, 'min-h-[96px] resize-y py-3 leading-relaxed', className)} {...props} />
      {maxLength && (
        <span className={cn('pointer-events-none absolute bottom-2 right-3 font-mono text-[11px]', value.length > maxLength * 0.9 ? 'text-hazard' : 'text-faint')}>
          {value.length}/{maxLength}
        </span>
      )}
    </div>
  );
}

export function Slider({ value, onChange, min, max, step = 1, suffix = '', testId }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string; testId?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const commitTimer = useRef<number | null>(null);
  const pendingValue = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setDisplayValue(value), [value]);
  useEffect(() => () => {
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current);
      if (pendingValue.current !== null) onChangeRef.current(pendingValue.current);
    }
  }, []);

  const commit = (nextValue: number) => {
    pendingValue.current = nextValue;
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      pendingValue.current = null;
      onChangeRef.current(nextValue);
    }, 160);
  };

  return (
    <div className="flex items-center gap-4">
      <SliderPrimitive.Root value={[displayValue]} onValueChange={([v]) => setDisplayValue(v!)} onValueCommit={([v]) => commit(v!)} min={min} max={max} step={step} className="relative flex h-6 w-full touch-none select-none items-center" data-testid={testId}>
        <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)]">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-[linear-gradient(90deg,#c2571d,#f08a44)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb aria-label="Value" className="block size-5 rounded-full border border-white/40 bg-[linear-gradient(180deg,#fff,#e8ded6)] shadow-[0_2px_10px_rgb(0_0_0/0.5),0_0_0_4px_rgb(226_112_47/0.2)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rust-500/40" />
      </SliderPrimitive.Root>
      <span className="w-16 shrink-0 rounded-lg border border-line bg-black/25 py-1 text-center font-mono text-[13px] font-bold tabular-nums">
        {displayValue}
        {suffix}
      </span>
    </div>
  );
}

/** A small set of mutually exclusive options. */
export function Segmented<T extends string>({ value, options, onChange, testId }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; testId?: string }) {
  const id = useId();
  return (
    <div className="inline-flex rounded-xl border border-line bg-black/25 p-1" role="radiogroup" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors', o.value === value ? 'text-[#1a0f08]' : 'text-muted hover:text-text')}
        >
          {o.value === value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-[linear-gradient(180deg,#f9a170,#e2702f)] shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Small bits ───────────────────────── */

export function Emoji({ e, className, alt = '' }: { e: string; className?: string; alt?: string }) {
  return <img src={twemoji(e)} alt={alt} draggable={false} className={cn('inline-block size-5 select-none', className)} />;
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'rust' | 'ok' | 'bad' | 'info' | 'hazard'; className?: string }) {
  const tones = {
    neutral: 'bg-white/[0.07] text-muted border-line',
    rust: 'bg-rust-500/15 text-rust-300 border-rust-500/30',
    ok: 'bg-ok/12 text-ok border-ok/25',
    bad: 'bg-bad/12 text-bad border-bad/25',
    info: 'bg-info/12 text-info border-info/25',
    hazard: 'bg-hazard/12 text-hazard border-hazard/25',
  };
  return <span className={cn('stamp inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 !text-[10px]', tones[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function Avatar({ src, name, className }: { src: string | null | undefined; name: string; className?: string }) {
  if (src) return <img src={src} alt="" className={cn('size-8 shrink-0 rounded-full object-cover', className)} />;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={cn('inline-grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#3a2a22,#1f1916)] font-display text-[13px] font-extrabold text-rust-300 ring-1 ring-line', className)}>
      {initials || '?'}
    </span>
  );
}

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="glass glass-strong z-50 max-w-xs rounded-lg px-2.5 py-1.5 text-[12px] text-text data-[state=delayed-open]:animate-in">
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/** Counts up to a number when it first appears. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  return (
    <motion.span className={cn('tabular-nums', className)} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
      <Counter to={value} />
    </motion.span>
  );
}

function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (node.textContent = Math.round(v).toLocaleString('en-US')) });
    return () => controls.stop();
  }, [inView, to]);
  return <span ref={ref}>0</span>;
}
