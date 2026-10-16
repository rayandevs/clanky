import { useQuery } from '@tanstack/react-query';
import { DropdownMenu } from 'radix-ui';
import { motion } from 'motion/react';
import { ChevronsUpDown, FileText, History, LayoutGrid } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { BrandSpinner, EmptyState, ModuleSwitch, Panel, RequireLogin, useGuildSettings } from '@/components/dash';
import { Glass } from '@/components/Glass';
import { Avatar, Badge, buttonClass, Emoji, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useMeta } from '@/lib/hooks';
import type { GuildListItem, Overview, SectionId } from '@/lib/types';
import { ago, cn, MODULE_EMOJI, n } from '@/lib/utils';

const SettingsPage = lazy(() => import('./settings/SettingsPage'));
const HistoryPage = lazy(() => import('./settings/History'));
const TicketTranscriptsPage = lazy(() => import('./TicketTranscripts'));

export const SECTIONS: Array<{ id: SectionId; name: string; emoji: string }> = [
  { id: 'general', name: 'General', emoji: '⚙️' },
  { id: 'moderation', name: 'Moderation', emoji: '🛡️' },
  { id: 'automod', name: 'AutoMod', emoji: '🤖' },
  { id: 'logging', name: 'Logging', emoji: '📋' },
  { id: 'welcome', name: 'Welcome', emoji: '👋' },
  { id: 'tickets', name: 'Tickets', emoji: '🎫' },
  { id: 'suggestions', name: 'Suggestions', emoji: '💡' },
  { id: 'leveling', name: 'Leveling', emoji: '⭐' },
  { id: 'games', name: 'Games', emoji: '🎮' },
];

