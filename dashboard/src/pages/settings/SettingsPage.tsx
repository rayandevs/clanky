import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Container, DButton, DiscordWindow, Message, Row, Text, Title } from '@/components/discord';
import { BrandSpinner, ModuleSwitch, Panel, SaveBar, settingsKey, useDraft, useGuildSettings } from '@/components/dash';
import { ChannelPicker, MultiChannelPicker, RolePicker, SingleRolePicker } from '@/components/pickers';
import { useToast } from '@/components/Toast';
import { Button, Emoji, Field, Input, Segmented, Slider, Switch, Textarea } from '@/components/ui';
import { api, ApiError, queryClient, renderWelcomePreview, uploadWelcomeArtwork, welcomeArtworkUrl } from '@/lib/api';
import { useMeta } from '@/lib/hooks';
import { LOG_EVENTS, RULE_KINDS, type GuildSettings, type LogEvent, type RuleKind, type SectionId, type SettingsPayload, type WelcomeEvent, type WelcomeEventSettings } from '@/lib/types';
import { cn, DEMO, hex, MODULE_EMOJI } from '@/lib/utils';
import { MessagePreview, OffNotice, SectionHeader, TemplateInput, WordList } from './shared';
import TicketsSettings from './TicketsSettings';
import LevelingTools from './LevelingTools';
import SuggestionsQueue from './SuggestionsQueue';

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
  { key: '{user}', label: 'member mention' },
  { key: '{username}', label: 'username' },
  { key: '{displayname}', label: 'server display name' },
  { key: '{server}', label: 'server' },
  { key: '{count}', label: 'member count' },
];
const LEAVE_TOKENS = WELCOME_TOKENS;
const WELCOME_FORMATS: Array<{ value: WelcomeEventSettings['format']; label: string }> = [
  { value: 'container', label: 'Container message' },
  { value: 'text', label: 'Plain text' },
  { value: 'text_image', label: 'Message + image' },
  { value: 'image_only', label: 'Image only' },
];
const FORMAT_DESCRIPTION: Record<WelcomeEventSettings['format'], string> = {
  container: 'Posts your message in a Clanky container with the server accent.',
  text: 'Posts only the message text, with no Clanky container or card.',
  text_image: 'Posts the message alongside a generated welcome card.',
  image_only: 'Posts only the generated card, with your message rendered into the image.',
};
const usesWelcomeArtwork = (format: WelcomeEventSettings['format']) => format === 'text_image' || format === 'image_only';

type WelcomeEventEditorProps = {
  event: WelcomeEvent;
  settings: WelcomeEventSettings;
  joinChannelId: string | null;
  channels: SettingsPayload['resources']['channels'];
  accent: string;
  guildId: string;
  artworkUrl?: string;
  artworkVersion?: number;
  hasSavedCustomArtwork: boolean;
  uploading: boolean;
  onChange: (patch: Partial<WelcomeEventSettings>) => void;
  onUploadArtwork: (file: File) => Promise<void>;
};

