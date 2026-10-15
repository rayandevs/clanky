import { Popover } from 'radix-ui';
import { Check, ChevronDown, Hash, Megaphone, Search, Volume2, X, Folder, MessagesSquare } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { CH, type Channel, type Role } from '@/lib/types';
import { cn, hex } from '@/lib/utils';

/* Pickers for channels and roles, grouped like Discord's sidebar. */

type Kind = 'text' | 'category' | 'any';

const fits = (c: Channel, kind: Kind) =>
  kind === 'category' ? c.type === CH.category : kind === 'text' ? c.type === CH.text || c.type === CH.announcement : c.type !== CH.category;

export function ChannelIcon({ type, className }: { type: number; className?: string }) {
  const Icon = type === CH.announcement ? Megaphone : type === CH.voice || type === CH.stage ? Volume2 : type === CH.category ? Folder : type === CH.forum ? MessagesSquare : Hash;
  return <Icon className={cn('size-4 shrink-0 text-faint', className)} />;
}

function Shell({ trigger, children, open, setOpen, testId }: { trigger: ReactNode; children: ReactNode; open: boolean; setOpen: (v: boolean) => void; testId?: string }) {
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-line bg-black/25 px-3 py-1.5 text-left text-[14px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)] transition-colors hover:border-white/20 data-[state=open]:border-rust-400/60"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{trigger}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-faint transition-transform duration-300', open && 'rotate-180')} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="glass glass-strong z-50 w-[var(--radix-popover-trigger-width)] min-w-[260px] overflow-hidden rounded-2xl p-1.5 data-[state=open]:animate-[pop_.22s_var(--ease-out-expo)]"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-1.5">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-xl bg-black/30 pl-9 pr-3 text-[14px] placeholder:text-faint focus:outline-none" />
    </div>
  );
}

function Option({ selected, onClick, children, disabled, hint }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={hint}
      className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-40', selected ? 'bg-rust-500/15 text-text' : 'text-muted hover:bg-white/[0.06] hover:text-text')}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
      {selected && <Check className="size-4 text-rust-400" />}
    </button>
  );
}

function grouped(channels: Channel[], kind: Kind, query: string) {
  const q = query.trim().toLowerCase();
  const pick = channels.filter((c) => fits(c, kind) && (!q || c.name.toLowerCase().includes(q)));
  if (kind === 'category') return [{ category: null as Channel | null, items: pick }];
  const cats = channels.filter((c) => c.type === CH.category);
  const groups = [{ category: null as Channel | null, items: pick.filter((c) => !c.parentId) }, ...cats.map((cat) => ({ category: cat, items: pick.filter((c) => c.parentId === cat.id) }))];
  return groups.filter((g) => g.items.length);
}

interface ChannelPickerProps {
  channels: Channel[];
  kind?: Kind;
  placeholder?: string;
  testId?: string;
}

export function ChannelPicker({ value, onChange, channels, kind = 'text', placeholder = 'Pick a channel', testId }: ChannelPickerProps & { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = channels.find((c) => c.id === value);
  const groups = useMemo(() => grouped(channels, kind, query), [channels, kind, query]);
  return (
    <Shell
      open={open}
      setOpen={setOpen}
      testId={testId}
      trigger={
        current ? (
          <span className="flex items-center gap-1.5 font-medium">
            <ChannelIcon type={current.type} className="text-muted" />
            {current.name}
            {current.canSend === false && <span className="text-[12px] text-hazard">· Clanky can't post here</span>}
          </span>
        ) : (
          <span className="text-faint">{placeholder}</span>
        )
      }
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search channels" />
      <div className="max-h-72 overflow-y-auto pr-0.5">
        {value && (
          <Option selected={false} onClick={() => (onChange(null), setOpen(false))}>
            <X className="size-4" /> None
          </Option>
        )}
        {groups.map((g) => (
          <div key={g.category?.id ?? 'root'}>
            {g.category && <p className="stamp px-2.5 pb-1 pt-2.5 !text-[10px] text-faint">{g.category.name}</p>}
            {g.items.map((c) => (
              <Option key={c.id} selected={c.id === value} onClick={() => (onChange(c.id), setOpen(false))} hint={c.canSend === false ? 'no access' : undefined}>
                <ChannelIcon type={c.type} />
                <span className="truncate">{c.name}</span>
              </Option>
            ))}
          </div>
        ))}
        {!groups.length && <p className="px-3 py-6 text-center text-[13px] text-faint">No channels found</p>}
      </div>
    </Shell>
  );
}

function Chip({ children, onRemove, color }: { children: ReactNode; onRemove: () => void; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.06] py-0.5 pl-2 pr-1 text-[13px] font-medium">
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {children}
      <span
        role="button"
        tabIndex={0}
        aria-label="Remove"
        onClick={(e) => (e.stopPropagation(), onRemove())}
        onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onRemove())}
        className="grid size-4 place-items-center rounded text-faint hover:bg-white/10 hover:text-text"
      >
        <X className="size-3" />
      </span>
    </span>
  );
}

