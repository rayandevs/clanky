import { Plus, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Container, DiscordWindow, Message, Section, Text } from '@/components/discord';
import { Glass } from '@/components/Glass';
import { Button, Emoji, Input, Switch, Textarea } from '@/components/ui';
import type { WelcomeArtwork, WelcomeEvent, WelcomeFormat } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Page title with the module's on/off switch. */
export function SectionHeader({ emoji, title, description, enabled, onToggle }: { emoji: string; title: string; description: string; enabled?: boolean; onToggle?: (v: boolean) => void }) {
  return (
    <Glass className="flex flex-wrap items-center gap-4 rounded-3xl p-5 sm:p-6">
      <span className="grid size-14 place-items-center rounded-2xl bg-black/30 ring-1 ring-line">
        <Emoji e={emoji} className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-[clamp(1.6rem,2.6vw,2rem)] font-extrabold">{title}</h1>
        <p className="mt-0.5 text-[14px] text-muted">{description}</p>
      </div>
      {onToggle && (
        <label className={cn('flex items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors', enabled ? 'border-rust-400/30 bg-rust-500/10' : 'border-line bg-black/20')}>
          <span className="text-[14px] font-semibold">{enabled ? 'On' : 'Off'}</span>
          <Switch checked={!!enabled} onChange={onToggle} label={`Turn ${title} on or off`} testId="switch-section-enabled" />
        </label>
      )}
    </Glass>
  );
}

/** Dims settings while the module is off, but keeps them editable. */
export function OffNotice({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {show && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-black/20 px-4 py-3 text-[14px] text-muted">
          <Emoji e="💤" className="size-[18px]" /> This module is off. You can still set it up, then turn it on.
        </p>
      )}
      <div className={cn('space-y-5 transition-opacity duration-300', show && 'opacity-60')}>{children}</div>
    </div>
  );
}

/** Text area for templates, with clickable placeholder chips. */
export function TemplateInput({ value, onChange, placeholders, maxLength, testId }: { value: string; onChange: (v: string) => void; placeholders: Array<{ key: string; label: string }>; maxLength: number; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const insert = (token: string) => {
    const area = ref.current?.querySelector('textarea');
    if (!area) return onChange(value + token);
    const start = area.selectionStart ?? value.length;
    const end = area.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div ref={ref}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} data-testid={testId} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {placeholders.map((p) => (
          <button key={p.key} type="button" onClick={() => insert(p.key)} className="rounded-lg border border-line bg-white/[0.04] px-2 py-1 font-mono text-[12px] text-muted transition-colors hover:border-rust-400/40 hover:text-text" title={p.label}>
            {p.key} <span className="font-sans text-faint">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WelcomeCard({ artwork, artworkUrl, event, message, cardPreviewUrl }: { artwork: WelcomeArtwork; artworkUrl?: string; event: WelcomeEvent; message: string; cardPreviewUrl?: string }) {
  if (cardPreviewUrl) return <img src={cardPreviewUrl} alt="" className="mb-3 block w-full rounded-lg border border-white/[0.12]" />;
  const style = {
    celebration: { background: 'linear-gradient(135deg, #5b2b11 0%, #c2571d 52%, #f5a742 100%)', eyebrow: 'A NEW MEMBER' },
    minimal: { background: 'linear-gradient(135deg, #20222a 0%, #353946 100%)', eyebrow: 'COMMUNITY UPDATE' },
    soft: { background: 'linear-gradient(135deg, #34243c 0%, #76526f 52%, #b77b91 100%)', eyebrow: 'MEMBER UPDATE' },
  }[artwork.template];
  return (
    <div className="relative mb-3 min-h-28 overflow-hidden rounded-lg border border-white/[0.12] bg-[#17171e] px-4 py-3 text-white" style={{ background: artwork.background === 'preset' ? style.background : undefined }}>
      {artwork.background === 'custom' && artworkUrl && <img src={artworkUrl} alt="Custom welcome artwork" className="absolute inset-0 size-full object-cover" />}
      {artwork.background === 'custom' && <div className="absolute inset-0 bg-[linear-gradient(120deg,rgb(18_18_24/0.3),rgb(18_18_24/0.75))]" />}
      <div className="relative flex min-h-[88px] items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="stamp text-[10px] tracking-[0.16em] text-white/70">{event === 'join' ? style.eyebrow : 'A MEMBER LEFT'}</p>
          <p className="mt-1 text-[15px] font-bold">Juno</p>
          {message && <p className="mt-1 max-w-[420px] truncate text-[11px] text-white/75">{message.replace(/[*_~`]/g, '').replace('@Juno', 'Juno')}</p>}
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-white/80">
            {artwork.showServerName && <span>Your server</span>}
            {artwork.showServerName && artwork.showMemberCount && <span>·</span>}
            {artwork.showMemberCount && <span>1,285 members</span>}
          </div>
        </div>
        {artwork.showAvatar && <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-white/50 bg-[#eb459e] text-[18px] font-bold shadow-lg">J</span>}
      </div>
    </div>
  );
}

/** Live preview of a Clanky message, including welcome event text and generated-card formats. */
export function MessagePreview({ text, channel, accent, avatar, format = 'container', artwork, artworkUrl, event = 'join', cardPreviewUrl }: {
  text: string;
  channel: string;
  accent: string;
  avatar?: boolean;
  format?: WelcomeFormat;
  artwork?: WelcomeArtwork;
  artworkUrl?: string;
  event?: WelcomeEvent;
  cardPreviewUrl?: string;
}) {
  const hasCard = (format === 'text_image' || format === 'image_only') && artwork;
  const message = avatar && format === 'container'
    ? <Section thumb={<span className="grid size-[60px] place-items-center rounded-full bg-[#eb459e] text-[22px] font-bold text-white">J</span>}><Text>{text || ' '}</Text></Section>
    : <Text>{text || ' '}</Text>;
  return (
    <div>
      <p className="stamp mb-2 text-muted">Preview</p>
      <DiscordWindow channel={channel}>
        <Message time="Today at 9:41 AM">
          {format === 'container' && <Container accent={accent}>{message}</Container>}
          {format === 'text' && message}
          {format === 'text_image' && <>{message}{hasCard && <WelcomeCard artwork={artwork} artworkUrl={artworkUrl} event={event} message="" cardPreviewUrl={cardPreviewUrl} />}</>}
          {format === 'image_only' && hasCard && <WelcomeCard artwork={artwork} artworkUrl={artworkUrl} event={event} message={text} cardPreviewUrl={cardPreviewUrl} />}
        </Message>
      </DiscordWindow>
    </div>
  );
}

/** Editable list of short words (blocked words). */
export function WordList({ value, onChange, max, maxLength, testId }: { value: string[]; onChange: (v: string[]) => void; max: number; maxLength: number; testId?: string }) {
  const [input, setInput] = useState('');
  const add = () => {
    const words = input
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w && w.length <= maxLength && !value.includes(w));
    if (!words.length) return;
    onChange([...value, ...words].slice(0, max));
    setInput('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="Type a word, then press Enter" data-testid={testId} />
        <Button onClick={add} disabled={!input.trim() || value.length >= max}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {value.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white/[0.05] py-1 pl-2.5 pr-1 font-mono text-[13px]">
              {w}
              <button type="button" aria-label={`Remove ${w}`} onClick={() => onChange(value.filter((x) => x !== w))} className="grid size-5 place-items-center rounded text-faint hover:bg-white/10 hover:text-text">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[12px] text-faint">
        {value.length}/{max} words · Use * as a wildcard, like scam*
      </p>
    </div>
  );
}