function WelcomeEventEditor({ event, settings, joinChannelId, channels, accent, guildId, artworkUrl, artworkVersion, hasSavedCustomArtwork, uploading, onChange, onUploadArtwork }: WelcomeEventEditorProps) {
  const isJoin = event === 'join';
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string>();
  const previewUrlRef = useRef<string | null>(null);
  const selectedChannelId = isJoin || settings.channelId !== null ? settings.channelId : joinChannelId;
  const channel = channels.find((item) => item.id === selectedChannelId)?.name ?? (isJoin ? 'welcome' : 'join channel');
  const overrideChannelId = joinChannelId ?? channels.find((item) => item.canSend)?.id ?? null;
  const customArtworkUrl = artworkUrl ?? (settings.artwork.background === 'custom' && hasSavedCustomArtwork && !DEMO ? welcomeArtworkUrl(guildId, event, artworkVersion) : undefined);
  const updateArtwork = (patch: Partial<WelcomeEventSettings['artwork']>) => onChange({ artwork: { ...settings.artwork, ...patch } });
  const previewText = fill(settings.message, {
    '{user}': settings.pingUser ? '@Juno' : 'Juno',
    '{username}': 'juno',
    '{displayname}': 'Juno',
    '{server}': 'your server',
    '{count}': '1,285',
  });
  const imagePreviewMessage = settings.format === 'image_only' ? previewText.replaceAll('@Juno', 'Juno') : '';
  const previewKey = JSON.stringify({ format: settings.format, artwork: settings.artwork, imagePreviewMessage, accent, customArtworkUrl, artworkVersion });
  const customArtwork = settings.artwork.background === 'custom';

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    const releasePreview = () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setCardPreviewUrl(undefined);
    };
    if (!usesWelcomeArtwork(settings.format) || DEMO) {
      releasePreview();
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void renderWelcomePreview(guildId, event, settings, imagePreviewMessage, controller.signal)
        .then((blob) => {
          if (!blob) return;
          const nextUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(nextUrl);
            return;
          }
          const previousUrl = previewUrlRef.current;
          previewUrlRef.current = nextUrl;
          setCardPreviewUrl(nextUrl);
          if (previousUrl) URL.revokeObjectURL(previousUrl);
        })
        .catch(() => {
          if (!controller.signal.aborted) releasePreview();
        });
    }, 450);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [guildId, event, previewKey]);

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <Panel title={`${isJoin ? 'Join' : 'Leave'} message`} description={isJoin ? 'Choose where to greet new members and how the welcome should look.' : 'Set the farewell content and where it should be posted.'}>
          {isJoin ? (
            <Field label="Channel" description="Where Clanky sends join messages.">
              <ChannelPicker value={settings.channelId} onChange={(channelId) => onChange({ channelId })} channels={channels} placeholder="Choose a channel" testId="picker-welcome" />
            </Field>
          ) : (
            <Field label="Channel" description={settings.channelId === null ? 'Using the join channel by default.' : 'This override is used only for leave messages.'}>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={settings.channelId === null ? 'primary' : 'outline'} onClick={() => onChange({ channelId: null })} data-testid="button-leave-use-join-channel">Use join channel</Button>
                  <Button size="sm" variant={settings.channelId !== null ? 'primary' : 'outline'} disabled={!overrideChannelId} onClick={() => onChange({ channelId: overrideChannelId })} data-testid="button-leave-override-channel">Use another channel</Button>
                </div>
                {settings.channelId !== null && <ChannelPicker value={settings.channelId} onChange={(channelId) => onChange({ channelId })} channels={channels} placeholder="Choose a leave channel" testId="picker-leave" />}
              </div>
            </Field>
          )}
          <Field label="Format" description={FORMAT_DESCRIPTION[settings.format]}>
            <Segmented value={settings.format} options={WELCOME_FORMATS} onChange={(format) => onChange({ format })} testId={`segment-welcome-format-${event}`} />
          </Field>
          <Field label="Message" description={settings.format === 'image_only' ? 'Your message is included on the card; keep it short so it fits.' : 'Use placeholders to personalize every message.'}>
            <TemplateInput value={settings.message} onChange={(message) => onChange({ message })} placeholders={isJoin ? WELCOME_TOKENS : LEAVE_TOKENS} maxLength={1000} testId={isJoin ? 'input-welcome-message' : 'input-leave-message'} />
          </Field>
          <Field inline label={isJoin ? 'Mention the new member' : 'Mention the departing member'} description={isJoin ? 'Control whether {user} receives a Discord notification.' : 'A mention can remain visible in server logs, but the member has left the server.'}>
            <Switch checked={settings.pingUser} onChange={(pingUser) => onChange({ pingUser })} label={isJoin ? 'Mention the new member' : 'Mention the departing member'} testId={`switch-welcome-ping-${event}`} />
          </Field>
          <Field inline label="Include bot members" description="Send this event when a bot account joins or leaves too.">
            <Switch checked={settings.includeBots} onChange={(includeBots) => onChange({ includeBots })} label="Include bot members" testId={`switch-welcome-bots-${event}`} />
          </Field>
        </Panel>
        <MessagePreview text={previewText} channel={channel} accent={accent} avatar={settings.artwork.showAvatar} format={settings.format} artwork={settings.artwork} artworkUrl={customArtworkUrl} event={event} cardPreviewUrl={cardPreviewUrl} />
      </div>
      {usesWelcomeArtwork(settings.format) && (
        <Panel title={`${isJoin ? 'Join' : 'Leave'} card artwork`} description="Generated cards can use a built-in look or a server-specific background.">
          <Field label="Card template" description="Choose the layout used for the generated member card.">
            <Segmented value={settings.artwork.template} options={[{ value: 'celebration', label: 'Celebration' }, { value: 'minimal', label: 'Minimal' }, { value: 'soft', label: 'Soft' }]} onChange={(template) => updateArtwork({ template })} testId={`segment-welcome-template-${event}`} />
          </Field>
          <Field label="Background" description="Preset backgrounds are generated by Clanky. Custom backgrounds are uploaded immediately.">
            <Segmented value={settings.artwork.background} options={[{ value: 'preset', label: 'Preset' }, { value: 'custom', label: 'Custom upload' }]} onChange={(background) => updateArtwork({ background })} testId={`segment-welcome-background-${event}`} />
          </Field>
          {customArtwork && (
            <div className="my-4 rounded-2xl border border-line bg-black/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold">Custom card background</p>
                  <p className="mt-1 text-[11px] text-faint">PNG, JPEG, or WebP · up to 4 MiB · normalized to PNG</p>
                </div>
                <label className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-[12px] font-semibold transition-colors hover:bg-white/[0.04]', uploading && 'pointer-events-none opacity-50')}>
                  <Upload className="size-3.5" /> {uploading ? 'Uploading…' : 'Choose image'}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(input) => {
                      const file = input.currentTarget.files?.[0];
                      input.currentTarget.value = '';
                      if (file) void onUploadArtwork(file);
                    }}
                    data-testid={`input-welcome-artwork-${event}`}
                  />
                </label>
              </div>
              {!customArtworkUrl && <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-2 text-[12px] text-faint">Choose an image to preview your custom background.</p>}
            </div>
          )}
          <div className="grid gap-x-5 md:grid-cols-3">
            <Field inline label="Show member avatar" description="Adds the member’s avatar to the card.">
              <Switch checked={settings.artwork.showAvatar} onChange={(showAvatar) => updateArtwork({ showAvatar })} label="Show member avatar" testId={`switch-welcome-avatar-${event}`} />
            </Field>
            <Field inline label="Show member count" description="Displays the current member count.">
              <Switch checked={settings.artwork.showMemberCount} onChange={(showMemberCount) => updateArtwork({ showMemberCount })} label="Show member count" testId={`switch-welcome-member-count-${event}`} />
            </Field>
            <Field inline label="Show server name" description="Displays your server name on the card.">
              <Switch checked={settings.artwork.showServerName} onChange={(showServerName) => updateArtwork({ showServerName })} label="Show server name" testId={`switch-welcome-server-name-${event}`} />
            </Field>
          </div>
        </Panel>
      )}
    </>
  );
}