function ServerSwitcher({ current }: { current: Overview['guild'] }) {
  const { data } = useQuery<GuildListItem[]>({ queryKey: ['/api/guilds', 0], queryFn: () => import('@/lib/api').then((m) => m.get('/api/guilds')) });
  const [, navigate] = useLocation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 text-left ring-1 ring-line transition hover:bg-white/[0.07]" data-testid="button-server-switcher">
          <Avatar src={current.icon} name={current.name} className="size-10 rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{current.name}</span>
            <span className="block text-[12px] text-faint">{n(current.memberCount)} members</span>
          </span>
          <ChevronsUpDown className="size-4 text-faint" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className="glass glass-strong z-50 w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl p-1.5 data-[state=open]:animate-[pop_.22s_var(--ease-out-expo)]">
          {data?.filter((g) => g.botIn).map((g) => (
            <DropdownMenu.Item key={g.id} onSelect={() => navigate(`/dashboard/${g.id}`)} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] outline-none data-[highlighted]:bg-white/[0.07]', g.id === current.id && 'text-rust-300')}>
              <Avatar src={g.icon} name={g.name} className="size-7 rounded-lg text-[11px]" />
              <span className="truncate">{g.name}</span>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={() => navigate('/dashboard')} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] text-muted outline-none data-[highlighted]:bg-white/[0.07]">
            <LayoutGrid className="size-4" /> All servers
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Sidebar({ guild, active }: { guild: Overview['guild']; active: string }) {
  const settings = useGuildSettings(guild.id).data?.settings;
  const item = (href: string, isActive: boolean, children: React.ReactNode, testId: string) => (
    <Link
      href={href}
      data-testid={testId}
      className={cn('relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] transition-colors', isActive ? 'text-text' : 'text-muted hover:bg-white/[0.04] hover:text-text')}
    >
      {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-rust-500/15 ring-1 ring-rust-400/25" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <span className="relative flex flex-1 items-center gap-2.5">{children}</span>
    </Link>
  );
  return (
    <Glass className="rounded-3xl p-3 lg:sticky lg:top-24">
      <ServerSwitcher current={guild} />
      <nav className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {item(`/dashboard/${guild.id}`, active === '', <><LayoutGrid className="size-[18px] text-faint" /> Overview</>, 'nav-overview')}
        <p className="stamp hidden px-3 pb-1 pt-4 !text-[10px] text-faint lg:block">Settings</p>
        {SECTIONS.map((s) => {
          const enabled = s.id === 'general' ? true : ((settings?.[s.id] as { enabled?: boolean } | undefined)?.enabled ?? true);
          return (
            <div key={s.id} className="shrink-0">
              {item(
                `/dashboard/${guild.id}/${s.id}`,
                active === s.id,
                <>
                  <Emoji e={s.emoji} className="size-[18px]" />
                  <span className="flex-1">{s.name}</span>
                  {settings && s.id !== 'general' && <span className={cn('hidden size-1.5 rounded-full lg:block', enabled ? 'bg-ok' : 'bg-white/15')} />}
                </>,
                `nav-${s.id}`,
              )}
            </div>
          );
        })}
        <p className="stamp hidden px-3 pb-1 pt-4 !text-[10px] text-faint lg:block">Server</p>
        {item(`/dashboard/${guild.id}/history`, active === 'history', <><History className="size-[18px] text-faint" /> Change history</>, 'nav-history')}
        {item(`/dashboard/${guild.id}/transcripts`, active === 'transcripts', <><FileText className="size-[18px] text-faint" /> Ticket transcripts</>, 'nav-ticket-transcripts')}
      </nav>
    </Glass>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function StatTile({ emoji, label, value, hint, delay }: { emoji: string; label: string; value: number; hint: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <Glass className="h-full rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <span className="stamp text-muted">{label}</span>
          <Emoji e={emoji} className="size-5" />
        </div>
        <p className="mt-3 font-display text-[38px] font-extrabold leading-none tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{n(value)}</p>
        <p className="mt-1.5 text-[13px] text-faint">{hint}</p>
      </Glass>
    </motion.div>
  );
}

function Activity({ days }: { days: Overview['activity'] }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.cases, d.tickets)));
  return (
    <Panel title="Last 14 days" description="Moderation cases and tickets opened each day.">
      <div className="pt-4">
        <div className="flex h-56 items-end gap-1.5 sm:gap-2.5">
          {days.map((d, i) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
              {(['cases', 'tickets'] as const).map((k) => (
                <motion.span
                  key={k}
                  initial={{ height: 0 }}
                  animate={{ height: `${(d[k] / max) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.03, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('w-full max-w-3 rounded-t-[4px]', k === 'cases' ? 'bg-[linear-gradient(180deg,#f9a170,#c2571d)]' : 'bg-steel-400/60')}
                  style={{ minHeight: d[k] ? 4 : 0 }}
                />
              ))}
              <span className="glass glass-strong pointer-events-none absolute -top-12 z-10 hidden whitespace-nowrap rounded-lg px-2 py-1 text-[11px] group-hover:block">
                {new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {d.cases} cases · {d.tickets} tickets
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-5 border-t border-line pt-3 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rust-500" /> Cases</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-steel-400/60" /> Tickets</span>
        </div>
      </div>
    </Panel>
  );
}

const CASE_EMOJI: Record<string, string> = { warn: '⚠️', timeout: '🔇', untimeout: '🔔', kick: '👢', ban: '🔨', unban: '🔓' };

function OverviewPage({ data }: { data: Overview }) {
  const { data: meta } = useMeta();
  const names = Object.fromEntries((meta?.modules ?? []).map((m) => [m.id, m]));
  const g = data.guild;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={g.icon} name={g.name} className="size-16 rounded-2xl text-[22px]" />
        <div>
          <h1 className="text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold">{g.name}</h1>
          <p className="text-[14px] text-muted">
            {n(g.memberCount)} members{g.joinedAt ? ` · Clanky joined ${ago(g.joinedAt)}` : ''}
          </p>
        </div>
      </div>

      {data.missing.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-hazard/30 bg-hazard/[0.06] p-5">
          <div className="absolute inset-y-0 left-0 w-1.5 hazard" />
          <p className="flex items-center gap-2 pl-2 text-[15px] font-bold"><Emoji e="⚠️" className="size-[18px]" /> Clanky is missing some permissions</p>
          <ul className="mt-2 space-y-1 pl-2 text-[14px] text-muted">
            {data.missing.map((p) => (
              <li key={p.name}><span className="font-semibold text-text">{p.name}</span> · needed for {p.why.toLowerCase()}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile emoji="🛡️" label="Cases this week" value={data.stats.casesWeek} hint={`${n(data.stats.casesTotal)} all time`} delay={0} />
        <StatTile emoji="🎫" label="Open tickets" value={data.stats.openTickets} hint={`${n(data.stats.ticketsTotal)} opened so far`} delay={0.05} />
        <StatTile emoji="💡" label="Ideas to review" value={data.stats.pendingSuggestions} hint="Waiting for a decision" delay={0.1} />
        <StatTile emoji="⭐" label="Ranked members" value={data.stats.ranked} hint="Have earned some XP" delay={0.15} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Activity days={data.activity} />
        <Panel title="Modules" description="Changes save right away.">
          {data.modules.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <Emoji e={MODULE_EMOJI[names[m.id]?.emoji ?? ''] ?? '⚙️'} className="size-[18px]" />
              <span className="flex-1 text-[14px] font-medium">{names[m.id]?.name ?? m.id}</span>
              <ModuleSwitch guildId={g.id} id={m.id} enabled={m.enabled} label={names[m.id]?.name ?? m.id} />
            </div>
          ))}
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Panel title="Recent cases" emoji="📋">
          {data.recentCases.length ? (
            data.recentCases.map((c) => (
              <div key={c.caseId} className="flex items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-black/30 ring-1 ring-line"><Emoji e={CASE_EMOJI[c.type] ?? '📋'} className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]"><span className="font-mono text-[12px] text-faint">#{c.caseId}</span> <span className="font-semibold capitalize">{c.type}</span> · {c.target}</p>
                  <p className="truncate text-[12.5px] text-muted">{c.reason ?? 'No reason given'} · by {c.moderator.name}</p>
                </div>
                <span className="shrink-0 text-[12px] text-faint">{ago(c.createdAt)}</span>
              </div>
            ))
          ) : (
            <EmptyState emoji="😇" title="All quiet" body="No moderation cases yet." />
          )}
        </Panel>
        <Panel title="Recent changes" emoji="📝" action={<Link href={`/dashboard/${g.id}/history`} className={buttonClass('ghost', 'sm')}>See all</Link>}>
          {data.audit.length ? (
            data.audit.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Avatar src={a.actor.avatar} name={a.actor.name} className="size-8" />
                <p className="min-w-0 flex-1 truncate text-[14px]">
                  <span className="font-semibold">{a.actor.name}</span> changed <span className="font-semibold capitalize">{a.section}</span>
                </p>
                <Badge tone={a.source === 'dashboard' ? 'rust' : 'info'}>{a.source === 'dashboard' ? 'Web' : 'Discord'}</Badge>
                <span className="w-16 shrink-0 text-right text-[12px] text-faint">{ago(a.createdAt)}</span>
              </div>
            ))
          ) : (
            <EmptyState emoji="🔧" title="No changes yet" body="Settings changes from Discord and here show up in this list." />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Leaders title="Top chatters" emoji="⭐" rows={data.topLevels.map((r) => ({ user: r.user, main: `Level ${r.level}`, sub: `${n(r.messages)} messages` }))} empty="Turn on Leveling to start tracking XP." />
        <Leaders title="Top salvagers" emoji="🔧" rows={data.topPlayers.map((r) => ({ user: r.user, main: `Level ${r.level}`, sub: `${n(r.xp)} game XP` }))} empty="Nobody has played Salvage here yet." />
      </div>
    </div>
  );
}

function Leaders({ title, emoji, rows, empty }: { title: string; emoji: string; rows: Array<{ user: Overview['topLevels'][number]['user']; main: string; sub: string }>; empty: string }) {
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <Panel title={title} emoji={emoji}>
      {rows.length ? (
        rows.map((r, i) => (
          <div key={r.user.id} className="flex items-center gap-3 py-2.5">
            <span className="w-6 text-center font-mono text-[13px] text-faint">{i < 3 ? <Emoji e={medal[i]!} className="size-[18px]" /> : i + 1}</span>
            <Avatar src={r.user.avatar} name={r.user.name} className="size-8" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.user.name}</span>
            <span className="text-right">
              <span className="block text-[13px] font-bold">{r.main}</span>
              <span className="block text-[11.5px] text-faint">{r.sub}</span>
            </span>
          </div>
        ))
      ) : (
        <EmptyState emoji={emoji} title="Nothing here yet" body={empty} />
      )}
    </Panel>
  );
}

/* ───────────────────────── Page ───────────────────────── */

function GuildArea() {
  const { guildId, section = '' } = useParams<{ guildId: string; section?: string }>();
  const activeSection = section.split('?')[0] ?? '';
  const overview = useQuery<Overview>({ queryKey: ['/api/guilds', guildId] });

  if (overview.isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-5 pt-28 lg:grid-cols-[260px_1fr]">
        <Skeleton className="h-[520px] rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-16 w-80" />
          <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (overview.error || !overview.data) {
    const e = overview.error;
    return (
      <div className="mx-auto max-w-xl px-5 pt-36">
        <Glass className="rounded-3xl">
          <EmptyState
            emoji={e instanceof ApiError && e.status === 403 ? '🔒' : '🔍'}
            title={e instanceof ApiError && e.status === 403 ? "You can't manage this server" : 'Server not found'}
            body={e instanceof ApiError ? e.message : 'Something went wrong.'}
            action={<Link href="/dashboard" className={buttonClass('glass')}>Back to servers</Link>}
          />
        </Glass>
      </div>
    );
  }

  const valid = activeSection === '' || activeSection === 'history' || SECTIONS.some((s) => s.id === activeSection);
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-start gap-6 px-5 pb-28 pt-24 sm:pt-28 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar guild={overview.data.guild} active={activeSection} />
      <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="min-w-0">
        <Suspense fallback={<BrandSpinner />}>
          {!valid ? (
            <Glass className="rounded-3xl"><EmptyState emoji="🗺️" title="That page doesn't exist" body="Pick a section from the menu." /></Glass>
          ) : activeSection === '' ? (
            <OverviewPage data={overview.data} />
          ) : activeSection === 'history' ? (
            <HistoryPage guildId={guildId} />
          ) : (
            <SettingsPage guildId={guildId} section={activeSection as SectionId} />
          )}
        </Suspense>
      </motion.div>
    </div>
  );
}

export default function Guild() {
  const [location] = useLocation();
  const { guildId = '', section = '' } = useParams<{ guildId: string; section?: string }>();
  const activeSection = section.split('?')[0] ?? '';
  return (
    <RequireLogin next={location}>
      {activeSection === 'transcripts' ? <TicketTranscriptsPage guildId={guildId} /> : <GuildArea />}
    </RequireLogin>
  );
}
