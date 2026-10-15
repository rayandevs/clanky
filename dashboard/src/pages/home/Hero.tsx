import { ArrowRight, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { Bolt, RustyBolt } from '@/components/Bolt';
import { Container, DButton, DiscordWindow, FindCard, Message, Row, Text, type FindItem } from '@/components/discord';
import { DiscordGlyph } from '@/components/Nav';
import { buttonClass } from '@/components/ui';
import { useMe, useMeta } from '@/lib/hooks';
import { twemoji } from '@/lib/utils';

const FINDS: FindItem[] = [
  { name: 'Rusty Bolt', emoji: '🔩', rarity: 'Common', xp: 3, worth: 5 },
  { name: 'Old Radio', emoji: '📻', rarity: 'Rare', xp: 15, worth: 80 },
  { name: 'Magnet', emoji: '🧲', rarity: 'Uncommon', xp: 6, worth: 25 },
  { name: 'Robot Arm', emoji: '🦾', rarity: 'Epic', xp: 40, worth: 1_750, shiny: true },
  { name: 'Floppy Disk', emoji: '💾', rarity: 'Rare', xp: 15, worth: 90 },
  { name: 'Quantum Core', emoji: '💠', rarity: 'Legendary', xp: 120, worth: 2_000 },
];

const INTROS: Record<FindItem['rarity'], string> = {
  Common: 'You dug up a **Rusty Bolt**. Every legend starts somewhere.',
  Uncommon: 'Something clinked. Nice find!',
  Rare: '**Rare find!** Your bag is getting heavy.',
  Epic: '✨ **A shiny!** 1 in 150 finds look like this.',
  Legendary: '🎉 **LEGENDARY!** The whole server is jealous.',
};

function DigDemo() {
  const [index, setIndex] = useState(0);
  const [digging, setDigging] = useState(false);
  const [progress, setProgress] = useState(0.52);
  const item = FINDS[index]!;

  const dig = () => {
    if (digging) return;
    setDigging(true);
    setTimeout(() => {
      setIndex((i) => (i + 1) % FINDS.length);
      setProgress((p) => (p + 0.13 > 1 ? 0.08 : p + 0.13));
      setDigging(false);
    }, 650);
  };

  return (
    <DiscordWindow channel="salvage" className="w-full max-w-[560px]">
      <Message command="/salvage dig">
        <Container>
          <AnimatePresence mode="wait">
            <motion.div key={item.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Text>{item.rarity === 'Common' ? INTROS.Common : item.shiny ? INTROS.Epic : INTROS[item.rarity]}</Text>
            </motion.div>
          </AnimatePresence>
          <motion.div animate={digging ? { x: [0, -6, 6, -4, 4, 0], rotate: [0, -0.6, 0.6, 0] } : {}} transition={{ duration: 0.5 }} className="relative">
            <FindCard item={item} progress={progress} />
            <AnimatePresence>
              {digging && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center rounded-[10px] bg-[#111014]/70 backdrop-blur-sm">
                  <motion.img src={twemoji("🔧")} alt="" className="size-14" animate={{ rotate: [0, -35, 25, -35, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <Row>
            <DButton style="success" emoji="🔧" onClick={dig} disabled={digging} testId="button-demo-dig">
              {digging ? 'Digging…' : 'Dig again'}
            </DButton>
            <DButton emoji="🎒">Bag</DButton>
            <DButton emoji="🛒">Shop</DButton>
          </Row>
        </Container>
      </Message>
    </DiscordWindow>
  );
}

export function Hero() {
  const { data: meta } = useMeta();
  const { me } = useMe();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -320]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const spin = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-16 pt-32 sm:pt-40">
      {/* Floating hardware */}
      <motion.div style={{ y: y1, rotate: spin }} className="pointer-events-none absolute left-[47%] top-[24%] -z-10 hidden lg:block">
        <Bolt className="size-12 opacity-60 drop-shadow-[0_20px_30px_rgb(0_0_0/0.6)]" />
      </motion.div>
      <motion.div style={{ y: y2 }} className="pointer-events-none absolute right-[6%] top-[14%] hidden lg:block">
        <RustyBolt className="size-10 rotate-12 opacity-80 blur-[1px]" />
      </motion.div>
      <motion.div style={{ y: y3, rotate: spin }} className="pointer-events-none absolute bottom-[8%] left-[42%] hidden lg:block">
        <RustyBolt className="size-7 opacity-60 blur-[2px]" />
      </motion.div>

      <motion.div style={{ opacity: fade }} className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <span className="glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] text-muted">
              <span className="rounded-full bg-rust-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-rust-300">NEW</span>
              Salvage: image cards for bag, shop and collection
            </span>
          </motion.div>
          <h1 className="mt-6 text-[clamp(2.1rem,9vw,5.4rem)] font-extrabold">
            {['The bot that', 'digs through', 'the noise.'].map((line, i) => (
              <motion.span key={line} className="block overflow-hidden pb-1">
                <motion.span className={`block ${i === 1 ? 'text-gradient' : ''}`} initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ delay: 0.25 + i * 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
                  {line}
                </motion.span>
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 1 }} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted">
            Moderation, AutoMod, tickets, leveling and a digging game your members won't put down. Clanky handles the busywork, and you set it all up right here.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="mt-9 flex flex-wrap gap-3">
            <a href={meta?.inviteUrl ?? '#'} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'lg')} data-testid="link-invite">
              <DiscordGlyph className="size-5" /> Add to Discord
            </a>
            <Link href={me ? '/dashboard' : '/dashboard'} className={buttonClass('glass', 'lg', 'group')} data-testid="link-open-dashboard">
              Open dashboard <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-6 flex items-center gap-2 text-[13px] text-faint">
            <Sparkles className="size-4 text-rust-400" /> Free. Slash commands only. Built on Discord's newest message components.
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 40, rotateX: 12, rotateY: -10 }} animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0 }} transition={{ delay: 0.4, duration: 1.2, ease: [0.16, 1, 0.3, 1] }} style={{ transformPerspective: 1200 }} className="relative flex justify-center lg:justify-end">
          <div className="absolute -inset-8 -z-10 rounded-[40px] bg-rust-500/20 blur-3xl" />
          <DigDemo />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="absolute -bottom-9 right-4 flex items-center gap-2 text-[13px] text-muted">
            <span className="text-rust-300">↑</span> Try the Dig button
          </motion.p>
        </motion.div>
      </motion.div>
    </section>
  );
}