function Welcome({ guildId, data }: Props) {
  const d = useDraft(guildId, 'welcome', data.settings.welcome);
  const toast = useToast();
  const accent = useAccent(data);
  const [tab, setTab] = useState<WelcomeEvent>('join');
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState<WelcomeEvent | null>(null);
  const [artworkUrls, setArtworkUrls] = useState<Partial<Record<WelcomeEvent, string>>>({});
  const [artworkVersion, setArtworkVersion] = useState<Partial<Record<WelcomeEvent, number>>>({});
  const objectUrls = useRef(new Set<string>());
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  if (!d.draft) return null;
  const v = d.draft;
  const updateEvent = (event: WelcomeEvent, patch: Partial<WelcomeEventSettings>) => d.set(event, { ...v[event], ...patch });
  const errors = [
    ...(v.enabled && !v.join.channelId ? ['Choose a join channel before saving.'] : []),
    ...(v.leaveEnabled && !v.leave.channelId && !v.join.channelId ? ['Choose a join channel or a leave-channel override before enabling leave messages.'] : []),
    ...(['join', 'leave'] as const)
      .filter((event) => usesWelcomeArtwork(v[event].format) && v[event].artwork.background === 'custom' && data.settings.welcome[event].artwork.background !== 'custom' && !artworkVersion[event])
      .map((event) => `Upload a custom ${event} card background before saving.`),
    ...(uploadingArtwork ? ['Wait for the artwork upload to finish before saving.'] : []),
  ];
  const uploadArtwork = async (event: WelcomeEvent, file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      toast('Choose a PNG, JPEG, or WebP image under 4 MiB.', 'bad');
      return;
    }
    const previousUrl = artworkUrls[event];
    const localUrl = URL.createObjectURL(file);
    objectUrls.current.add(localUrl);
    setArtworkUrls((current) => ({ ...current, [event]: localUrl }));
    setUploadingArtwork(event);
    try {
      await uploadWelcomeArtwork(guildId, event, file);
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
        objectUrls.current.delete(previousUrl);
      }
      setArtworkVersion((current) => ({ ...current, [event]: Date.now() }));
      updateEvent(event, { artwork: { ...v[event].artwork, background: 'custom' } });
      toast('Welcome card image uploaded. Save settings to use it.');
    } catch (error) {
      URL.revokeObjectURL(localUrl);
      objectUrls.current.delete(localUrl);
      setArtworkUrls((current) => {
        const next = { ...current };
        if (previousUrl) next[event] = previousUrl;
        else delete next[event];
        return next;
      });
      toast(error instanceof ApiError ? error.message : 'Could not upload that image.', 'bad');
    } finally {
      setUploadingArtwork(null);
    }
  };
  const save = () => {
    setSaveAttempted(true);
    if (errors.length) return;
    d.save();
  };
  const reset = () => {
    d.reset();
    setSaveAttempted(false);
  };

  return (
    <>
      <SectionHeader emoji="👋" title="Welcome" description="Greet new members, say goodbye when they leave, and give them roles." enabled={v.enabled} onToggle={(enabled) => d.set('enabled', enabled)} />
      {(d.error || (saveAttempted && errors.length > 0)) && <div role="alert" className="rounded-2xl border border-bad/25 bg-bad/5 px-4 py-3 text-[13px] text-bad">{d.error ?? errors[0]}</div>}
      <OffNotice show={!v.enabled}>
        <Panel title="Welcome events" description="Configure join and leave messages separately, without leaving the Welcome module." action={tab === 'leave' ? <Switch checked={v.leaveEnabled} onChange={(leaveEnabled) => d.set('leaveEnabled', leaveEnabled)} label="Enable leave messages" testId="switch-leave" /> : undefined}>
          <Field label="Event to configure" description={tab === 'join' ? 'Join messages also control member roles and screening behavior.' : 'Leave messages can use the join channel or their own override.'}>
            <Segmented value={tab} options={[{ value: 'join', label: 'Join' }, { value: 'leave', label: 'Leave' }]} onChange={setTab} testId="segment-welcome-event" />
          </Field>
        </Panel>
        <WelcomeEventEditor
          event={tab}
          settings={v[tab]}
          joinChannelId={v.join.channelId}
          channels={data.resources.channels}
          accent={accent}
          guildId={guildId}
          artworkUrl={artworkUrls[tab]}
          artworkVersion={artworkVersion[tab]}
          hasSavedCustomArtwork={data.settings.welcome[tab].artwork.background === 'custom'}
          uploading={uploadingArtwork === tab}
          onChange={(patch) => updateEvent(tab, patch)}
          onUploadArtwork={(file) => uploadArtwork(tab, file)}
        />
        {tab === 'join' && (
          <Panel title="New-member setup" description="Auto roles always wait for screening to pass. This option also delays the join message.">
            <Field label="Auto roles" description="Given to every new member. Roles above Clanky’s role can’t be picked.">
              <RolePicker value={v.autoRoleIds} onChange={(autoRoleIds) => d.set('autoRoleIds', autoRoleIds)} roles={data.resources.roles} max={5} assignableOnly placeholder="No auto roles" testId="picker-autoroles" />
            </Field>
            <Field inline label="Send after member screening" description="Wait for Discord’s membership screening before sending the join message and assigning auto roles.">
              <Switch checked={v.waitForScreening} onChange={(waitForScreening) => d.set('waitForScreening', waitForScreening)} label="Send after member screening" testId="switch-welcome-screening" />
            </Field>
          </Panel>
        )}
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={save} onReset={reset} />
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
      <SectionHeader emoji="💡" title="Suggestions" description="Collect ideas, moderate them from Discord or this dashboard, and keep members informed." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
      <OffNotice show={!v.enabled}>
        <Panel title="Setup">
          <Field label="Suggestions channel" description="Where /suggest posts new ideas.">
            <ChannelPicker value={v.channelId} onChange={(x) => d.set('channelId', x)} channels={data.resources.channels} testId="picker-suggestions" />
          </Field>
          <Field label="Reviewer roles" description="Can approve, deny or mark ideas as done.">
            <RolePicker value={v.reviewerRoleIds} onChange={(x) => d.set('reviewerRoleIds', x)} roles={data.resources.roles} max={10} testId="picker-reviewers" />
          </Field>
          <Field inline label="Always anonymous" description="Hide submitter names from public suggestion posts. Reviewers can still see authors in the dashboard.">
            <Switch checked={v.anonymous} onChange={(x) => d.set('anonymous', x)} label="Always anonymous" />
          </Field>
          <Field inline label="Let members choose anonymity" description="Adds an optional anonymous choice to /suggest when always-anonymous is off.">
            <Switch checked={v.allowAnonymousChoice} onChange={(x) => d.set('allowAnonymousChoice', x)} label="Allow anonymous choice" />
          </Field>
          <Field inline label="Discussion threads" description="Open a thread under each idea.">
            <Switch checked={v.createThreads} onChange={(x) => d.set('createThreads', x)} label="Threads" />
          </Field>
          <Field label="Categories" description="Optional categories members can choose from when submitting. One per line, up to 10.">
            <Textarea value={v.categories.join('\n')} maxLength={500} onChange={(e) => d.set('categories', [...new Set(e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))].slice(0, 10))} data-testid="input-suggestion-categories" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Open suggestions per member" description="0 disables the limit.">
              <Input type="number" min={0} max={20} value={v.maxOpenPerUser} onChange={(e) => d.set('maxOpenPerUser', Number(e.target.value))} data-testid="input-suggestion-open-limit" />
            </Field>
            <Field label="Member cooldown (seconds)" description="0 disables the cooldown.">
              <Input type="number" min={0} max={604800} value={v.cooldownSeconds} onChange={(e) => d.set('cooldownSeconds', Number(e.target.value))} data-testid="input-suggestion-cooldown" />
            </Field>
          </div>
          <Field label="Reviewer digest" description="A summary of pending ideas; 0 disables it. The first digest is sent when pending ideas exist.">
            <Segmented value={String(v.digestIntervalHours)} options={[{ value: '0', label: 'Off' }, { value: '24', label: 'Daily' }, { value: '168', label: 'Weekly' }]} onChange={(x) => d.set('digestIntervalHours', Number(x) as 0 | 24 | 168)} testId="segmented-suggestion-digest" />
          </Field>
          <Field label="Digest channel" description="Leave empty to send digests to the suggestions channel.">
            <ChannelPicker value={v.digestChannelId} onChange={(x) => d.set('digestChannelId', x)} channels={data.resources.channels} testId="picker-suggestion-digest" />
          </Field>
        </Panel>
      </OffNotice>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => d.save()} onReset={d.reset} />
      <SuggestionsQueue guildId={guildId} />
    </>
  );
}

