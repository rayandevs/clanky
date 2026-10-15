import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'wouter';
import { Glass } from '@/components/Glass';
import { LogoMark } from '@/components/Logo';
import { DiscordGlyph } from '@/components/Nav';
import { Eyebrow, Reveal } from '@/components/Reveal';
import { buttonClass, CountUp, Emoji } from '@/components/ui';
import { useMeta } from '@/lib/hooks';
import { MODULE_EMOJI } from '@/lib/utils';
import { Features } from './home/Features';
import { Hero } from './home/Hero';
import { Preview } from './home/Preview';
import { SalvageSection } from './home/SalvageSection';

function Stats() {
  const { data: meta } = useMeta();
  const stats = [
    { label: 'Servers', value: meta?.bot.servers ?? 0 },
    { label: 'Members reached', value: meta?.bot.members ?? 0 },
    { label: 'Slash commands', value: meta?.bot.commands ?? 0 },
    { label: 'Items to dig up', value: meta?.game.items ?? 44 },
  ];
  return (
    <section className="px-5">
      <Reveal className="mx-auto max-w-6xl">
        <Glass className="grid grid-cols-2 divide-line rounded-3xl sm:grid-cols-4 sm:divide-x">
          {stats.map((s) => (
            <div key={s.label} className="px-6 py-7 text-center">
              <p className="font-display text-[clamp(2rem,3.6vw,2.8rem)] font-extrabold leading-none">
                <CountUp value={s.value} />
              </p>
              <p className="stamp mt-2 text-muted">{s.label}</p>
            </div>
          ))}
        </Glass>
      </Reveal>
    </section>
  );
}

function Modules() {
  const { data: meta } = useMeta();
  const modules = meta?.modules ?? [];
  return (
    <section className="px-5 pt-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Eyebrow>The toolbox</Eyebrow>
            <h2 className="mt-4 text-[clamp(2.2rem,4.6vw,3.6rem)] font-extrabold">Twelve modules. Turn on what you need.</h2>
          </div>
          <p className="max-w-sm text-[15px] text-muted">Every module can be switched off, so Clanky only does what your server wants.</p>
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-8% 0px' }}
              transition={{ delay: (i % 4) * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Glass interactive className="h-full rounded-2xl p-5">
                <Emoji e={MODULE_EMOJI[m.emoji] ?? '⚙️'} className="size-8" />
                <p className="mt-4 text-[16px] font-bold">{m.name}</p>
                <p className="mt-1 text-[14px] leading-snug text-muted">{m.description}</p>
              </Glass>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { data: meta } = useMeta();
  return (
    <section className="px-5 pt-32">
      <Reveal className="mx-auto max-w-5xl">
        <Glass strong className="relative overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-16">
          <div className="absolute -top-24 left-1/2 -z-10 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-rust-500/30 blur-3xl" />
          <motion.div initial={{ rotate: -30, scale: 0.7, opacity: 0 }} whileInView={{ rotate: 0, scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} className="mx-auto w-fit">
            <LogoMark className="size-20 drop-shadow-[0_18px_30px_rgb(226_112_47/0.45)]" animated />
          </motion.div>
          <h2 className="mt-8 text-[clamp(2.2rem,4.8vw,3.8rem)] font-extrabold">Put Clanky to work.</h2>
          <p className="mx-auto mt-4 max-w-md text-[17px] text-muted">Add it to your server, open the dashboard and turn on what you need. It takes about a minute.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={meta?.inviteUrl ?? '#'} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'lg')} data-testid="link-invite-bottom">
              <DiscordGlyph className="size-5" /> Add to Discord
            </a>
            <Link href="/dashboard" className={buttonClass('glass', 'lg', 'group')}>
              Open dashboard <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Glass>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <SalvageSection />
      <Preview />
      <Modules />
      <FinalCta />
    </>
  );
}
