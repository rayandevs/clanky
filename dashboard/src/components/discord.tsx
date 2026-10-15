import { ChevronDown, Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { Fragment, type ReactNode } from 'react';
import { cn, twemoji } from '@/lib/utils';
import { LogoMark } from './Logo';

/*
 * Discord message mockups, drawn with Discord's own dark theme so they look
 * like the real thing: Components V2 containers, buttons and select menus.
 */

/** Tiny markdown: **bold**, `code`, <#channel>, @mention and emoji. */
export function Md({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*|`[^`]+`|<#[^>]+>|@[\w.]+|\p{Extended_Pictographic}\uFE0F?)/gu).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
        if (p.startsWith('`')) return <code key={i} className="rounded bg-[#1e1f22] px-1 py-px font-mono text-[0.85em] text-dc-text">{p.slice(1, -1)}</code>;
        if (p.startsWith('<#')) return <span key={i} className="rounded bg-dc-blurple/25 px-0.5 font-medium text-[#c9cdfb]">#{p.slice(2, -1)}</span>;
        if (p.startsWith('@')) return <span key={i} className="rounded bg-dc-blurple/25 px-0.5 font-medium text-[#c9cdfb]">{p}</span>;
        if (/\p{Extended_Pictographic}/u.test(p)) return <img key={i} src={twemoji(p)} alt={p} className="mx-px inline-block size-[1.2em] -translate-y-px align-middle" />;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function DiscordWindow({ channel = 'general', children, className }: { channel?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('glass glass-sheen overflow-hidden rounded-[22px] p-1.5', className)}>
      <div className="overflow-hidden rounded-[17px] bg-dc-chat shadow-[inset_0_0_0_1px_rgb(255_255_255/0.04)]">
        <div className="flex items-center gap-2 border-b border-black/30 px-4 py-2.5 text-[14px] font-semibold text-white">
          <Hash className="size-[18px] text-dc-muted" />
          {channel}
          <span className="ml-auto flex gap-1.5">
            {['#ed6a5e', '#f5bf4f', '#61c454'].map((c) => (
              <span key={c} className="size-2.5 rounded-full opacity-70" style={{ background: c }} />
            ))}
          </span>
        </div>
        <div className="space-y-4 px-4 py-4 font-[gg_sans,Satoshi,sans-serif] text-[14.5px] leading-[1.4] text-dc-text">{children}</div>
      </div>
    </div>
  );
}

export function Message({ author = 'Clanky', bot = true, avatarColor, time = 'Today at 9:41 AM', command, user = 'Rayan', children }: { author?: string; bot?: boolean; avatarColor?: string; time?: string; command?: string; user?: string; children: ReactNode }) {
  return (
    <div>
      {command && (
        <div className="mb-1 flex items-center gap-1.5 pl-[52px] text-[13px] text-dc-muted">
          <span className="relative -ml-7 mr-1 h-2.5 w-6 rounded-tl-md border-l-2 border-t-2 border-[#4e5058]" />
          <span className="size-4 rounded-full bg-[#5865f2]" />
          <span className="font-medium text-[#c9cdfb]">{user}</span> used <span className="text-[#c9cdfb]">{command}</span>
        </div>
      )}
      <div className="flex gap-3">
        {bot ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1a120e]">
            <LogoMark className="size-7" />
          </span>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: avatarColor ?? '#5865f2' }}>
            {author[0]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('font-semibold', bot ? 'text-rust-300' : 'text-white')}>{author}</span>
            {bot && <span className="rounded bg-dc-blurple px-1 py-px text-[10px] font-semibold leading-tight text-white">APP</span>}
            <span className="text-[12px] text-dc-muted">{time}</span>
          </div>
          <div className="mt-1 space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Components V2 container */
export function Container({ accent = '#e2702f', children, className }: { accent?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative max-w-[520px] overflow-hidden rounded-lg border border-white/[0.06] bg-[#393a41]/60 py-3 pl-4 pr-3.5', className)}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function Text({ children, small }: { children: string; small?: boolean }) {
  return (
    <p className={cn('whitespace-pre-line', small && 'text-[12.5px] text-dc-muted')}>
      <Md>{children}</Md>
    </p>
  );
}

export function Title({ children }: { children: string }) {
  return (
    <p className="text-[16px] font-bold text-white">
      <Md>{children}</Md>
    </p>
  );
}

export const Separator = () => <div className="h-px bg-white/[0.08]" />;

type DStyle = 'primary' | 'secondary' | 'success' | 'danger';
const dStyles: Record<DStyle, string> = {
  primary: 'bg-dc-blurple hover:bg-[#4752c4]',
  secondary: 'bg-dc-grey hover:bg-[#6d6f78]',
  success: 'bg-dc-green hover:bg-[#1a6334]',
  danger: 'bg-dc-red hover:bg-[#a12828]',
};

export function DButton({ children, emoji, style = 'secondary', onClick, disabled, testId }: { children?: ReactNode; emoji?: string; style?: DStyle; onClick?: () => void; disabled?: boolean; testId?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn('inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3.5 text-[13.5px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50', dStyles[style], !onClick && 'cursor-default')}
    >
      {emoji && <img src={twemoji(emoji)} alt="" className="size-[18px]" />}
      {children}
    </motion.button>
  );
}

export const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;

export function DSelect({ placeholder, emoji }: { placeholder: string; emoji?: string }) {
  return (
    <div className="flex h-10 max-w-[440px] items-center gap-2 rounded-[6px] border border-black/40 bg-[#1e1f22] px-3 text-[14px] text-dc-muted">
      {emoji && <img src={twemoji(emoji)} alt="" className="size-[18px]" />}
      {placeholder}
      <ChevronDown className="ml-auto size-5" />
    </div>
  );
}

/** Section: text with a thumbnail on the right. */
export function Section({ children, thumb }: { children: ReactNode; thumb: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      <div className="shrink-0">{thumb}</div>
    </div>
  );
}

/* ───────────────────────── Salvage find card ─────────────────────────
   An HTML version of the image the bot renders for each find. */

export interface FindItem {
  name: string;
  emoji: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  xp: number;
  worth: number;
  shiny?: boolean;
}

export const RARITY_COLOR: Record<FindItem['rarity'], string> = {
  Common: '#a5adb8',
  Uncommon: '#4ade80',
  Rare: '#60a5fa',
  Epic: '#c084fc',
  Legendary: '#fbbf24',
};

export function FindCard({ item, level = 12, progress = 0.52, zone = 'Scrapyard' }: { item: FindItem; level?: number; progress?: number; zone?: string }) {
  const color = item.shiny ? '#fbbf24' : RARITY_COLOR[item.rarity];
  return (
    <div className="relative w-full max-w-[500px] overflow-hidden rounded-[10px] bg-[#111014] font-[Poppins,Satoshi,sans-serif] text-white shadow-[0_0_0_1px_rgb(255_255_255/0.05)]">
      <div className="h-[5px] opacity-90" style={{ background: `repeating-linear-gradient(-45deg, ${'#e2702f'} 0 8px, transparent 8px 16px)` }} />
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <motion.div
          key={item.name + item.shiny}
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          className="grid size-[76px] shrink-0 place-items-center rounded-[14px] border-2 bg-[#1b1b21] sm:size-[108px]"
          style={{ borderColor: color, boxShadow: item.shiny ? `0 0 26px -4px ${color}` : undefined }}
        >
          <img src={twemoji(item.emoji)} alt="" className="size-12 sm:size-[68px]" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#111014]" style={{ background: color }}>
              {item.shiny ? `Shiny ${item.rarity}` : item.rarity}
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#8b8b9a] sm:inline">{zone}</span>
          </div>
          <motion.p key={item.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 truncate text-[24px] font-bold leading-tight">
            {item.name}
          </motion.p>
          <p className="text-[13px] text-[#8b8b9a]">
            +{item.xp} XP · Worth {item.worth.toLocaleString()} credits
          </p>
          <div className="mt-3 flex justify-between text-[11px]">
            <span className="font-semibold">Level {level}</span>
            <span className="text-[#8b8b9a]">{Math.round(progress * 350)} / 350 XP</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#2a2a33]">
            <motion.div className="h-full rounded-full bg-rust-500" initial={false} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[12px] font-semibold">
        <span className="flex items-center gap-1.5"><img src={twemoji('🎒')} alt="" className="size-4" />385 in bag</span>
        <span className="flex items-center gap-1.5"><img src={twemoji('🪙')} alt="" className="size-4" />8,580</span>
        <span className="flex items-center gap-1.5"><img src={twemoji('🏚️')} alt="" className="size-4" />{zone}</span>
        <span className="ml-auto flex items-center gap-1 rounded-full border border-rust-500/60 px-2 py-0.5 text-[11px]"><img src={twemoji('🍀')} alt="" className="size-3.5" />Luck · 24</span>
      </div>
    </div>
  );
}