/* ───────────────────────── Leveling ───────────────────────── */

const fmtSeconds = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`);

function Leveling({ guildId, data }: Props) {
  const d = useDraft(guildId, 'leveling', data.settings.leveling);
  const accent = useAccent(data);
  const [previewRewardLevel, setPreviewRewardLevel] = useState(10);
  if (!d.draft) return null;
  const v = d.draft;
  const sortedRewards = v.rewards.map((reward, index) => ({ reward, index })).sort((a, b) => a.reward.level - b.reward.level);
  const curveScale = v.curvePreset === 'relaxed' ? 0.75 : v.curvePreset === 'challenging' ? 1.5 : 1;
  const curveRequirement = (level: number) => Math.round((5 * level ** 2 + 50 * level + 100) * curveScale);
  const curveTotalXp = (targetLevel: number) => Array.from({ length: targetLevel }, (_, level) => curveRequirement(level)).reduce((sum, amount) => sum + amount, 0);
  const estimatedMessages = (targetLevel: number) => Math.ceil(curveTotalXp(targetLevel) / Math.max(1, (v.xpMin + v.xpMax) / 2));
  const earnedRewardTiers = sortedRewards.map(({ reward }) => reward).filter((reward) => reward.roleId && reward.level <= previewRewardLevel);
  const previewRewardTiers = v.stackRewards ? earnedRewardTiers : earnedRewardTiers.slice(-1);
  const cardThemes = [
    { value: 'midnight' as const, label: 'Midnight', background: 'linear-gradient(120deg,#111118,#201e2b)' },
    { value: 'ember' as const, label: 'Ember', background: 'linear-gradient(120deg,#21130f,#3b2118)' },
    { value: 'forest' as const, label: 'Forest', background: 'linear-gradient(120deg,#0d1c19,#18372e)' },
    { value: 'violet' as const, label: 'Violet', background: 'linear-gradient(120deg,#171321,#30203f)' },
  ];
  return (
    <>
      <SectionHeader emoji="⭐" title="Leveling" description="Tune the XP pace, reward active channels and roles, and style rank cards. All human messages are counted separately from XP." enabled={v.enabled} onToggle={(x) => d.set('enabled', x)} />
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <Panel title="Progression & message rules" description="Choose the pace and decide how long a message must be to earn XP.">
            <Field label="Leveling curve" description="Existing levels and progress are preserved; this pace applies to the next level and future XP.">
              <Segmented value={v.curvePreset} onChange={(x) => d.set('curvePreset', x)} options={[{ value: 'relaxed', label: 'Relaxed' }, { value: 'classic', label: 'Classic' }, { value: 'challenging', label: 'Challenging' }]} testId="segment-level-curve" />
            </Field>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-black/15 p-3 text-center">
              {[1, 10, 25].map((level) => <div key={level}><p className="stamp text-faint">REACH LEVEL {level}</p><p className="mt-1 font-mono text-[13px] font-bold">{curveTotalXp(level).toLocaleString()} XP</p><p className="text-[10px] text-faint">≈ {estimatedMessages(level).toLocaleString()} eligible messages</p></div>)}
            </div>
            <p className="-mt-1 text-[11px] text-faint">Message estimates use the configured average XP and exclude cooldown time and boosts. Existing members keep their current level and progress.</p>
            <Field label="Minimum message length" description="Only affects XP eligibility. Every human message is still counted for activity statistics.">
              <Slider value={v.minMessageLength} onChange={(x) => d.set('minMessageLength', x)} min={0} max={200} step={5} suffix=" chars" testId="slider-level-min-length" />
            </Field>
          </Panel>
          <Panel title="XP multipliers" description="Use the strongest matching role boost and strongest channel boost together, capped at 5×.">
            <p className="stamp mb-1 text-muted">CHANNEL BOOSTS</p>
            {v.channelMultipliers.map((rule, index) => (
              <div key={`channel-${index}`} className="flex items-center gap-2 border-b border-line py-2">
                <div className="min-w-0 flex-1"><ChannelPicker value={rule.channelId || null} onChange={(channelId) => channelId && d.set('channelMultipliers', v.channelMultipliers.map((item, i) => i === index ? { ...item, channelId } : item))} channels={data.resources.channels} placeholder="Choose a channel" /></div>
                <Input aria-label="Channel XP multiplier" type="number" min={1} max={3} step={0.25} value={rule.multiplier} onChange={(event) => d.set('channelMultipliers', v.channelMultipliers.map((item, i) => i === index ? { ...item, multiplier: Math.max(1, Math.min(3, Number(event.target.value) || 1)) } : item))} className="w-20 text-center font-mono" />
                <span className="text-[12px] text-faint">×</span>
                <Button variant="ghost" size="icon" aria-label="Remove channel multiplier" onClick={() => d.set('channelMultipliers', v.channelMultipliers.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" disabled={v.channelMultipliers.length >= 25} onClick={() => d.set('channelMultipliers', [...v.channelMultipliers, { channelId: '', multiplier: 1.5 }])} className="mt-3"><Plus className="size-3.5" /> Add channel boost</Button>
            <p className="stamp mb-1 mt-5 text-muted">ROLE BOOSTS</p>
            {v.roleMultipliers.map((rule, index) => (
              <div key={`role-${index}`} className="flex items-center gap-2 border-b border-line py-2">
                <div className="min-w-0 flex-1"><SingleRolePicker value={rule.roleId || null} onChange={(roleId) => d.set('roleMultipliers', v.roleMultipliers.map((item, i) => i === index ? { ...item, roleId } : item))} roles={data.resources.roles} /></div>
                <Input aria-label="Role XP multiplier" type="number" min={1} max={3} step={0.25} value={rule.multiplier} onChange={(event) => d.set('roleMultipliers', v.roleMultipliers.map((item, i) => i === index ? { ...item, multiplier: Math.max(1, Math.min(3, Number(event.target.value) || 1)) } : item))} className="w-20 text-center font-mono" />
                <span className="text-[12px] text-faint">×</span>
                <Button variant="ghost" size="icon" aria-label="Remove role multiplier" onClick={() => d.set('roleMultipliers', v.roleMultipliers.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" disabled={v.roleMultipliers.length >= 25} onClick={() => d.set('roleMultipliers', [...v.roleMultipliers, { roleId: '', multiplier: 1.5 }])} className="mt-3"><Plus className="size-3.5" /> Add role boost</Button>
          </Panel>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
          <Panel title="Rank card style" description="A restrained theme and server-matched accent keep the image polished in Discord.">
            <Field label="Card theme"><Segmented value={v.rankCard.theme} onChange={(theme) => d.set('rankCard', { ...v.rankCard, theme })} options={cardThemes.map(({ value, label }) => ({ value, label }))} testId="segment-rank-theme" /></Field>
            <Field label="Accent color" description="Uses the server accent unless a custom color is selected.">
              <div className="flex items-center gap-3">
                <input type="color" aria-label="Rank card accent" value={hex(v.rankCard.accentColor ?? data.settings.general.accentColor)} onChange={(event) => d.set('rankCard', { ...v.rankCard, accentColor: parseInt(event.target.value.slice(1), 16) })} className="size-10 cursor-pointer rounded-lg border border-line bg-transparent p-1" />
                <span className="font-mono text-[12px] text-muted">{hex(v.rankCard.accentColor ?? data.settings.general.accentColor).toUpperCase()}</span>
                {v.rankCard.accentColor !== null && <Button size="sm" variant="ghost" onClick={() => d.set('rankCard', { ...v.rankCard, accentColor: null })}>Use server accent</Button>}
              </div>
            </Field>
            <Field inline label="Show rank" description="Include the member's leaderboard position."><Switch checked={v.rankCard.showRank} onChange={(showRank) => d.set('rankCard', { ...v.rankCard, showRank })} label="Show rank" /></Field>
            <Field inline label="Show server icon" description="Adds a small server mark in the card header."><Switch checked={v.rankCard.showServerIcon} onChange={(showServerIcon) => d.set('rankCard', { ...v.rankCard, showServerIcon })} label="Show server icon" /></Field>
            <Field inline label="Show XP progress" description="Show current XP and the progress bar to the next level."><Switch checked={v.rankCard.showXp} onChange={(showXp) => d.set('rankCard', { ...v.rankCard, showXp })} label="Show XP" /></Field>
            <Field inline label="Show tracked messages" description="Display total human messages since message tracking began."><Switch checked={v.rankCard.showMessages} onChange={(showMessages) => d.set('rankCard', { ...v.rankCard, showMessages })} label="Show messages" /></Field>
          </Panel>
          <div>
            <p className="stamp mb-2 text-muted">LIVE PREVIEW</p>
            <div className="relative aspect-[10/3] min-h-44 overflow-hidden rounded-3xl border border-line p-[5%] shadow-2xl" style={{ background: cardThemes.find((theme) => theme.value === v.rankCard.theme)?.background }}>
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: hex(v.rankCard.accentColor ?? data.settings.general.accentColor) }} />
              <div className="flex h-full items-center gap-[4%]">
                <div className="grid aspect-square h-[70%] place-items-center rounded-full border-[5px] bg-black/20 text-2xl font-bold text-white" style={{ borderColor: hex(v.rankCard.accentColor ?? data.settings.general.accentColor) }}>N</div>
                <div className="min-w-0 flex-1 text-white"><p className="truncate text-[clamp(14px,2.3vw,28px)] font-bold">Nadia</p><p className="truncate text-[clamp(10px,1.1vw,14px)] text-white/55">@nadia</p>{v.rankCard.showXp && <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full" style={{ backgroundColor: hex(v.rankCard.accentColor ?? data.settings.general.accentColor) }} /></div>}{v.rankCard.showMessages && <p className="mt-2 text-[clamp(9px,1vw,12px)] text-white/55">12,400 messages tracked</p>}</div>
                <div className="flex flex-col items-end gap-1 text-right">{v.rankCard.showRank && <span className="text-[clamp(10px,1vw,14px)] text-white/60">RANK</span>}<strong className="text-[clamp(18px,2.7vw,34px)] text-white">{v.rankCard.showRank ? '#4' : ''}</strong><span className="mt-1 text-[clamp(10px,1vw,14px)] text-white/60">LEVEL 42</span></div>
              </div>
              {v.rankCard.showServerIcon && <span className="absolute right-4 top-3 grid size-7 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white/70">S</span>}
            </div>
            <p className="mt-2 text-[12px] text-faint">Preview is illustrative; `/rank` renders the final canvas card using the member's real statistics.</p>
          </div>
        </div>
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
          {sortedRewards.map(({ reward: r, index }, i) => (
            <div key={index} className="relative flex items-center gap-3 border-l-2 border-rust-400/30 py-3 pl-4">
              <span className="stamp w-12 text-muted">Level</span>
              <Input type="number" min={1} max={500} value={r.level} onChange={(e) => d.set('rewards', v.rewards.map((x, j) => (j === index ? { ...x, level: Math.max(1, Math.min(500, Number(e.target.value) || 1)) } : x)))} className="w-24 font-mono" data-testid={`input-reward-level-${i}`} />
              <div className="flex-1">
                <SingleRolePicker value={r.roleId || null} onChange={(roleId) => d.set('rewards', v.rewards.map((x, j) => (j === index ? { ...x, roleId } : x)))} roles={data.resources.roles} testId={`picker-reward-role-${i}`} />
                {r.roleId && !data.resources.roles.some((role) => role.id === r.roleId) && <p className="mt-1 text-[11px] text-hazard">This role no longer exists in the server.</p>}
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove reward" onClick={() => d.set('rewards', v.rewards.filter((_, j) => j !== index))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Field inline label="Keep old rewards" description="Off means members only keep their highest reward role.">
            <Switch checked={v.stackRewards} onChange={(x) => d.set('stackRewards', x)} label="Keep old rewards" />
          </Field>
          <div className="mt-4 rounded-2xl border border-line bg-black/15 p-4">
            <p className="stamp text-muted">PREVIEW MEMBER REWARDS</p>
            <div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-[13px] text-muted">Member at level</span><Input type="number" min={0} max={500} value={previewRewardLevel} onChange={(event) => setPreviewRewardLevel(Math.max(0, Math.min(500, Number(event.target.value) || 0)))} className="w-24 font-mono" data-testid="input-preview-reward-level" /><span className="text-[12px] text-faint">{v.stackRewards ? 'receives every earned tier' : 'keeps only their highest earned tier'}</span></div>
            <div className="mt-3 flex flex-wrap gap-2">{previewRewardTiers.length ? previewRewardTiers.map((reward) => <span key={`${reward.level}-${reward.roleId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.05] px-2.5 py-1 text-[12px]"><span className="font-mono text-rust-300">L{reward.level}</span>{data.resources.roles.find((role) => role.id === reward.roleId)?.name ?? 'Role removed'}</span>) : <span className="text-[12px] text-faint">No reward role is earned at this level.</span>}</div>
          </div>
        </Panel>
      </OffNotice>
      <SaveBar
        dirty={d.dirty}
        saving={d.saving}
        // Drop unfinished rows instead of failing validation.
        onSave={() => d.save((x) => ({ ...x, rewards: x.rewards.filter((r) => r.roleId), channelMultipliers: x.channelMultipliers.filter((r) => r.channelId), roleMultipliers: x.roleMultipliers.filter((r) => r.roleId) }))}
        onReset={d.reset}
      />
      <LevelingTools guildId={guildId} roles={data.resources.roles} rewardSettingsUnsaved={d.dirty} />
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