export function MultiChannelPicker({ value, onChange, channels, kind = 'text', placeholder = 'Pick channels', max = 25, testId }: ChannelPickerProps & { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groups = useMemo(() => grouped(channels, kind, query), [channels, kind, query]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : value.length < max ? [...value, id] : value);
  const selected = value.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as Channel[];
  return (
    <Shell
      open={open}
      setOpen={setOpen}
      testId={testId}
      trigger={
        selected.length ? (
          selected.map((c) => (
            <Chip key={c.id} onRemove={() => toggle(c.id)}>
              <ChannelIcon type={c.type} className="size-3.5" />
              {c.name}
            </Chip>
          ))
        ) : (
          <span className="text-faint">{placeholder}</span>
        )
      }
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search channels" />
      <div className="max-h-72 overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.category?.id ?? 'root'}>
            {g.category && <p className="stamp px-2.5 pb-1 pt-2.5 !text-[10px] text-faint">{g.category.name}</p>}
            {g.items.map((c) => (
              <Option key={c.id} selected={value.includes(c.id)} onClick={() => toggle(c.id)}>
                <ChannelIcon type={c.type} />
                <span className="truncate">{c.name}</span>
              </Option>
            ))}
          </div>
        ))}
      </div>
      <p className="border-t border-line px-2.5 pb-1 pt-2 text-[12px] text-faint">
        {value.length}/{max} picked
      </p>
    </Shell>
  );
}

const roleColor = (r: Role) => (r.color ? hex(r.color) : '#9aa6b2');

export function RolePicker({ value, onChange, roles, max = 10, placeholder = 'Pick roles', assignableOnly = false, testId }: { value: string[]; onChange: (v: string[]) => void; roles: Role[]; max?: number; placeholder?: string; assignableOnly?: boolean; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = roles.filter((r) => !r.managed && (!q || r.name.toLowerCase().includes(q)));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : value.length < max ? [...value, id] : value);
  const selected = value.map((id) => roles.find((r) => r.id === id)).filter(Boolean) as Role[];
  return (
    <Shell
      open={open}
      setOpen={setOpen}
      testId={testId}
      trigger={selected.length ? selected.map((r) => <Chip key={r.id} color={roleColor(r)} onRemove={() => toggle(r.id)}>{r.name}</Chip>) : <span className="text-faint">{placeholder}</span>}
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search roles" />
      <div className="max-h-72 overflow-y-auto pr-0.5">
        {list.map((r) => (
          <Option key={r.id} selected={value.includes(r.id)} onClick={() => toggle(r.id)} disabled={assignableOnly && !r.assignable} hint={assignableOnly && !r.assignable ? 'above Clanky' : undefined}>
            <span className="size-3 shrink-0 rounded-full" style={{ background: roleColor(r) }} />
            <span className="truncate">{r.name}</span>
          </Option>
        ))}
      </div>
      <p className="border-t border-line px-2.5 pb-1 pt-2 text-[12px] text-faint">
        {value.length}/{max} picked
      </p>
    </Shell>
  );
}

/** Single role, used for level rewards. */
export function SingleRolePicker({ value, onChange, roles, testId }: { value: string | null; onChange: (v: string) => void; roles: Role[]; testId?: string }) {
  const [open, setOpen] = useState(false);
  const current = roles.find((r) => r.id === value);
  return (
    <Shell open={open} setOpen={setOpen} testId={testId} trigger={current ? <span className="flex items-center gap-2 font-medium"><span className="size-3 rounded-full" style={{ background: roleColor(current) }} />{current.name}</span> : <span className="text-faint">Pick a role</span>}>
      <div className="max-h-72 overflow-y-auto">
        {roles.filter((r) => !r.managed).map((r) => (
          <Option key={r.id} selected={r.id === value} onClick={() => (onChange(r.id), setOpen(false))} disabled={!r.assignable} hint={!r.assignable ? 'above Clanky' : undefined}>
            <span className="size-3 rounded-full" style={{ background: roleColor(r) }} />
            {r.name}
          </Option>
        ))}
      </div>
    </Shell>
  );
}
