import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, FileText, Image as ImageIcon, Plus, Send, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Container, DButton, DiscordWindow, DSelect, Message, Row, Text, Title } from '@/components/discord';
import { Panel, SaveBar, settingsKey, useDraft } from '@/components/dash';
import { ChannelPicker, RolePicker } from '@/components/pickers';
import { useToast } from '@/components/Toast';
import { Badge, Button, Emoji, Field, Input, Segmented, Switch, Textarea } from '@/components/ui';
import { api, ApiError, queryClient, uploadTicketArtwork } from '@/lib/api';
import type { SettingsPayload, TicketPanel, TicketQuestion } from '@/lib/types';
import { DEMO, hex } from '@/lib/utils';
import { OffNotice, SectionHeader } from './shared';

type Props = { guildId: string; data: SettingsPayload };

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}`;
const makeQuestion = (): TicketQuestion => ({
  id: makeId('q'),
  label: 'How can we help?',
  description: '',
  placeholder: '',
  style: 'paragraph',
  required: true,
  minLength: 0,
  maxLength: 1000,
});

function MaxLengthInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const normalize = () => {
    const next = Math.max(1, Math.min(1000, Number(text) || 1));
    setText(String(next));
    onChange(next);
  };
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      max={1000}
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (/^\d+$/.test(next) && Number(next) >= 1 && Number(next) <= 1000) onChange(Number(next));
      }}
      onBlur={normalize}
      aria-label="Maximum answer length"
      data-testid="input-ticket-question-max-length"
    />
  );
}

function PublishPanel({ guildId, data, panel, unsaved }: Props & { panel: TicketPanel; unsaved: boolean }) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const toast = useToast();
  const placement = data.postedTicketPanels?.find((item) => item.panelId === panel.id && item.channelId === channelId);
  const channel = data.resources.channels.find((item) => item.id === channelId);
  const blocked = channel?.canSend === false;
  const mutation = useMutation({
    mutationFn: () => api<{ result: 'posted' | 'updated' }>('POST', `/api/guilds/${guildId}/tickets/panel`, {
      channelId,
      panelId: panel.id,
      mode: placement ? 'update' : 'publish',
    }),
    onSuccess: ({ result }) => {
      toast(result === 'updated' ? 'Panel updated in place.' : 'Panel posted.');
      void queryClient.invalidateQueries({ queryKey: settingsKey(guildId) });
    },
    onError: (error) => {
      toast(error instanceof ApiError ? error.message : 'Could not publish this panel.', 'bad');
      void queryClient.invalidateQueries({ queryKey: settingsKey(guildId) });
    },
  });

  return (
    <Panel title="Publish panel" description="Choose a channel. Tracked panels update in place; otherwise Clanky posts a new message.">
      <Field label="Destination channel" description={channel?.canSend === false ? 'Clanky cannot send messages in this channel.' : 'You can post each configured panel in more than one channel.'}>
        <ChannelPicker value={channelId} onChange={setChannelId} channels={data.resources.channels} placeholder="Select a text channel" testId="picker-ticket-panel-channel" />
      </Field>
      {placement && channel && (
        <div className="flex flex-wrap items-center gap-2 py-2 text-[13px] text-muted" data-testid="ticket-panel-placement">
          <Badge tone="ok"><Check className="size-3" /> Tracked panel</Badge>
          <span>Message in #{channel.name} will be edited in place.</span>
        </div>
      )}
      {unsaved && <p className="rounded-xl border border-hazard/20 bg-hazard/5 px-3 py-2 text-[12.5px] text-hazard">Save your edits before publishing this panel.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="text-[12px] text-faint">Panel content and questions use the last saved settings.</p>
        <Button
          variant="primary"
          disabled={!channelId || blocked || unsaved}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          data-testid="button-publish-ticket-panel"
        >
          <Send className="size-4" /> {placement ? 'Update panel' : 'Post panel'}
        </Button>
      </div>
    </Panel>
  );
}

function makeValidationErrors(value: SettingsPayload['settings']['tickets']): string[] {
  const errors: string[] = [];
  if (value.panels.length < 1 || value.panels.length > 3) errors.push('Configure between one and three panels.');
  if (value.categories.length > 10) errors.push('Topics are limited to ten.');
  if (value.categories.some((category) => !category.label.trim())) errors.push('Give every topic a name before saving.');
  for (const panel of value.panels) {
    if (!panel.title.trim()) errors.push('Every panel needs a title.');
    if (!panel.description.trim()) errors.push(`Add panel text for “${panel.title || 'Untitled panel'}”.`);
    const fieldCount = panel.questions.length + (value.categories.length ? 1 : 0);
    if (fieldCount < 1) errors.push(`Add a question or topic selector to “${panel.title || 'Untitled panel'}”.`);
    if (fieldCount > 5) errors.push(`“${panel.title || 'Untitled panel'}” exceeds Discord’s five-field modal limit.`);
    if (panel.questions.some((question) => !question.label.trim())) errors.push(`Every question in “${panel.title || 'Untitled panel'}” needs a label.`);
  }
  return errors;
}

export default function TicketsSettings({ guildId, data }: Props) {
  const draft = useDraft(guildId, 'tickets', data.settings.tickets);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({});
  const [artworkVersion, setArtworkVersion] = useState<Record<string, number>>({});
  const objectUrls = useRef(new Set<string>());
  const toast = useToast();
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  if (!draft.draft) return null;
  const value = draft.draft;
  const panel = value.panels.find((item) => item.id === selectedPanelId) ?? value.panels[0];
  const accent = hex(data.settings.general.accentColor);
  const maxQuestions = 5 - (value.categories.length ? 1 : 0);
  const errors = [
    ...makeValidationErrors(value),
    ...value.panels.filter((item) => item.artwork.mode === 'custom' && data.settings.tickets.panels.find((original) => original.id === item.id)?.artwork.mode !== 'custom' && !artworkVersion[item.id]).map((item) => `Upload a custom image for “${item.title || 'Untitled panel'}” before saving.`),
  ];

  const setPanels = (panels: TicketPanel[]) => draft.set('panels', panels);
  const updatePanel = (panelId: string, patch: Partial<TicketPanel>) =>
    setPanels(value.panels.map((item) => item.id === panelId ? { ...item, ...patch } : item));
  const updateQuestion = (panelId: string, questionId: string, patch: Partial<TicketQuestion>) =>
    setPanels(value.panels.map((item) => item.id === panelId
      ? { ...item, questions: item.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question) }
      : item));
  const addPanel = () => {
    if (value.panels.length >= 3) return;
    const id = makeId('p');
    setPanels([...value.panels, {
      id,
      title: `Panel ${value.panels.length + 1}`,
      description: 'Choose this panel to open a private support ticket.',
      questions: [makeQuestion()],
      parentId: null,
      logChannelId: null,
      staffRoleIds: null,
      artwork: { mode: 'template', template: 'support' },
    }]);
    setSelectedPanelId(id);
  };
  const removePanel = (panelId: string) => {
    if (value.panels.length <= 1) return;
    const next = value.panels.filter((item) => item.id !== panelId);
    setPanels(next);
    if (panelId === panel?.id) setSelectedPanelId(next[0]?.id ?? null);
  };
  const addQuestion = () => {
    if (!panel || panel.questions.length >= maxQuestions) return;
    updatePanel(panel.id, { questions: [...panel.questions, { ...makeQuestion(), label: `Question ${panel.questions.length + 1}` }] });
  };
  const moveQuestion = (index: number, direction: -1 | 1) => {
    if (!panel) return;
    const target = index + direction;
    if (target < 0 || target >= panel.questions.length) return;
    const questions = [...panel.questions];
    [questions[index], questions[target]] = [questions[target]!, questions[index]!];
    updatePanel(panel.id, { questions });
  };
  const removeQuestion = (questionId: string) => {
    if (!panel || (panel.questions.length <= 1 && !value.categories.length)) return;
    updatePanel(panel.id, { questions: panel.questions.filter((question) => question.id !== questionId) });
  };
  const addTopic = () => {
    if (value.categories.length >= 10 || (!value.categories.length && value.panels.some((item) => item.questions.length >= 5))) return;
    draft.set('categories', [...value.categories, { id: makeId('topic'), label: 'New topic', description: '' }]);
  };
  const removeTopic = (topicId: string) => {
    const categories = value.categories.filter((item) => item.id !== topicId);
    draft.set('categories', categories);
    if (!categories.length) {
      setPanels(value.panels.map((item) => item.questions.length ? item : { ...item, questions: [makeQuestion()] }));
    }
  };
  const save = () => {
    setSaveAttempted(true);
    if (errors.length) return;
    draft.save();
  };

  const uploadArtwork = async (file: File) => {
    if (!panel) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      toast('Choose a PNG, JPEG, or WebP image under 4 MiB.', 'bad');
      return;
    }
    setUploadingArtwork(true);
    try {
      await uploadTicketArtwork(guildId, panel.id, file);
      const localUrl = URL.createObjectURL(file);
      objectUrls.current.add(localUrl);
      setArtworkUrls((current) => ({ ...current, [panel.id]: localUrl }));
      setArtworkVersion((current) => ({ ...current, [panel.id]: Date.now() }));
      updatePanel(panel.id, { artwork: { ...panel.artwork, mode: 'custom' } });
      toast('Panel image uploaded. Save settings to use it.');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not upload that image.', 'bad');
    } finally {
      setUploadingArtwork(false);
    }
  };

  return (
    <>
      <SectionHeader
        emoji="🎫"
        title="Tickets"
        description="Design support entry points, collect the right details, then send people into a private channel."
        enabled={value.enabled}
        onToggle={(enabled) => draft.set('enabled', enabled)}
      />
      {(draft.error || (saveAttempted && errors.length > 0)) && (
        <div role="alert" className="rounded-2xl border border-bad/25 bg-bad/5 px-4 py-3 text-[13px] text-bad">
          {draft.error ?? errors[0]}
        </div>
      )}
      <OffNotice show={!value.enabled}>
        <Panel
          title="Server defaults"
          description="These settings apply to every panel unless you add an override below."
          action={<Link href={`/dashboard/${guildId}/transcripts`} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-muted transition-colors hover:bg-white/[0.04] hover:text-white"><FileText className="size-3.5" /> Transcript history</Link>}
        >
          <div className="grid gap-x-6 md:grid-cols-2">
            <Field label="Default ticket category" description="New private channels are created under this category.">
              <ChannelPicker value={value.parentId} onChange={(id) => draft.set('parentId', id)} channels={data.resources.channels} kind="category" placeholder="Choose a category" testId="picker-ticket-default-category" />
            </Field>
            <Field label="Default transcript channel" description="Closed-ticket transcripts are sent here.">
              <ChannelPicker value={value.logChannelId} onChange={(id) => draft.set('logChannelId', id)} channels={data.resources.channels} placeholder="Choose a channel" testId="picker-ticket-default-log" />
            </Field>
            <Field label="Default staff roles" description="Staff can read and reply to tickets. Manage Channels remains an override.">
              <RolePicker value={value.staffRoleIds} onChange={(ids) => draft.set('staffRoleIds', ids)} roles={data.resources.roles} max={10} testId="picker-ticket-default-staff" />
            </Field>
            <Field label="Open tickets per member" description={`Members may have up to ${value.maxOpenPerUser} open ticket${value.maxOpenPerUser === 1 ? '' : 's'} at a time.`}>
              <div className="flex items-center gap-3">
                <Input type="number" min={1} max={5} value={value.maxOpenPerUser} onChange={(event) => draft.set('maxOpenPerUser', Math.max(1, Math.min(5, Number(event.target.value) || 1)))} className="max-w-28" data-testid="input-ticket-open-limit" />
                <span className="text-[12px] text-faint">1–5 tickets</span>
              </div>
            </Field>
          </div>
          <Field label="Dashboard transcript retention" description="Attachments are copied to the archive when a ticket closes and kept for this period (up to 25 MiB per file, 100 MiB and 500 files per ticket). Over-limit or unavailable files must be removed before closing. Log-channel and member-DM text copies are unchanged.">
            <select
              value={value.transcriptRetentionDays}
              onChange={(event) => draft.set('transcriptRetentionDays', event.target.value as typeof value.transcriptRetentionDays)}
              className="h-10 w-full rounded-xl border border-line bg-ink-800 px-3 text-[13px] text-white outline-none focus:border-rust-400/50 md:max-w-xs"
              data-testid="select-ticket-transcript-retention"
            >
              <option value="30">30 days</option>
              <option value="90">90 days (default)</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
              <option value="forever">Keep indefinitely</option>
            </select>
          </Field>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <Panel
              title="Panels"
              description={`${value.panels.length} of 3 configured`}
              action={<Button size="sm" disabled={value.panels.length >= 3} onClick={addPanel} data-testid="button-add-ticket-panel"><Plus className="size-3.5" /> Add</Button>}
            >
              <div className="space-y-2 py-2">
                {value.panels.map((item, index) => {
                  const placements = data.postedTicketPanels?.filter((posted) => posted.panelId === item.id).length ?? 0;
                  const selected = item.id === panel?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedPanelId(item.id)}
                      className={`w-full rounded-2xl border p-3.5 text-left transition-colors ${selected ? 'border-rust-400/50 bg-rust-500/10 shadow-[0_0_24px_-16px_rgb(226_112_47/0.8)]' : 'border-line bg-black/15 hover:border-white/20 hover:bg-white/[0.03]'}`}
                      data-testid={`button-select-ticket-panel-${index}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="stamp text-[10px] text-muted">Panel {index + 1}</span>
                        {placements > 0 && <Badge tone="ok">Posted · {placements}</Badge>}
                      </div>
                      <p className="mt-2 truncate text-[14px] font-semibold">{item.title || 'Untitled panel'}</p>
                      <p className="mt-1 text-[12px] text-muted">{item.questions.length} question{item.questions.length === 1 ? '' : 's'}{value.categories.length ? ' · topic selector' : ''}</p>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Shared topics" description="Optional classification across all panels." action={<Button size="sm" disabled={value.categories.length >= 10 || (!value.categories.length && value.panels.some((item) => item.questions.length >= 5))} onClick={addTopic} data-testid="button-add-ticket-topic"><Plus className="size-3.5" /> Add topic</Button>}>
              <div className="space-y-3 py-3">
                {value.categories.length === 0 && <p className="text-[13px] text-faint">No topic picker. Members go straight to the panel’s questions.</p>}
                {value.categories.map((topic, index) => (
                  <div key={topic.id} className="rounded-2xl border border-line bg-black/15 p-3" data-testid={`ticket-topic-${index}`}>
                    <div className="flex items-center gap-2">
                      <Input value={topic.label} maxLength={50} aria-label={`Topic ${index + 1} name`} onChange={(event) => draft.set('categories', value.categories.map((item) => item.id === topic.id ? { ...item, label: event.target.value } : item))} data-testid={`input-ticket-topic-${index}`} />
                      <Button variant="ghost" size="icon" aria-label={`Remove topic ${topic.label || index + 1}`} onClick={() => removeTopic(topic.id)} data-testid={`button-remove-ticket-topic-${index}`}><Trash2 className="size-4" /></Button>
                    </div>
                    <Input className="mt-2" value={topic.description} maxLength={100} aria-label={`Topic ${index + 1} description`} placeholder="Short hint (optional)" onChange={(event) => draft.set('categories', value.categories.map((item) => item.id === topic.id ? { ...item, description: event.target.value } : item))} />
                  </div>
                ))}
                <p className="text-[11px] text-faint">{value.categories.length}/10 topics · Uses one of Discord’s five form fields.</p>
              </div>
            </Panel>
          </aside>

          <main className="min-w-0 space-y-5">
            {panel && (
              <>
                <Panel
                  title={panel.title || 'Untitled panel'}
                  description="Edit this entry point. Empty route overrides inherit the server defaults."
                  action={value.panels.length > 1 ? <Button variant="danger" size="sm" onClick={() => removePanel(panel.id)} data-testid="button-remove-ticket-panel"><Trash2 className="size-3.5" /> Remove panel</Button> : undefined}
                >
                  <div className="grid gap-x-6 md:grid-cols-2">
                    <Field label="Panel title" description="Shown at the top of the posted ticket panel.">
                      <Input value={panel.title} maxLength={100} onChange={(event) => updatePanel(panel.id, { title: event.target.value })} data-testid="input-ticket-panel-title" />
                    </Field>
                    <Field label="Panel description" description={`${panel.description.length}/1000 characters`}>
                      <Textarea value={panel.description} maxLength={1000} onChange={(event) => updatePanel(panel.id, { description: event.target.value })} data-testid="input-ticket-panel-description" />
                    </Field>
                  </div>
                  <div className="grid gap-x-6 md:grid-cols-2">
                    <Field label="Ticket-category override" description={panel.parentId ? 'This panel creates tickets in its own category.' : `Inherited${value.parentId ? `: ${data.resources.channels.find((channel) => channel.id === value.parentId)?.name ?? 'server default'}` : ' server category'}.`}>
                      <ChannelPicker value={panel.parentId} onChange={(id) => updatePanel(panel.id, { parentId: id })} channels={data.resources.channels} kind="category" placeholder="Use server default" testId="picker-ticket-panel-category" />
                    </Field>
                    <Field label="Transcript-channel override" description={panel.logChannelId ? 'This panel sends transcripts to its own channel.' : `Inherited${value.logChannelId ? `: #${data.resources.channels.find((channel) => channel.id === value.logChannelId)?.name ?? 'server default'}` : ' server log channel'}.`}>
                      <ChannelPicker value={panel.logChannelId} onChange={(id) => updatePanel(panel.id, { logChannelId: id })} channels={data.resources.channels} placeholder="Use server default" testId="picker-ticket-panel-log" />
                    </Field>
                  </div>
                  <Field label="Staff-role override" description={panel.staffRoleIds === null ? 'Using the server-wide roles.' : 'Only these roles (plus Manage Channels) can manage tickets from this panel.'}>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={panel.staffRoleIds === null ? 'primary' : 'outline'} onClick={() => updatePanel(panel.id, { staffRoleIds: null })}>Use server roles</Button>
                        <Button size="sm" variant={panel.staffRoleIds !== null ? 'primary' : 'outline'} onClick={() => updatePanel(panel.id, { staffRoleIds: [...value.staffRoleIds] })}>Customize roles</Button>
                      </div>
                      {panel.staffRoleIds !== null && <RolePicker value={panel.staffRoleIds} onChange={(ids) => updatePanel(panel.id, { staffRoleIds: ids })} roles={data.resources.roles} max={10} testId="picker-ticket-panel-staff" />}
                    </div>
                  </Field>
                </Panel>

                <Panel title="Panel artwork" description="Choose an understated built-in style, upload server-specific art, or keep the panel text-only. Opening tickets still use their own single summary card.">
                  <Field label="Public panel image" description="Custom art is uploaded in the dashboard. Discord settings can switch between built-in templates or no image.">
                    <Segmented
                      value={panel.artwork.mode}
                      options={[{ value: 'template', label: 'Template' }, { value: 'custom', label: 'Custom' }, { value: 'none', label: 'No image' }]}
                      onChange={(mode) => updatePanel(panel.id, { artwork: { ...panel.artwork, mode: mode as TicketPanel['artwork']['mode'] } })}
                    />
                  </Field>
                  {panel.artwork.mode === 'template' && (
                    <Field label="Built-in style" description="Both styles inherit the server’s accent color and are posted as a single natural banner.">
                      <Segmented
                        value={panel.artwork.template}
                        options={[{ value: 'support', label: 'Support desk' }, { value: 'minimal', label: 'Minimal' }]}
                        onChange={(template) => updatePanel(panel.id, { artwork: { ...panel.artwork, template: template as TicketPanel['artwork']['template'] } })}
                      />
                    </Field>
                  )}
                  {panel.artwork.mode === 'custom' && (
                    <div className="space-y-3 rounded-2xl border border-line bg-black/15 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold">Custom panel image</p>
                          <p className="mt-1 text-[11px] text-faint">PNG, JPEG, or WebP · up to 4 MiB · normalized to PNG</p>
                        </div>
                        <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-[12px] font-semibold transition-colors hover:bg-white/[0.04] ${uploadingArtwork ? 'pointer-events-none opacity-50' : ''}`}>
                          <Upload className="size-3.5" /> {uploadingArtwork ? 'Uploading…' : 'Choose image'}
                          <input
                            className="sr-only"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={uploadingArtwork}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = '';
                              if (file) void uploadArtwork(file);
                            }}
                            data-testid="input-ticket-panel-artwork"
                          />
                        </label>
                      </div>
                      {artworkUrls[panel.id] || !DEMO ? (
                        <img
                          src={artworkUrls[panel.id] ?? `/api/guilds/${guildId}/tickets/panels/${panel.id}/artwork?v=${artworkVersion[panel.id] ?? 0}`}
                          alt={`Uploaded artwork preview for ${panel.title}`}
                          className="max-h-56 w-full rounded-xl border border-line bg-ink-900 object-contain"
                          data-testid="img-ticket-panel-artwork-preview"
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-faint">Upload an image to preview it here.</div>
                      )}
                    </div>
                  )}
                  {panel.artwork.mode === 'none' && <p className="rounded-xl border border-line bg-black/15 px-4 py-3 text-[12px] text-muted">The posted public panel will contain its title, description, and open button only.</p>}
                  {panel.artwork.mode === 'template' && (
                    <div className="flex items-center gap-3 rounded-2xl border border-line bg-[#111118] px-4 py-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04]"><ImageIcon className="size-5 text-rust-300" /></div>
                      <div><p className="stamp text-[10px] text-rust-300">{panel.artwork.template === 'minimal' ? 'PRIVATE HELP DESK' : 'SUPPORT DESK'}</p><p className="mt-1 text-[13px] font-semibold">{panel.artwork.template === 'minimal' ? 'Tell us what is going on.' : 'A private space for help.'}</p><p className="mt-1 text-[11px] text-muted">{panel.artwork.template === 'minimal' ? 'A private chat with the right team.' : 'Start a conversation with the team.'}</p></div>
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Intake questions"
                  description={`${panel.questions.length}/${maxQuestions} questions · Discord allows five modal fields in total${value.categories.length ? ', including the shared topic selector' : ''}.`}
                  action={<Button size="sm" disabled={panel.questions.length >= maxQuestions} onClick={addQuestion} data-testid="button-add-ticket-question"><Plus className="size-3.5" /> Add question</Button>}
                >
                  {panel.questions.length === 0 && <p className="py-4 text-[13px] text-faint">This panel uses the topic selector only. Add a question if members should provide more detail.</p>}
                  <div className="divide-y divide-line">
                    {panel.questions.map((question, index) => (
                      <article key={question.id} className="py-4" data-testid={`ticket-question-${index}`}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-lg bg-rust-500/12 text-[12px] font-bold text-rust-300">{index + 1}</span>
                            <span className="text-[14px] font-semibold">Question {index + 1}</span>
                            <Badge tone={question.required ? 'rust' : 'neutral'}>{question.required ? 'Required' : 'Optional'}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => moveQuestion(index, -1)}><ArrowUp className="size-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Move question ${index + 1} down`} disabled={index === panel.questions.length - 1} onClick={() => moveQuestion(index, 1)}><ArrowDown className="size-4" /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Remove question ${index + 1}`} disabled={panel.questions.length <= 1 && !value.categories.length} onClick={() => removeQuestion(question.id)} data-testid={`button-remove-ticket-question-${index}`}><Trash2 className="size-4" /></Button>
                          </div>
                        </div>
                        <div className="grid gap-x-5 md:grid-cols-2">
                          <Field label="Question text"><Input value={question.label} maxLength={45} onChange={(event) => updateQuestion(panel.id, question.id, { label: event.target.value })} data-testid={`input-ticket-question-${index}`} /></Field>
                          <Field label="Helper text"><Input value={question.description} maxLength={100} placeholder="Optional guidance" onChange={(event) => updateQuestion(panel.id, question.id, { description: event.target.value })} /></Field>
                          <Field label="Placeholder"><Input value={question.placeholder} maxLength={100} placeholder="Example answer" onChange={(event) => updateQuestion(panel.id, question.id, { placeholder: event.target.value })} /></Field>
                          <Field label="Answer format"><Segmented value={question.style} options={[{ value: 'short', label: 'Short' }, { value: 'paragraph', label: 'Paragraph' }]} onChange={(style) => updateQuestion(panel.id, question.id, { style })} /></Field>
                          <Field label="Maximum answer length"><MaxLengthInput value={question.maxLength} onChange={(maxLength) => updateQuestion(panel.id, question.id, { maxLength, minLength: Math.min(question.minLength, maxLength) })} /></Field>
                          <Field label="Answer required" inline><Switch checked={question.required} onChange={(required) => updateQuestion(panel.id, question.id, { required, minLength: required ? question.minLength : 0 })} label={`Require answer to question ${index + 1}`} /></Field>
                        </div>
                      </article>
                    ))}
                  </div>
                </Panel>

                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                  <Panel title="Member preview" description="See the posted panel and how this panel’s intake form reads in Discord.">
                    <DiscordWindow channel="help-desk">
                      <Message>
                        <Container accent={accent}>
                          {panel.artwork.mode === 'template' && (
                            <div className="mb-3 flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#17171e] px-4 py-3">
                              <div>
                                <p className="stamp text-[10px] tracking-[0.16em] text-rust-300">{panel.artwork.template === 'minimal' ? 'PRIVATE HELP DESK' : 'SUPPORT DESK'}</p>
                                <p className="mt-1 text-[13px] font-medium text-dc-muted">{panel.artwork.template === 'minimal' ? 'A private chat with the right team.' : 'Start a conversation with the team.'}</p>
                              </div>
                              <Emoji e="🎫" className="size-10" />
                            </div>
                          )}
                          {panel.artwork.mode === 'custom' && (
                            <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#17171e]">
                              {artworkUrls[panel.id] || !DEMO
                                ? <img src={artworkUrls[panel.id] ?? `/api/guilds/${guildId}/tickets/panels/${panel.id}/artwork?v=${artworkVersion[panel.id] ?? 0}`} alt="Custom ticket panel art" className="max-h-48 w-full object-cover" />
                                : <div className="flex h-24 items-center justify-center text-[12px] text-dc-muted">Upload custom artwork to preview it.</div>}
                            </div>
                          )}
                          <Title>{panel.title || ' '}</Title>
                          <Text>{panel.description || ' '}</Text>
                          {value.categories.length > 0 && <DSelect placeholder="Choose a topic" />}
                          <Row><DButton style="primary" emoji="📥">Open a ticket</DButton></Row>
                        </Container>
                      </Message>
                      <Message time="Intake form">
                        <Container accent={accent}>
                          <Title>{`${panel.title || 'Ticket'} · Details`}</Title>
                          {value.categories.length > 0 && <div className="rounded-md border border-white/[0.08] bg-[#1e1f22] px-3 py-2 text-[12px] text-dc-muted">Topic selector · required</div>}
                          {panel.questions.map((question) => (
                            <div key={question.id} className="space-y-1.5">
                              <p className="text-[13px] font-semibold text-white">{question.label || 'Question'}{question.required ? ' *' : ' (optional)'}</p>
                              {question.description && <Text small>{question.description}</Text>}
                              <div className={`rounded-md border border-white/[0.08] bg-[#1e1f22] px-3 py-2 text-[12px] text-dc-muted ${question.style === 'paragraph' ? 'min-h-14' : ''}`}>{question.placeholder || (question.style === 'paragraph' ? 'Write a longer answer…' : 'Type your answer…')}</div>
                              <p className="text-[10px] text-dc-muted">{question.style === 'paragraph' ? 'Paragraph' : 'Short answer'} · up to {question.maxLength} characters</p>
                            </div>
                          ))}
                        </Container>
                      </Message>
                    </DiscordWindow>
                  </Panel>
                  <PublishPanel guildId={guildId} data={data} panel={panel} unsaved={draft.dirty} />
                </div>
              </>
            )}
          </main>
        </div>
      </OffNotice>
      <SaveBar dirty={draft.dirty} saving={draft.saving} onSave={save} onReset={() => (draft.reset(), setSaveAttempted(false))} />
    </>
  );
}
