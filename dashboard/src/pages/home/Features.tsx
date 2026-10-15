import { AnimatePresence, motion, useInView } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Container, DButton, DiscordWindow, DSelect, Message, Row, Section, Separator, Text, Title } from '@/components/discord';
import { Eyebrow, Reveal } from '@/components/Reveal';
import { Emoji } from '@/components/ui';
import { cn, twemoji } from '@/lib/utils';

interface Chapter {
  id: string;
  emoji: string;
  label: string;
  title: string;
  body: string;
  points: string[];
  channel: string;
  mock: ReactNode;
}

function RankMini() {
  return (
    <div className="flex max-w-[420px] items-center gap-4 rounded-[10px] bg-[#111014] p-4 font-[Poppins,Satoshi,sans-serif] text-white">
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[#3b82f6] text-[22px] font-bold ring-4 ring-rust-500">N</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-[18px] font-bold">Nadia</p>
          <p className="text-[12px] text-[#8b8b9a]">
            RANK <span className="text-[18px] font-bold text-white">#4</span>
          </p>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-[#8b8b9a]">
          <span className="font-semibold text-white">Level 12</span>
          <span>1,240 / 1,800 XP</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#2a2a33]">
          <motion.div className="h-full rounded-full bg-rust-500" initial={{ width: '20%' }} whileInView={{ width: '69%' }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      </div>
    </div>
  );
}

const CHAPTERS: Chapter[] = [
  {
    id: 'moderation',
    emoji: '🛡️',
    label: 'Moderation',
    title: 'Every action leaves a paper trail.',
    body: 'Warn, timeout, kick and ban with one command. Each one becomes a numbered case, logged to your staff channel with buttons to fix the reason or undo it.',
    points: ['Case history for every member', 'Optional DMs so members know why', 'Report message from the right-click menu'],
    channel: 'mod-log',
    mock: (
      <Message command="/timeout">
        <Container accent="#f87171">
          <Title>🔇 Case #42 · Timeout</Title>
          <Text>{'**Member** @spammer\n**Moderator** @Mira\n**Duration** 1 hour\n**Reason** Mention spam in <#general>'}</Text>
          <Separator />
          <Row>
            <DButton emoji="📝">Edit reason</DButton>
            <DButton style="danger">Undo timeout</DButton>
          </Row>
          <Text small>Member was sent a DM · Today at 9:41 AM</Text>
        </Container>
      </Message>
    ),
  },
  {
    id: 'automod',
    emoji: '🤖',
    label: 'AutoMod',
    title: 'Spam is blocked before anyone sees it.',
    body: "Clanky sets up Discord's own AutoMod for you: invite links, mention spam, spam and your blocked words. Messages are stopped by Discord itself, even if the bot is offline.",
    points: ['Native Discord rules, no lag', 'Wildcard blocked words', 'Alerts in the channel you pick'],
    channel: 'automod-alerts',
    mock: (
      <Message>
        <Container accent="#f5c542">
          <Title>🚫 Blocked a message</Title>
          <Text>{'From @freenitro.lol in <#general>'}</Text>
          <div className="rounded-md border-l-2 border-dc-muted/40 bg-black/20 px-3 py-2 text-[13.5px] text-dc-muted">free nitro here 👉 discord-gift.xyz</div>
          <Text small>Rule: Clanky · Blocked words</Text>
          <Row>
            <DButton emoji="🔇">Timeout</DButton>
            <DButton emoji="🔨" style="danger">Ban</DButton>
            <DButton>Dismiss</DButton>
          </Row>
        </Container>
      </Message>
    ),
  },
  {
    id: 'tickets',
    emoji: '🎫',
    label: 'Tickets',
    title: 'Support that stays private.',
    body: 'Create up to three entry panels with tailored intake questions and routing. Answers stay with the ticket, while staff can claim, close, and transcript the conversation.',
    points: ['Up to 3 panels and 10 shared topics', 'Custom questions with panel-specific routing', 'Saved answers and in-place panel updates'],
    channel: 'help-desk',
    mock: (
      <>
        <Message>
          <Container>
            <Title>🎫 Need help?</Title>
            <Text>Press the button below to open a private ticket with our team.</Text>
            <DSelect placeholder="Pick a topic" />
            <Row>
              <DButton style="success" emoji="📥">Open ticket</DButton>
            </Row>
          </Container>
        </Message>
        <Message time="Today at 9:42 AM">
          <Container accent="#4ade80">
            <Text>{'**Ticket #58** · General support\nHi @Kofi, thanks for reaching out. Someone from the team will be with you soon.'}</Text>
            <Row>
              <DButton emoji="📌">Claim</DButton>
              <DButton emoji="🔒" style="danger">Close</DButton>
            </Row>
          </Container>
        </Message>
      </>
    ),
  },
  {
    id: 'welcome',
    emoji: '👋',
    label: 'Welcome',
    title: 'Say hi like you mean it.',
    body: 'Greet every new member with your own message, give them roles automatically, and say goodbye when someone leaves.',
    points: ['Placeholders like {user} and {count}', 'Up to 5 auto roles', 'Leave messages too'],
    channel: 'welcome',
    mock: (
      <Message>
        <Container>
          <Section thumb={<span className="grid size-[72px] place-items-center rounded-full bg-[#eb459e] text-[28px] font-bold text-white">J</span>}>
            <Title>👋 Welcome!</Title>
            <Text>{'Welcome to **Rusty Bolts HQ**, @Juno! You are member **#1,285** 🎉'}</Text>
          </Section>
          <Separator />
          <Text small>Juno got the Member role</Text>
        </Container>
      </Message>
    ),
  },
  {
    id: 'leveling',
    emoji: '⭐',
    label: 'Leveling',
    title: 'Chat more, unlock more.',
    body: 'Members earn XP for talking. Level-ups get a shout-out and can unlock roles. Rank cards and leaderboards are real images.',
    points: ['Role rewards at any level', 'XP range and cooldown you control', 'Ignore spam channels'],
    channel: 'general',
    mock: (
      <>
        <Message>
          <Text>{'GG @Nadia, you reached **level 12**! ⭐'}</Text>
        </Message>
        <Message command="/rank" user="Nadia">
          <RankMini />
        </Message>
      </>
    ),
  },
  {
    id: 'suggestions',
    emoji: '💡',
    label: 'Suggestions',
    title: 'Let the server vote on ideas.',
    body: 'Members post ideas, everyone votes with buttons, and reviewers approve or deny them. Each idea gets its own thread to talk it over.',
    points: ['One vote per member', 'Anonymous mode', 'Discussion threads'],
    channel: 'suggestions',
    mock: (
      <Message command="/suggest" user="Ollie">
        <Container accent="#60a5fa">
          <Title>💡 Suggestion #17</Title>
          <Text>{'**Add a channel for Salvage trades**\nPeople keep posting their shinies in general. A trade channel would keep things tidy.'}</Text>
          <Separator />
          <Text small>Pending review · 27 votes</Text>
          <Row>
            <DButton emoji="👍" style="success">24</DButton>
            <DButton emoji="👎">3</DButton>
            <DButton emoji="🧵">Discuss</DButton>
          </Row>
        </Container>
      </Message>
    ),
  },
];

function ChapterText({ chapter, index, onActive }: { chapter: Chapter; index: number; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);
  return (
    <div ref={ref} className="flex min-h-[78vh] flex-col justify-center py-10 lg:py-0">
      <Reveal>
        <div className="flex items-center gap-3">
          <span className="glass grid size-12 place-items-center rounded-2xl">
            <Emoji e={chapter.emoji} className="size-6" />
          </span>
          <span className="stamp text-muted">
            {String(index + 1).padStart(2, '0')} · {chapter.label}
          </span>
        </div>
        <h3 className="mt-6 text-[clamp(1.9rem,3.4vw,2.8rem)] font-extrabold">{chapter.title}</h3>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">{chapter.body}</p>
        <ul className="mt-6 space-y-2.5">
          {chapter.points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-[15px]">
              <span className="size-1.5 rotate-45 bg-rust-400" />
              {p}
            </li>
          ))}
        </ul>
      </Reveal>
      {/* On small screens the mockup sits under the text */}
      <Reveal className="mt-8 lg:hidden" delay={0.1}>
        <DiscordWindow channel={chapter.channel}>{chapter.mock}</DiscordWindow>
      </Reveal>
    </div>
  );
}

export function Features() {
  const [active, setActive] = useState(0);
  const chapter = CHAPTERS[active]!;
  return (
    <section id="features" className="relative px-5 pt-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>What Clanky does</Eyebrow>
          <h2 className="mt-4 text-[clamp(2.2rem,4.6vw,3.8rem)] font-extrabold">Everything your server needs. Nothing it doesn't.</h2>
          <p className="mt-4 text-[17px] text-muted">Here's what it looks like in your server. These are the same messages Clanky sends.</p>
        </Reveal>

        <div className="relative mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            {CHAPTERS.map((c, i) => (
              <ChapterText key={c.id} chapter={c} index={i} onActive={setActive} />
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-0 flex h-[100dvh] items-center">
              <div className="relative w-full">
                {/* Progress rail */}
                <div className="absolute -left-8 top-1/2 flex -translate-y-1/2 flex-col gap-3">
                  {CHAPTERS.map((c, i) => (
                    <span key={c.id} className={cn('block w-1 rounded-full transition-all duration-500', i === active ? 'h-8 bg-rust-400' : 'h-3 bg-white/15')} />
                  ))}
                </div>
                <div className="absolute -inset-10 -z-10 rounded-[48px] bg-rust-500/10 blur-3xl" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={chapter.id}
                    initial={{ opacity: 0, y: 30, scale: 0.97, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -24, scale: 0.98, filter: 'blur(8px)' }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <DiscordWindow channel={chapter.channel}>{chapter.mock}</DiscordWindow>
                  </motion.div>
                </AnimatePresence>
                <div className="mt-5 flex items-center gap-2 text-[13px] text-faint">
                  <img src={twemoji(chapter.emoji)} alt="" className="size-4" /> {chapter.label}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
