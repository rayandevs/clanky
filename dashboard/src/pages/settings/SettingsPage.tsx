import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Container, DButton, DiscordWindow, Message, Row, Text, Title } from '@/components/discord';
import { BrandSpinner, ModuleSwitch, Panel, SaveBar, settingsKey, useDraft, useGuildSettings } from '@/components/dash';
import { ChannelPicker, MultiChannelPicker, RolePicker, SingleRolePicker } from '@/components/pickers';
import { useToast } from '@/components/Toast';
import { Button, Emoji, Field, Input, Segmented, Slider, Switch } from '@/components/ui';
import { api, ApiError, queryClient } from '@/lib/api';
import { useMeta } from '@/lib/hooks';
import { LOG_EVENTS, RULE_KINDS, type GuildSettings, type LogEvent, type RuleKind, type SectionId, type SettingsPayload } from '@/lib/types';
import { cn, hex, MODULE_EMOJI } from '@/lib/utils';
import { MessagePreview, OffNotice, SectionHeader, TemplateInput, WordList } from './shared';
import TicketsSettings from './TicketsSettings';

type Props = { guildId: string; data: SettingsPayload };

const fill = (template: string, values: Record<string, string>) => Object.entries(values).reduce((t, [k, v]) => t.replaceAll(k, v), template);

function useAccent(data: SettingsPayload) {
  return hex(data.settings.general.accentColor);
}

/* ───────────────────────── General ───────────────────────── */

const PRESETS = [0xe2702f, 0xf5c542, 0x4ade80, 0x2dd4bf, 0x60a5fa, 0x5865f2, 0xc084fc, 0xf472b6];

function General({ guildId, data }: Props) {
  const d = useDraft(guildId, 'general', data.settings.general);
  const { data: meta } = useMeta();
  if (!d.draft) return null;
  const v = d.draft;
  const color = hex(v.accentColor);
  return (
    <>
      <SectionHeader emoji="⚙️" title="General" description="How Clanky looks in your server, and which modules are on." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Panel title="Accent color" description="Used on the side of every Clanky message and on image cards.">
          <div className="py-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use ${hex(c)}`}
                  onClick={() => d.set('accentColor', c)}
                  className={cn('size-9 rounded-xl ring-offset-2 ring-offset-ink transition-transform hover:scale-110', v.accentColor === c && 'ring-2 ring-white')}
                  style={{ background: hex(c) }}
                />
              ))}
              <label className="relative ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-line bg-black/25 pl-1.5 pr-3 font-mono text-[13px]">
                <input type="color" value={color} onChange={(e) => d.set('accentColor', parseInt(e.target.value.slice(1), 16))} className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0" data-testid="input-accent" />
                {color.toUpperCase()}
              </label>
            </div>
          </div>
          <Field label="Update notes" description="Clanky posts a short “What's new” here after it updates.">
            <ChannelPicker value={v.updatesChannelId} onChange={(x) => d.set('updatesChannelId', x)} channels={data.resources.channels} placeholder="Don't post updates" testId="picker-updates" />
          </Field>
        </Panel>
        <div>
          <p className="stamp mb-2 text-muted">Preview</p>
          <DiscordWindow channel="general">
            <Message command="/about">
              <Container accent={color}>
                <Title>🤖 About Clanky</Title>
                <Text>A friendly helper for moderation, support, roles, leveling and more.</Text>
                <Row>
                  <DButton emoji="✨">What's new</DButton>
                </Row>
              </Container>
            </Message>
          </DiscordWindow>
        </div>
      </div>
      <Panel title="Modules" description="Turn whole features on or off. These save right away.">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 sm:grid-cols-2">
          {(meta?.modules ?? [])
            .filter((m) => m.toggleable)
            .map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-line py-3">
                <Emoji e={MODULE_EMOJI[m.emoji] ?? '⚙️'} className="size-5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{m.name}</p>
                  <p className="truncate text-[12.5px] text-muted">{m.description}</p>
                </div>
                <ModuleSwitch guildId={guildId} id={m.id} enabled={(data.settings[m.id] as { enabled: boolean }).enabled} label={m.name} />
              </div>
            ))}
        </div>
      </Panel>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── Moderation ───────────────────────── */

