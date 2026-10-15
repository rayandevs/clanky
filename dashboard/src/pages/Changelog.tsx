import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Glass } from '@/components/Glass';
import { Eyebrow, Reveal } from '@/components/Reveal';
import { Badge, Emoji, Skeleton } from '@/components/ui';
import { useMeta } from '@/lib/hooks';
import type { Release, Version } from '@/lib/types';

function Track({ title, emoji, version, releases, tone }: { title: string; emoji: string; version?: Version; releases: Release[]; tone: 'rust' | 'info' }) {
  return (
    <div>
      <Glass className="flex items-center gap-3 rounded-2xl p-4">
        <Emoji e={emoji} className="size-7" />
        <div className="flex-1">
          <p className="text-[16px] font-bold">{title}</p>
          <p className="text-[12.5px] text-muted">{version ? `${version.codename} · ${version.label}` : ' '}</p>
        </div>
        {version && <Badge tone={tone}>v{version.raw}</Badge>}
      </Glass>
      <ol className="relative mt-5 space-y-4 border-l border-line pl-6">
        {releases.map((r, i) => (
          <motion.li key={r.version} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="relative">
            <span className={`absolute -left-[31px] top-5 size-3 rounded-full ring-4 ring-ink ${i === 0 ? 'bg-rust-400' : 'bg-white/20'}`} />
            <Glass className="rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12.5px] text-rust-300">v{r.version}</span>
                <span className="text-[12px] text-faint">{new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <p className="mt-1.5 text-[17px] font-bold">{r.title}</p>
              <ul className="mt-2 space-y-1 text-[14px] text-muted">
                {r.highlights.map((h) => (
                  <li key={h} className="flex gap-2"><span className="text-rust-400">•</span>{h.replaceAll('`', '')}</li>
                ))}
              </ul>
            </Glass>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

export default function Changelog() {
  const { data } = useQuery<{ bot: Release[]; dashboard: Release[] }>({ queryKey: ['/api/changelog'] });
  const { data: meta } = useMeta();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-32">
      <Reveal>
        <Eyebrow>Changelog</Eyebrow>
        <h1 className="mt-3 text-[clamp(2.2rem,4.4vw,3.4rem)] font-extrabold">What's new</h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">The bot and the dashboard update on their own schedules, so each has its own version.</p>
      </Reveal>
      {!data ? (
        <div className="mt-10 grid gap-8 lg:grid-cols-2"><Skeleton className="h-96 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <Track title="Clanky bot" emoji="🤖" version={meta?.bot.version} releases={data.bot} tone="rust" />
          <Track title="Dashboard" emoji="🖥️" version={meta?.dashboard.version} releases={data.dashboard} tone="info" />
        </div>
      )}
    </div>
  );
}
