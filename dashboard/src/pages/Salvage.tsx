import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { EmptyState, PageSkeleton, Panel, RequireLogin } from '@/components/dash';
import { Glass } from '@/components/Glass';
import { Eyebrow } from '@/components/Reveal';
import { Badge, buttonClass, CountUp, Emoji, Segmented, Tip } from '@/components/ui';
import { cardUrl } from '@/lib/api';
import type { SalvagePlayer } from '@/lib/types';
import { asset, cn, hex, n } from '@/lib/utils';

type Tab = 'profile' | 'bag' | 'collection';

function Card({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/30 ring-1 ring-line">
      {!loaded && <div className="skeleton aspect-[16/10] w-full" />}
      <motion.img
        key={src}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0, scale: 1.02 }}
        animate={loaded ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn('block w-full', !loaded && 'absolute inset-0')}
        data-testid="img-card"
      />
    </div>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Emoji e={emoji} className="size-5" />
      <span className="flex-1 text-[14px] text-muted">{label}</span>
      <span className="font-mono text-[14px] font-semibold tabular-nums">{typeof value === 'number' ? n(value) : value}</span>
    </div>
  );
}

function SalvageView({ p }: { p: SalvagePlayer }) {
  const [tab, setTab] = useState<Tab>('profile');
  const [zone, setZone] = useState(p.zone.id);
  const pct = Math.min(100, (p.currentXp / Math.max(1, p.neededXp)) * 100);
  const boosts = [
    p.boosts.luck > 0 && { emoji: '🍀', label: 'Luck boost', left: p.boosts.luck },
    p.boosts.xp > 0 && { emoji: '⚡', label: 'XP boost', left: p.boosts.xp },
    p.boosts.bait > 0 && { emoji: '🪱', label: 'Bait', left: p.boosts.bait },
  ].filter(Boolean) as Array<{ emoji: string; label: string; left: number }>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 pb-24 pt-32">
      <Link href="/me" className={buttonClass('ghost', 'sm')}>
        <ArrowLeft className="size-4" /> Account
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Salvage</Eyebrow>
          <h1 className="mt-3 text-[clamp(2.2rem,4.4vw,3.4rem)] font-extrabold">Your scrap pile</h1>
          <p className="mt-1 text-[15px] text-muted">
            {p.title} · {p.tool.name} · {p.rank ? `#${n(p.rank)} worldwide` : 'Not ranked yet'}
          </p>
        </div>
        <Badge tone="rust">Progress is global</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Glass className="rounded-3xl p-5 sm:col-span-1">
          <p className="stamp text-muted">Level</p>
          <p className="mt-2 font-display text-[44px] font-extrabold leading-none"><CountUp value={p.level} /></p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-line">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-[linear-gradient(90deg,#c2571d,#f9a170)]" />
          </div>
          <p className="mt-2 font-mono text-[12px] text-faint">{n(p.currentXp)} / {n(p.neededXp)} XP</p>
        </Glass>
        <Glass className="rounded-3xl p-5">
          <p className="stamp text-muted">Credits</p>
          <p className="mt-2 flex items-center gap-2 font-display text-[44px] font-extrabold leading-none"><Emoji e="🪙" className="size-8" /><CountUp value={p.credits} /></p>
          <p className="mt-4 text-[13px] text-faint">{n(p.lifetimeCredits)} earned all time</p>
        </Glass>
        <Glass className="rounded-3xl p-5">
          <p className="stamp text-muted">Collection</p>
          <p className="mt-2 font-display text-[44px] font-extrabold leading-none"><CountUp value={p.collected} /><span className="text-[22px] text-faint">/{p.collectable}</span></p>
          <p className="mt-4 text-[13px] text-faint">{p.shinies} shiny finds · 1 in {n(p.shinyOdds)} odds</p>
        </Glass>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Glass className="rounded-3xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented value={tab} onChange={setTab} options={[{ value: 'profile', label: 'Profile' }, { value: 'bag', label: 'Bag' }, { value: 'collection', label: 'Collection' }]} testId="segment-card" />
            {tab === 'collection' && (
              <div className="flex flex-wrap gap-1.5">
                {p.zones.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZone(z.id)}
                    data-testid={`button-zone-${z.id}`}
                    className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] transition-colors', zone === z.id ? 'border-rust-400/40 bg-rust-500/15 text-text' : 'border-line text-muted hover:text-text')}
                  >
                    <Emoji e={z.emoji} className="size-3.5" /> {z.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tab + zone} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
              <Card src={cardUrl(tab, { zone: tab === 'collection' ? zone : undefined, v: p.digs })} alt={`Your Salvage ${tab}`} />
            </motion.div>
          </AnimatePresence>
          <p className="mt-3 text-center text-[12.5px] text-faint">Same card you see in Discord with /salvage {tab}.</p>
        </Glass>

        <div className="space-y-5">
          <Panel title="Stats">
            <Stat emoji="⛏️" label="Digs" value={p.digs} />
            <Stat emoji="🔥" label="Streak" value={`${p.streak} days (best ${p.bestStreak})`} />
            <Stat emoji="🤖" label="Golems beaten" value={p.golemWins} />
            <Stat emoji="⏱️" label="Dig cooldown" value={`${p.cooldown}s`} />
            {p.bestFind && (
              <div className="flex items-center gap-3 py-3">
                <img src={asset(`icons/${p.bestFind.icon}.svg`)} alt="" className="size-5" />
                <span className="flex-1 text-[14px] text-muted">Best find</span>
                <span className="text-[14px] font-semibold" style={{ color: hex(p.bestFind.color) }}>{p.bestFind.shiny ? '✦ ' : ''}{p.bestFind.name}</span>
              </div>
            )}
          </Panel>
          {boosts.length > 0 && (
            <Panel title="Active boosts">
              {boosts.map((b) => <Stat key={b.label} emoji={b.emoji} label={b.label} value={`${b.left} digs left`} />)}
            </Panel>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-3">
        <Panel title="Zones" emoji="🗺️">
          {p.zones.map((z) => (
            <div key={z.id} className={cn('flex items-center gap-3 py-3', !z.unlocked && 'opacity-50')}>
              <Emoji e={z.emoji} className="size-5" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{z.name}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${(z.found / z.total) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} className="h-full rounded-full bg-rust-400" />
                </div>
              </div>
              {z.unlocked ? <span className="font-mono text-[12px] text-faint">{z.found}/{z.total}</span> : <span className="flex items-center gap-1 text-[12px] text-faint"><Lock className="size-3" /> Lv {z.level}</span>}
            </div>
          ))}
        </Panel>
        <Panel title="Upgrades" emoji="🔧">
          {p.upgrades.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <Emoji e={u.emoji} className="size-5" />
              <span className="flex-1 text-[14px] font-semibold">{u.name}</span>
              <span className="flex gap-1">
                {Array.from({ length: u.max }, (_, i) => (
                  <span key={i} className={cn('h-2 w-3 rounded-sm', i < u.level ? 'bg-rust-400' : 'bg-white/10')} />
                ))}
              </span>
            </div>
          ))}
        </Panel>
        <Panel title="Badges" emoji="🏅" description={`${p.badges.filter((b) => b.earned).length} of ${p.badges.length} earned`}>
          <div className="grid grid-cols-5 gap-2 py-4">
            {p.badges.map((b) => (
              <Tip key={b.id} content={<><b>{b.name}</b><br />{b.hint}</>}>
                <span className={cn('grid aspect-square place-items-center rounded-xl ring-1 ring-line', b.earned ? 'bg-rust-500/10' : 'bg-black/30 opacity-35 grayscale')} data-testid={`badge-${b.id}`}>
                  <img src={asset(`icons/${b.icon}.svg`)} alt={b.name} className="size-6" />
                </span>
              </Tip>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SalvagePage() {
  const { data, isLoading } = useQuery<{ player: SalvagePlayer | null }>({ queryKey: ['/api/me/salvage'] });
  if (isLoading) return <PageSkeleton />;
  if (!data?.player) {
    return (
      <div className="mx-auto max-w-xl px-5 pt-36">
        <Glass className="rounded-3xl">
          <EmptyState emoji="⛏️" title="No digs yet" body="Use /salvage dig in any server with Clanky to start your scrap pile." action={<Link href="/me" className={buttonClass('glass')}>Back</Link>} />
        </Glass>
      </div>
    );
  }
  return <SalvageView p={data.player} />;
}

export default function Salvage() {
  return (
    <RequireLogin next="/me/salvage">
      <SalvagePage />
    </RequireLogin>
  );
}