function Moderation({ guildId, data }: Props) {
  const d = useDraft(guildId, 'moderation', data.settings.moderation);
  if (!d.draft) return null;
  const v = d.draft;
  const ch = data.resources.channels;
  return (
    <>
      <SectionHeader emoji="🛡️" title="Moderation" description="Warn, timeout, kick and ban, with a case for every action." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <Panel title="Channels">
          <Field label="Mod log" description="Every case is posted here, with buttons to edit or undo it.">
            <ChannelPicker value={v.logChannelId} onChange={(x) => d.set('logChannelId', x)} channels={ch} testId="picker-mod-log" />
          </Field>
          <Field label="Reports" description="Where Report message (right-click menu) sends reports.">
            <ChannelPicker value={v.reportsChannelId} onChange={(x) => d.set('reportsChannelId', x)} channels={ch} testId="picker-reports" />
          </Field>
        </Panel>
        <Panel title="Rules">
          <Field inline label="DM members" description="Tell members why they were warned, timed out, kicked or banned.">
            <Switch checked={v.dmOnAction} onChange={(x) => d.set('dmOnAction', x)} label="DM members" testId="switch-dm" />
          </Field>
          <Field inline label="Require a reason" description="Moderators must give a reason for every action.">
            <Switch checked={v.requireReason} onChange={(x) => d.set('requireReason', x)} label="Require a reason" testId="switch-reason" />
          </Field>
        </Panel>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── AutoMod ───────────────────────── */

const RULES: Record<RuleKind, { emoji: string; name: string; body: string }> = {
  invites: { emoji: '🔗', name: 'Invite links', body: 'Blocks links to other Discord servers.' },
  mentionSpam: { emoji: '📣', name: 'Mention spam', body: 'Blocks messages with too many mentions and times the sender out for 5 minutes.' },
  spam: { emoji: '🚫', name: 'Spam', body: "Uses Discord's own spam detection." },
  keywords: { emoji: '📝', name: 'Blocked words', body: 'Blocks messages with words from your list.' },
};

function Rules({ guildId, data }: Props) {
  const toast = useToast();
  const [pending, setPending] = useState<RuleKind | null>(null);
  const toggle = useMutation({
    mutationFn: ({ kind, enabled }: { kind: RuleKind; enabled: boolean }) => api<{ settings: GuildSettings; rules: Record<RuleKind, boolean> }>('POST', `/api/guilds/${guildId}/automod/${kind}`, { enabled }),
    onMutate: ({ kind }) => setPending(kind),
    onSettled: () => setPending(null),
    onSuccess: ({ settings, rules }, { kind, enabled }) => {
      queryClient.setQueryData<SettingsPayload>(settingsKey(guildId), (old) => (old ? { ...old, settings, automod: { ...old.automod, rules } } : old));
      toast(`${RULES[kind].name} ${enabled ? 'is on' : 'is off'}.`);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not change that rule.', 'bad'),
  });
  const can = data.automod.canManage;
  return (
    <Panel title="Rules" description="These are real Discord AutoMod rules. They save right away and work even if Clanky is offline.">
      {!can && <p className="my-3 rounded-xl border border-hazard/30 bg-hazard/[0.06] px-3.5 py-2.5 text-[13.5px] text-hazard">Clanky needs the Manage Server permission to manage AutoMod rules.</p>}
      <div className="grid gap-3 py-4 sm:grid-cols-2">
        {RULE_KINDS.map((kind) => {
          const on = data.automod.rules?.[kind] ?? false;
          return (
            <div key={kind} className={cn('flex gap-3 rounded-2xl border p-4 transition-colors', on ? 'border-rust-400/30 bg-rust-500/[0.07]' : 'border-line bg-black/20')}>
              <Emoji e={RULES[kind].emoji} className="mt-0.5 size-6" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{RULES[kind].name}</p>
                <p className="text-[12.5px] leading-snug text-muted">{RULES[kind].body}</p>
              </div>
              <Switch checked={on} disabled={!can || pending === kind} onChange={(enabled) => toggle.mutate({ kind, enabled })} label={RULES[kind].name} testId={`switch-rule-${kind}`} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Automod({ guildId, data }: Props) {
  const d = useDraft(guildId, 'automod', data.settings.automod);
  if (!d.draft) return null;
  const v = d.draft;
  return (
    <>
      <SectionHeader emoji="🤖" title="AutoMod" description="Stop invites, spam and bad words before anyone sees them." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <Rules guildId={guildId} data={data} />
        <Panel title="Words and limits" description="Saved with the button below. Active rules update automatically.">
          <Field label="Blocked words">
            <WordList value={v.blockedWords} onChange={(x) => d.set('blockedWords', x)} max={100} maxLength={60} testId="input-word" />
          </Field>
          <Field label="Mention limit" description="Most mentions allowed in one message.">
            <Slider value={v.mentionLimit} onChange={(x) => d.set('mentionLimit', x)} min={2} max={50} testId="slider-mentions" />
          </Field>
          <Field label="Alerts channel" description="Discord posts a note here when it blocks something.">
            <ChannelPicker value={v.alertChannelId} onChange={(x) => d.set('alertChannelId', x)} channels={data.resources.channels} placeholder="No alerts" testId="picker-alerts" />
          </Field>
        </Panel>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── Logging ───────────────────────── */

const EVENT_INFO: Record<LogEvent, { emoji: string; label: string }> = {
  messageDelete: { emoji: '🗑️', label: 'Deleted messages' },
  messageEdit: { emoji: '📝', label: 'Edited messages' },
  memberJoin: { emoji: '📥', label: 'Members joining' },
  memberLeave: { emoji: '👋', label: 'Members leaving' },
  memberRoles: { emoji: '🎭', label: 'Role changes' },
  nickname: { emoji: '🏷️', label: 'Nickname changes' },
};

function Logging({ guildId, data }: Props) {
  const d = useDraft(guildId, 'logging', data.settings.logging);
  if (!d.draft) return null;
  const v = d.draft;
  const toggleEvent = (e: LogEvent) => d.set('events', v.events.includes(e) ? v.events.filter((x) => x !== e) : [...v.events, e]);
  return (
    <>
      <SectionHeader emoji="📋" title="Logging" description="Keep a record of what happens in your server." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <Panel title="Where">
          <Field label="Log channel">
            <ChannelPicker value={v.channelId} onChange={(x) => d.set('channelId', x)} channels={data.resources.channels} testId="picker-log" />
          </Field>
          <Field label="Ignored channels" description="Nothing from these channels is logged.">
            <MultiChannelPicker value={v.ignoredChannelIds} onChange={(x) => d.set('ignoredChannelIds', x)} channels={data.resources.channels} placeholder="None" testId="picker-ignored" />
          </Field>
        </Panel>
        <Panel title="What to log">
          <div className="grid gap-2.5 py-4 sm:grid-cols-2">
            {LOG_EVENTS.map((e) => {
              const on = v.events.includes(e);
              return (
                <button key={e} type="button" onClick={() => toggleEvent(e)} data-testid={`toggle-event-${e}`} className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors', on ? 'border-rust-400/35 bg-rust-500/[0.08]' : 'border-line bg-black/20 hover:border-white/15')}>
                  <Emoji e={EVENT_INFO[e].emoji} className="size-5" />
                  <span className="flex-1 text-[14px] font-medium">{EVENT_INFO[e].label}</span>
                  <span className={cn('grid size-5 place-items-center rounded-md border transition-colors', on ? 'border-rust-400 bg-rust-500' : 'border-line')}>
                    <AnimatePresence>{on && <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} viewBox="0 0 16 16" className="size-3.5"><motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="#1a0f08" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} /></motion.svg>}</AnimatePresence>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── Welcome ───────────────────────── */

const WELCOME_TOKENS = [
  { key: '{user}', label: 'mention' },
  { key: '{username}', label: 'name' },
  { key: '{server}', label: 'server' },
  { key: '{count}', label: 'member count' },
];

function Welcome({ guildId, data }: Props) {
  const d = useDraft(guildId, 'welcome', data.settings.welcome);
  const accent = useAccent(data);
  if (!d.draft) return null;
  const v = d.draft;
  const sample = { '{user}': '@Juno', '{username}': 'juno', '{server}': 'your server', '{count}': '1,285' };
  const channel = data.resources.channels.find((c) => c.id === v.channelId)?.name ?? 'welcome';
  return (
    <>
      <SectionHeader emoji="👋" title="Welcome" description="Greet new members and give them roles." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <Panel title="Welcome message">
            <Field label="Channel">
              <ChannelPicker value={v.channelId} onChange={(x) => d.set('channelId', x)} channels={data.resources.channels} testId="picker-welcome" />
            </Field>
            <Field label="Message">
              <TemplateInput value={v.message} onChange={(x) => d.set('message', x)} placeholders={WELCOME_TOKENS} maxLength={1000} testId="input-welcome-message" />
            </Field>
            <Field inline label="Show their avatar" description="Adds the new member's picture next to the message.">
              <Switch checked={v.showAvatar} onChange={(x) => d.set('showAvatar', x)} label="Show avatar" />
            </Field>
          </Panel>
          <MessagePreview text={fill(v.message, sample)} channel={channel} accent={accent} avatar={v.showAvatar} />
        </div>
        <Panel title="Auto roles" description="Given to every new member. Roles above Clanky's role can't be picked.">
          <div className="py-4">
            <RolePicker value={v.autoRoleIds} onChange={(x) => d.set('autoRoleIds', x)} roles={data.resources.roles} max={5} assignableOnly placeholder="No auto roles" testId="picker-autoroles" />
          </div>
        </Panel>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <Panel title="Leave message" action={<Switch checked={v.leaveEnabled} onChange={(x) => d.set('leaveEnabled', x)} label="Leave messages" testId="switch-leave" />}>
            <Field label="Message" description="Posted in the same channel when someone leaves.">
              <TemplateInput value={v.leaveMessage} onChange={(x) => d.set('leaveMessage', x)} placeholders={WELCOME_TOKENS.filter((t) => t.key !== '{user}')} maxLength={1000} />
            </Field>
          </Panel>
          {v.leaveEnabled && <MessagePreview text={fill(v.leaveMessage, sample)} channel={channel} accent={accent} />}
        </div>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── Tickets ───────────────────────── */

/* ───────────────────────── Suggestions ───────────────────────── */

function Suggestions({ guildId, data }: Props) {
  const d = useDraft(guildId, 'suggestions', data.settings.suggestions);
  if (!d.draft) return null;
  const v = d.draft;
  return (
    <>
      <SectionHeader emoji="💡" title="Suggestions" description="Members share ideas and vote on them." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <Panel title="Setup">
          <Field label="Suggestions channel" description="Where /suggest posts new ideas.">
            <ChannelPicker value={v.channelId} onChange={(x) => d.set('channelId', x)} channels={data.resources.channels} testId="picker-suggestions" />
          </Field>
          <Field label="Reviewer roles" description="Can approve, deny or mark ideas as done.">
            <RolePicker value={v.reviewerRoleIds} onChange={(x) => d.set('reviewerRoleIds', x)} roles={data.resources.roles} max={10} testId="picker-reviewers" />
          </Field>
          <Field inline label="Anonymous" description="Hide who posted each idea.">
            <Switch checked={v.anonymous} onChange={(x) => d.set('anonymous', x)} label="Anonymous" />
          </Field>
          <Field inline label="Discussion threads" description="Open a thread under each idea.">
            <Switch checked={v.createThreads} onChange={(x) => d.set('createThreads', x)} label="Threads" />
          </Field>
        </Panel>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── Leveling ───────────────────────── */

const fmtSeconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`);

function Leveling({ guildId, data }: Props) {
  const d = useDraft(guildId, 'leveling', data.settings.leveling);
  const accent = useAccent(data);
  if (!d.draft) return null;
  const v = d.draft;
  const sortedRewards = v.rewards;
  return (
    <>
      <SectionHeader emoji="⭐" title="Leveling" description="Members earn XP by chatting and unlock roles." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <Panel title="Level-up message">
            <Field label="Where to announce">
              <Segmented value={v.announce} onChange={(x) => d.set('announce', x)} options={[{ value: 'off', label: 'Off' }, { value: 'current', label: 'Same channel' }, { value: 'channel', label: 'One channel' }]} testId="segment-announce" />
            </Field>
            {v.announce === 'channel' && (
              <Field label="Announcement channel">
                <ChannelPicker value={v.announceChannelId} onChange={(x) => d.set('announceChannelId', x)} channels={data.resources.channels} testId="picker-levelup" />
              </Field>
            )}
            {v.announce !== 'off' && (
              <Field label="Message">
                <TemplateInput value={v.message} onChange={(x) => d.set('message', x)} placeholders={[{ key: '{user}', label: 'mention' }, { key: '{level}', label: 'new level' }]} maxLength={500} testId="input-levelup-message" />
              </Field>
            )}
          </Panel>
          {v.announce !== 'off' && <MessagePreview text={fill(v.message, { '{user}': '@Nadia', '{level}': '12' })} channel="general" accent={accent} />}
        </div>
        <Panel title="XP" description="Each message earns a random amount between min and max.">
          <Field label="Min XP per message">
            <Slider value={v.xpMin} onChange={(x) => (d.set('xpMin', x), x > v.xpMax && d.set('xpMax', Math.min(200, x)))} min={1} max={100} />
          </Field>
          <Field label="Max XP per message">
            <Slider value={v.xpMax} onChange={(x) => d.set('xpMax', Math.max(x, v.xpMin))} min={1} max={200} />
          </Field>
          <Field label="Cooldown" description={`Members earn XP at most once every ${fmtSeconds(v.cooldownSeconds)}.`}>
            <Slider value={v.cooldownSeconds} onChange={(x) => d.set('cooldownSeconds', x)} min={0} max={600} step={5} suffix="s" />
          </Field>
          <Field label="No-XP channels">
            <MultiChannelPicker value={v.ignoredChannelIds} onChange={(x) => d.set('ignoredChannelIds', x)} channels={data.resources.channels} placeholder="None" />
          </Field>
        </Panel>
        <Panel
          title="Role rewards"
          description="Members get these roles when they reach a level."
          action={
            <Button size="sm" disabled={v.rewards.length >= 20} onClick={() => d.set('rewards', [...v.rewards, { level: (v.rewards.at(-1)?.level ?? 0) + 5, roleId: '' }])} data-testid="button-add-reward">
              <Plus className="size-3.5" /> Add reward
            </Button>
          }
        >
          {sortedRewards.length === 0 && <p className="py-5 text-[14px] text-faint">No rewards yet.</p>}
          {sortedRewards.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <span className="stamp w-12 text-muted">Level</span>
              <Input type="number" min={1} max={500} value={r.level} onChange={(e) => d.set('rewards', v.rewards.map((x, j) => (j === i ? { ...x, level: Math.max(1, Math.min(500, Number(e.target.value) || 1)) } : x)))} className="w-24 font-mono" data-testid={`input-reward-level-${i}`} />
              <div className="flex-1">
                <SingleRolePicker value={r.roleId || null} onChange={(roleId) => d.set('rewards', v.rewards.map((x, j) => (j === i ? { ...x, roleId } : x)))} roles={data.resources.roles} testId={`picker-reward-role-${i}`} />
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove reward" onClick={() => d.set('rewards', v.rewards.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Field inline label="Keep old rewards" description="Off means members only keep their highest reward role.">
            <Switch checked={v.stackRewards} onChange={(x) => d.set('stackRewards', x)} label="Keep old rewards" />
          </Field>
        </Panel>
      </OffNotice>
      <SaveBar
        dirty={d.dirty}
        saving={d.saving}
        // Drop unfinished rows instead of failing validation.
        onSave={() => d.save((x) => ({ ...x, rewards: x.rewards.filter((r) => r.roleId) }))}
        onReset={d.reset}
      />
    </>
  );
}

/* ───────────────────────── Games ───────────────────────── */

function Games({ guildId, data }: Props) {
  const d = useDraft(guildId, 'games', data.settings.games);
  if (!d.draft) return null;
  const v = d.draft;
  return (
    <>
      <SectionHeader emoji="🎮" title="Games" description="Salvage: dig up loot, level up and collect. Progress is global." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <Panel title="Where people can play">
          <Field label="Game channels" description="Leave empty to allow games in every channel.">
            <MultiChannelPicker value={v.channelIds} onChange={(x) => d.set('channelIds', x)} channels={data.resources.channels} placeholder="Every channel" testId="picker-game-channels" />
          </Field>
        </Panel>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
    </>
  );
}

/* ───────────────────────── Router ───────────────────────── */

const FORMS: Partial<Record<SectionId, (p: Props) => React.ReactNode>> = {
  general: General,
  moderation: Moderation,
  automod: Automod,
  logging: Logging,
  welcome: Welcome,
  tickets: TicketsSettings,
  suggestions: Suggestions,
  leveling: Leveling,
  games: Games,
};

export default function SettingsPage({ guildId, section }: { guildId: string; section: SectionId }) {
  const { data, isLoading, error } = useGuildSettings(guildId);
  if (isLoading) return <BrandSpinner />;
  if (error || !data) return <p className="text-bad">{(error as Error)?.message ?? 'Could not load settings.'}</p>;
  const Form = FORMS[section];
  if (!Form) return null;
  return (
    <div className="space-y-5" key={section}>
      <Form guildId={guildId} data={data} />
    </div>
  );
}
