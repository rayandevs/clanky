import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { RARITY_COLOR } from '@/components/discord';
import { Eyebrow, Reveal } from '@/components/Reveal';
import { Emoji } from '@/components/ui';
import { twemoji } from '@/lib/utils';

const STEPS = [
  { emoji: '🔧', title: 'Dig', body: 'Press one button. Every few seconds there is something new in the dirt.' },
  { emoji: '💎', title: 'Find', body: '44 items, five rarities and rare shinies worth five times more.' },
  { emoji: '⚡', title: 'Upgrade', body: 'Sell loot, buy tools and upgrades, open crates and unlock new zones.' },
];

const RARITIES = [
  { name: 'Common', odds: '60%', emoji: '🔩', item: 'Rusty Bolt' },
  { name: 'Uncommon', odds: '26%', emoji: '🧲', item: 'Magnet' },
  { name: 'Rare', odds: '10%', emoji: '📻', item: 'Old Radio' },
  { name: 'Epic', odds: '3.2%', emoji: '🦾', item: 'Robot Arm' },
  { name: 'Legendary', odds: '0.8%', emoji: '💠', item: 'Quantum Core' },
] as const;

const ZONES = [
  { emoji: '🏚️', name: 'Scrapyard', level: 1, note: 'Where everyone starts' },
  { emoji: '🌆', name: 'Junk City', level: 10, note: 'Old gadgets everywhere' },
  { emoji: '⚰️', name: 'Robot Graveyard', level: 25, note: 'Retired robots rest here' },
  { emoji: '🌌', name: 'Space Dump', level: 50, note: 'Junk that fell from orbit' },
];

function ZonePath() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <div ref={ref} className="relative mt-16">
      <svg className="absolute left-0 top-[34px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden>
        <line x1="12" y1="1" x2="88" y2="1" stroke="rgb(255 236 220 / 0.1)" strokeWidth="2" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
        <motion.line x1="12" y1="1" x2="88" y2="1" stroke="#e2702f" strokeWidth="2" style={{ pathLength: draw }} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative grid gap-8 md:grid-cols-4">
        {ZONES.map((z, i) => (
          <Reveal key={z.name} delay={i * 0.12} className="flex flex-col items-center text-center">
            <span className="glass glass-sheen grid size-[70px] place-items-center rounded-full">
              <Emoji e={z.emoji} className="size-8" />
            </span>
            <span className="stamp mt-4 text-rust-300">Level {z.level}</span>
            <p className="mt-1 font-display text-[20px] font-extrabold">{z.name}</p>
            <p className="text-[14px] text-muted">{z.note}</p>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export function SalvageSection() {
  return (
    <section id="salvage" className="relative mt-24 overflow-hidden py-28">
      <div className="absolute inset-x-0 top-0 h-3 -skew-y-1 hazard opacity-80" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_20%,rgb(226_112_47/0.16),transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow className="justify-center">The game</Eyebrow>
          <h2 className="mt-4 text-[clamp(2.4rem,5.4vw,4.4rem)] font-extrabold">
            Salvage. The game they'll <span className="text-gradient">open every day.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] text-muted">
            A digging game built into Clanky. Progress follows each player to every server, so the grind never resets.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="glass glass-sheen h-full rounded-3xl p-7 transition-transform duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="grid size-14 place-items-center rounded-2xl bg-black/30 ring-1 ring-line">
                    <Emoji e={s.emoji} className="size-7" />
                  </span>
                  <span className="font-mono text-[40px] font-bold leading-none text-white/[0.07]">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-[26px] font-extrabold">{s.title}</h3>
                <p className="mt-2 text-[15px] text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Rarity ladder */}
        <Reveal className="mt-20">
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="stamp text-muted">Base odds</p>
                <h3 className="mt-2 text-[28px] font-extrabold">How lucky do you feel?</h3>
              </div>
              <p className="flex items-center gap-2 text-[14px] text-muted">
                <img src={twemoji('✨')} alt="" className="size-4" /> 1 in 150 finds is shiny
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {RARITIES.map((r, i) => {
                const color = RARITY_COLOR[r.name];
                return (
                  <motion.div
                    key={r.name}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -6 }}
                    className="group relative overflow-hidden rounded-2xl border bg-black/30 p-4 text-center"
                    style={{ borderColor: `${color}55` }}
                  >
                    <div className="absolute inset-x-0 -bottom-10 h-24 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60" style={{ background: color }} />
                    <img src={twemoji(r.emoji)} alt="" className="relative mx-auto size-14 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
                    <p className="relative mt-3 text-[15px] font-bold">{r.item}</p>
                    <p className="stamp relative mt-1 !text-[10px]" style={{ color }}>
                      {r.name}
                    </p>
                    <p className="relative mt-3 font-mono text-[22px] font-bold">{r.odds}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <ZonePath />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-3 skew-y-1 hazard opacity-80" />
    </section>
  );
}
