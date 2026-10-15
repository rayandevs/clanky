import { motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { Eyebrow, Reveal } from '@/components/Reveal';
import { Emoji, Switch } from '@/components/ui';
import { cn, MODULE_EMOJI } from '@/lib/utils';

const ROWS = [
  { emoji: '🛡️', name: 'Moderation', on: true },
  { emoji: '🤖', name: 'AutoMod', on: true },
  { emoji: '👋', name: 'Welcome', on: true },
  { emoji: '🎫', name: 'Tickets', on: false },
  { emoji: '⭐', name: 'Leveling', on: true },
  { emoji: '🎮', name: 'Games', on: true },
];

/** A small, living picture of the dashboard. */
export function Preview() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotate = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);
  const [rows, setRows] = useState(ROWS);
  const [typed, setTyped] = useState('');
  const message = 'Welcome to Rusty Bolts HQ, {user}! Grab a shovel 🔧';

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % (message.length + 30);
      setTyped(message.slice(0, Math.min(i, message.length)));
    }, 70);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="px-5 pt-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow className="justify-center">The dashboard</Eyebrow>
          <h2 className="mt-4 text-[clamp(2.2rem,4.6vw,3.8rem)] font-extrabold">Change anything. Watch it apply.</h2>
          <p className="mt-4 text-[17px] text-muted">The dashboard runs inside Clanky itself, so every save reaches your server right away. No restarts, no waiting.</p>
        </Reveal>

        <div ref={ref} className="mt-14" style={{ perspective: 1400 }}>
          <motion.div style={{ rotateX: rotate, scale }} className="origin-top">
            <div className="glass glass-sheen mx-auto max-w-5xl overflow-hidden rounded-[28px] p-2">
              <div className="grid overflow-hidden rounded-[22px] border border-line bg-ink-2/80 md:grid-cols-[220px_1fr]">
                <aside className="hidden border-r border-line p-4 md:block">
                  <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2.5">
                    <LogoMark className="size-8" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold">Rusty Bolts HQ</p>
                      <p className="text-[11px] text-faint">1,284 members</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    {['General', 'Moderation', 'AutoMod', 'Welcome', 'Tickets', 'Leveling', 'Games'].map((name, i) => (
                      <div key={name} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]', i === 3 ? 'bg-rust-500/15 text-text' : 'text-muted')}>
                        <Emoji e={Object.values(MODULE_EMOJI)[[0, 1, 2, 4, 5, 7, 10][i]!]!} className="size-4" />
                        {name}
                      </div>
                    ))}
                  </div>
                </aside>
                <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2">
                  <div>
                    <p className="stamp text-muted">Modules</p>
                    <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-black/20">
                      {rows.map((r, i) => (
                        <div key={r.name} className="flex items-center gap-3 px-4 py-3">
                          <Emoji e={r.emoji} className="size-5" />
                          <span className="flex-1 text-[14px] font-medium">{r.name}</span>
                          <Switch checked={r.on} onChange={(on) => setRows((all) => all.map((x, j) => (j === i ? { ...x, on } : x)))} label={r.name} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="stamp text-muted">Welcome message</p>
                    <div className="mt-3 min-h-[86px] rounded-2xl border border-rust-400/40 bg-black/30 p-4 font-mono text-[13px] leading-relaxed">
                      {typed}
                      <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-rust-400" />
                    </div>
                    <p className="stamp mt-5 text-muted">Live preview</p>
                    <div className="mt-3 rounded-2xl bg-dc-chat p-4">
                      <div className="flex gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1a120e]">
                          <LogoMark className="size-6" />
                        </span>
                        <div className="min-w-0 text-[13.5px] text-dc-text">
                          <p className="font-semibold text-rust-300">
                            Clanky <span className="ml-1 rounded bg-dc-blurple px-1 text-[9px] text-white">APP</span>
                          </p>
                          <div className="relative mt-1 overflow-hidden rounded-md border border-white/[0.06] bg-[#393a41]/60 py-2 pl-3.5 pr-3">
                            <span className="absolute inset-y-0 left-0 w-1 bg-rust-500" />
                            {typed.replace('{user}', '@Juno') || '\u00a0'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-black/30 px-4 py-3">
                      <span className="text-[13px] text-muted">Unsaved changes</span>
                      <span className="rounded-lg bg-[linear-gradient(180deg,#f9a170,#e2702f)] px-3 py-1 text-[12px] font-bold text-[#1a0f08]">Save</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
