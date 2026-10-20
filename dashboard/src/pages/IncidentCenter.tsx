import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock3, FileSearch, Filter, Hash, LockKeyhole, RefreshCw, Search, ShieldAlert, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { EmptyState, PageSkeleton, Panel } from '@/components/dash';
import { useToast } from '@/components/Toast';
import { Badge, Button, Input, Textarea } from '@/components/ui';
import { api, ApiError, get, queryClient } from '@/lib/api';
import type { Incident, IncidentStatus, LogCategory, LoggerEvent } from '@/lib/types';
import { LOG_CATEGORIES, LOG_EVENTS } from '@/lib/types';
import { ago, cn } from '@/lib/utils';

interface LoggingContext {
  guild: { id: string; name: string; icon: string | null };
  canManage: boolean;
  canViewSensitive: boolean;
  loggingEnabled: boolean;
}
interface PageResult<T> { total: number; page: number; pages: number; entries: T[] }
interface IncidentDetail { incident: Incident; events: LoggerEvent[]; canManage: boolean; canViewSensitive: boolean }

const eventLabels: Record<(typeof LOG_EVENTS)[number], string> = {
  messageDelete: 'Message deleted', messageEdit: 'Message edited', messageBulkDelete: 'Bulk message delete', suspiciousLinks: 'Suspicious link burst',
  memberJoin: 'Member joined', memberLeave: 'Member left', memberRoles: 'Member roles changed', nickname: 'Nickname changed',
  memberBan: 'Member banned', memberUnban: 'Member unbanned', memberKick: 'Member kicked',
  channelCreate: 'Channel created', channelDelete: 'Channel deleted', channelUpdate: 'Channel updated',
  roleCreate: 'Role created', roleDelete: 'Role deleted', roleUpdate: 'Role updated', webhookCreate: 'Webhook created', webhookUpdate: 'Webhook updated', webhookDelete: 'Webhook deleted',
};
const categoryLabels: Record<LogCategory, string> = { messages: 'Messages', members: 'Members', moderation: 'Moderation', server: 'Server changes', integrations: 'Integrations' };
const statusLabels: Record<IncidentStatus, string> = { open: 'Open', investigating: 'Investigating', resolved: 'Resolved', false_alarm: 'False alarm' };
const severityTone: Record<Incident['severity'], 'neutral' | 'info' | 'hazard' | 'bad'> = { low: 'neutral', medium: 'info', high: 'hazard', critical: 'bad' };
const deliveryLabels: Record<LoggerEvent['delivery']['status'], string> = { pending: 'Queued', sending: 'Sending', delivered: 'Delivered', failed: 'Failed', not_configured: 'No channel' };
const formatDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const base = (guildId: string) => `/api/guilds/${guildId}`;

function ErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : 'Could not load this information right now.';
  return <div className="rounded-2xl border border-bad/25 bg-bad/[0.06] p-4 text-[14px] text-bad" role="alert">{message}</div>;
}

function IncidentListItem({ incident, selected, onClick }: { incident: Incident; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn('w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust-400', selected ? 'border-rust-400/40 bg-rust-500/[0.09]' : 'border-line bg-black/15 hover:border-white/20 hover:bg-white/[0.03]')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={severityTone[incident.severity]}>{incident.severity} · {incident.riskScore}/100</Badge>
        <Badge tone={incident.status === 'resolved' ? 'ok' : incident.status === 'false_alarm' ? 'neutral' : 'rust'}>{statusLabels[incident.status]}</Badge>
        <span className="ml-auto text-[11px] text-faint">{ago(incident.lastEventAt)}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-bold leading-snug">{incident.title}</h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{incident.summary}</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-faint">
        <span>{incident.eventCount} related events</span>
        <span>{incident.affectedUserIds.length} members</span>
        <span>{incident.affectedChannelIds.length} channels</span>
      </div>
    </button>
  );
}

function RelatedObjectGroup({ guildId, label, ids, kind }: { guildId: string; label: string; ids: string[]; kind: 'member' | 'channel' | 'role' | 'actor' }) {
  const Icon = kind === 'channel' ? Hash : kind === 'member' ? UserRound : ShieldAlert;
  const hrefFor = (id: string) => kind === 'channel'
    ? `https://discord.com/channels/${guildId}/${id}`
    : kind === 'member' || kind === 'actor'
      ? `https://discord.com/users/${id}`
      : null;
  return (
    <section aria-label={label} className="min-w-0 rounded-xl border border-line bg-black/15 p-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold"><Icon className="size-3.5 text-faint" /><span>{label}</span><span className="ml-auto rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-faint">{ids.length}</span></div>
      {ids.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const href = hrefFor(id);
            return <li key={id}>{href ? <a href={href} target="_blank" rel="noreferrer" title={`Open ${label.toLowerCase()} in Discord`} className="inline-flex max-w-full break-all rounded-lg border border-line bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-muted transition hover:border-rust-400/30 hover:text-rust-200">{id}</a> : <code className="inline-flex max-w-full break-all rounded-lg border border-line bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-muted">{id}</code>}</li>;
          })}
        </ul>
      ) : <p className="mt-2 text-[11px] text-faint">Not identified</p>}
    </section>
  );
}

function EventDetail({ guildId, eventId, canManage }: { guildId: string; eventId: string; canManage: boolean }) {
  const toast = useToast();
  const { data, isLoading, error } = useQuery<LoggerEvent>({ queryKey: ['/api/guilds', guildId, 'logs', eventId], queryFn: () => get<LoggerEvent>(`${base(guildId)}/logs/${eventId}`) });
  const retry = useMutation({
    mutationFn: () => api<{ event: LoggerEvent }>('POST', `${base(guildId)}/logs/${eventId}/retry`),
    onSuccess: () => { toast('Retry queued.'); void queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId, 'logs'] }); void queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId, 'logs', eventId] }); },
    onError: (err) => toast(err instanceof ApiError ? err.message : 'Could not retry this log.', 'bad'),
  });
  if (isLoading) return <div className="py-10 text-center text-[13px] text-muted">Loading event evidence…</div>;
  if (error || !data) return <ErrorMessage error={error} />;
  const evidence = data.evidence;
  return (
    <div className="space-y-4" data-testid="event-detail">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={severityTone[data.severity]}>{data.severity} risk · {data.riskScore}/100</Badge>
        <Badge tone={data.integrityValid ? 'ok' : 'bad'}>{data.integrityValid ? 'Hash matches' : 'Hash mismatch'}</Badge>
        <Badge tone={data.delivery.status === 'delivered' ? 'ok' : data.delivery.status === 'failed' ? 'bad' : 'neutral'}>{deliveryLabels[data.delivery.status]}</Badge>
      </div>
      <div>
        <h3 className="text-[16px] font-bold">{eventLabels[data.eventType]}</h3>
        <p className="mt-1 text-[13px] text-muted">{data.summary}</p>
        <p className="mt-2 text-[12px] text-faint">{formatDate(data.occurredAt)} · {categoryLabels[data.category]} · Source: {data.source.replace('_', ' ')}</p>
      </div>
      <div className="grid gap-2 rounded-2xl border border-line bg-black/15 p-3 text-[12px] sm:grid-cols-2">
        <p><span className="text-faint">Event ID</span><br /><code className="break-all text-text">{data.eventId}</code></p>
        <p><span className="text-faint">Actor</span><br />{data.actorId ? <a className="text-rust-300 hover:underline" href={`https://discord.com/users/${data.actorId}`} target="_blank" rel="noreferrer">{data.actorId}</a> : 'Unknown'} · {data.actorAttribution}</p>
        {data.targetUserId && <p><span className="text-faint">Member</span><br />{data.targetUserId}</p>}
        {data.channelId && <p><span className="text-faint">Channel</span><br />{data.channelId}</p>}
        {data.messageId && <p><span className="text-faint">Message</span><br />{data.messageId}</p>}
        {data.roleId && <p><span className="text-faint">Role</span><br />{data.roleId}</p>}
        {data.incidentId && <p><span className="text-faint">Incident</span><br /><code>{data.incidentId}</code></p>}
      </div>
      {data.riskReasons.length > 0 && <div className="rounded-xl border border-hazard/20 bg-hazard/[0.05] p-3 text-[13px] text-muted"><strong className="text-text">Why it was flagged:</strong> {data.riskReasons.join(', ')}. This is a prompt for review, not proof of misconduct.</div>}
      {evidence?.changedFields?.length ? <p className="text-[13px]"><strong>Changed:</strong> {evidence.changedFields.join(', ')}</p> : null}
      {typeof evidence?.linkCount === 'number' && <p className="text-[13px]"><strong>Link messages in the detection window:</strong> {evidence.linkCount}</p>}
      {evidence?.relatedMessageIds?.length ? <div className="rounded-xl border border-line bg-black/15 p-3"><p className="text-[12px] font-semibold">Related Discord message IDs</p><ul className="mt-1 space-y-1">{evidence.relatedMessageIds.map((id) => <li key={id} className="break-all font-mono text-[11px] text-muted">{id}</li>)}</ul></div> : null}
      {(evidence?.content || evidence?.beforeContent) && <div className="space-y-2 rounded-2xl border border-line bg-black/20 p-4"><p className="flex items-center gap-2 text-[13px] font-semibold"><LockKeyhole className="size-4 text-rust-300" /> Sensitive message evidence</p>{evidence.beforeContent && <p className="whitespace-pre-wrap break-words text-[13px] text-muted"><strong>Before:</strong> {evidence.beforeContent}</p>}{evidence.content && <p className="whitespace-pre-wrap break-words text-[13px] text-text"><strong>After / captured text:</strong> {evidence.content}</p>}</div>}
      {evidence?.attachments?.length ? <div className="rounded-2xl border border-line bg-black/20 p-4"><p className="mb-2 text-[13px] font-semibold">Attachment details</p>{evidence.attachments.map((file, i) => <p key={`${file.name}-${i}`} className="break-all text-[12px] text-muted">{file.name} · {file.size.toLocaleString()} bytes{file.contentType ? ` · ${file.contentType}` : ''}</p>)}</div> : null}
      <div className="rounded-xl border border-line bg-black/15 p-3">
        <p className="text-[11px] uppercase tracking-wider text-faint">Evidence hash · SHA-256</p>
        <code className="mt-1 block break-all text-[11px] text-muted">{data.evidenceHash}</code>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">A matching hash can reveal changes to this saved record. It does not prove the original event was truthful or detect deletion of the entire database.</p>
      </div>
      {data.delivery.status === 'failed' || data.delivery.status === 'not_configured' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/20 bg-bad/[0.04] p-3">
          <div><p className="text-[13px] font-semibold">Discord delivery: {deliveryLabels[data.delivery.status]}</p><p className="text-[12px] text-muted">{data.delivery.lastError ?? 'Choose a destination channel in Logging settings.'}</p></div>
          {canManage && <Button variant="outline" size="sm" loading={retry.isPending} onClick={() => retry.mutate()}><RefreshCw className="size-3.5" /> Retry delivery</Button>}
        </div>
      ) : null}
    </div>
  );
}

function IncidentReview({ guildId, incidentId }: { guildId: string; incidentId: string }) {
  const toast = useToast();
  const [status, setStatus] = useState<IncidentStatus>('open');
  const [note, setNote] = useState('');
  const { data, isLoading, error } = useQuery<IncidentDetail>({ queryKey: ['/api/guilds', guildId, 'incidents', incidentId], queryFn: () => get<IncidentDetail>(`${base(guildId)}/incidents/${incidentId}`) });
  useEffect(() => { if (data) setStatus(data.incident.status); }, [data?.incident.status]);
  const update = useMutation({
    mutationFn: () => api<{ incident: Incident }>('PATCH', `${base(guildId)}/incidents/${incidentId}`, { status, note: note.trim() || undefined }),
    onSuccess: () => { setNote(''); toast('Incident review saved.'); void queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId, 'incidents'] }); void queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId, 'incidents', incidentId] }); },
    onError: (err) => toast(err instanceof ApiError ? err.message : 'Could not save this review.', 'bad'),
  });
  if (isLoading) return <div className="py-12 text-center text-[13px] text-muted">Loading incident timeline…</div>;
  if (error || !data) return <ErrorMessage error={error} />;
  const incident = data.incident;
  return (
    <div className="space-y-5" data-testid="incident-detail">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={severityTone[incident.severity]}>{incident.severity} · {incident.riskScore}/100</Badge><Badge tone={incident.status === 'resolved' ? 'ok' : incident.status === 'false_alarm' ? 'neutral' : 'rust'}>{statusLabels[incident.status]}</Badge><span className="ml-auto text-[12px] text-faint">{incident.eventCount} related event(s)</span></div>
      <div><h2 className="text-[20px] font-extrabold">{incident.title}</h2><p className="mt-1 text-[13px] leading-relaxed text-muted">{incident.summary}</p></div>
      <div className="space-y-3 rounded-2xl border border-line bg-black/15 p-4">
        <div className="grid gap-3 text-[12px] sm:grid-cols-2"><p><Clock3 className="mr-1 inline size-3.5 text-faint" />First seen<br /><strong className="ml-5 text-text">{formatDate(incident.firstEventAt)}</strong></p><p><Clock3 className="mr-1 inline size-3.5 text-faint" />Last seen<br /><strong className="ml-5 text-text">{formatDate(incident.lastEventAt)}</strong></p></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <RelatedObjectGroup guildId={guildId} label="Affected members" ids={incident.affectedUserIds} kind="member" />
          <RelatedObjectGroup guildId={guildId} label="Affected channels" ids={incident.affectedChannelIds} kind="channel" />
          <RelatedObjectGroup guildId={guildId} label="Affected roles" ids={incident.affectedRoleIds} kind="role" />
          <RelatedObjectGroup guildId={guildId} label="Attributed actors" ids={incident.actorIds} kind="actor" />
        </div>
      </div>
      <div className="rounded-2xl border border-hazard/20 bg-hazard/[0.05] p-3 text-[12px] leading-relaxed text-muted"><strong className="text-text">Use this as an investigation aid.</strong> Automated signals can have innocent explanations. Confirm the timeline and relevant context before taking action.</div>
      <Panel title="Incident timeline" description="Events are sorted from earliest to latest.">
        <div className="space-y-2 pt-3">
          {data.events.length ? data.events.map((event) => (
            <div key={event.eventId} className="rounded-xl border border-line bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold">{eventLabels[event.eventType]}</span><Badge tone={event.integrityValid ? 'ok' : 'bad'}>{event.integrityValid ? 'Hash matches' : 'Hash mismatch'}</Badge><span className="ml-auto text-[11px] text-faint">{formatDate(event.occurredAt)}</span></div>
              <p className="mt-1 text-[12px] text-muted">{event.summary}</p>
              <p className="mt-1 text-[11px] text-faint">Actor {event.actorId ?? 'unknown'}{event.channelId ? ` · channel ${event.channelId}` : ''}{event.targetUserId ? ` · member ${event.targetUserId}` : ''}</p>
              {event.evidence?.changedFields?.length ? <p className="mt-1 text-[11px] text-muted">Changed: {event.evidence.changedFields.join(', ')}</p> : null}
              {(event.messageId || event.evidence?.relatedMessageIds?.length || event.evidence?.relatedEventIds?.length) && <details className="mt-1"><summary className="cursor-pointer text-[11px] text-rust-300">Evidence references</summary><div className="mt-1 break-all font-mono text-[10px] text-faint">{event.messageId && <p>Message: {event.messageId}</p>}{event.evidence?.relatedMessageIds?.map((id) => <p key={`message-${id}`}>Related message: {id}</p>)}{event.evidence?.relatedEventIds?.map((id) => <p key={`event-${id}`}>Related event: {id}</p>)}</div></details>}
              {data.canViewSensitive && (event.evidence?.content || event.evidence?.beforeContent) && <details className="mt-2"><summary className="cursor-pointer text-[11px] text-rust-300">View sensitive message evidence</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-[12px] text-text">{event.evidence.beforeContent ? `Before: ${event.evidence.beforeContent}\n` : ''}{event.evidence.content}</pre></details>}
            </div>
          )) : <EmptyState emoji="🧾" title="No timeline events" body="The evidence records for this incident may have expired." />}
        </div>
      </Panel>
      <Panel title="Review notes" description="Notes and status changes are kept with the incident history.">
        <div className="space-y-3 pt-2">
          {incident.notes.length ? incident.notes.map((entry, i) => <div key={`${entry.createdAt}-${i}`} className="border-l-2 border-line py-1 pl-3"><p className="text-[12px] font-semibold">{entry.action === 'status' ? `Status: ${entry.status ? statusLabels[entry.status] : 'updated'}` : 'Reviewer note'} · {entry.actorId}</p><p className="mt-0.5 whitespace-pre-wrap text-[13px] text-muted">{entry.text}</p><p className="mt-1 text-[10px] text-faint">{formatDate(entry.createdAt)}</p></div>) : <p className="py-2 text-[13px] text-muted">No review notes yet.</p>}
          {data.canManage && <div className="space-y-3 border-t border-line pt-4"><label className="block text-[12px] font-semibold" htmlFor="incident-status">Update status</label><select id="incident-status" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)} className="h-10 w-full rounded-xl border border-line bg-black/25 px-3 text-[14px]">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="block text-[12px] font-semibold" htmlFor="incident-note">Add a note <span className="font-normal text-faint">(optional)</span></label><Textarea id="incident-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Record what was checked or how the incident was handled…" /><Button variant="primary" loading={update.isPending} disabled={status === incident.status && !note.trim()} onClick={() => update.mutate()}><CheckCircle2 className="size-4" /> Save review</Button></div>}
        </div>
      </Panel>
    </div>
  );
}

export default function IncidentCenter({ guildId }: { guildId: string }) {
  const [tab, setTab] = useState<'incidents' | 'events'>('incidents');
  const [status, setStatus] = useState<'all' | IncidentStatus>('open');
  const [incidentPage, setIncidentPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const context = useQuery<LoggingContext>({ queryKey: ['/api/guilds', guildId, 'logging', 'context'], queryFn: () => get<LoggingContext>(`${base(guildId)}/logging/context`) });
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(query.trim()); setEventPage(0); }, 300); return () => window.clearTimeout(timer); }, [query]);
  const incidentParams = new URLSearchParams({ page: String(incidentPage) });
  if (status !== 'all') incidentParams.set('status', status);
  const incidents = useQuery<PageResult<Incident>>({ queryKey: ['/api/guilds', guildId, 'incidents', status, incidentPage], queryFn: () => get<PageResult<Incident>>(`${base(guildId)}/incidents?${incidentParams}`), enabled: tab === 'incidents' });
  const eventParams = new URLSearchParams({ page: String(eventPage) });
  if (search) eventParams.set('q', search);
  if (eventFilter) eventParams.set('event', eventFilter);
  if (categoryFilter) eventParams.set('category', categoryFilter);
  if (deliveryFilter) eventParams.set('delivery', deliveryFilter);
  const events = useQuery<PageResult<LoggerEvent>>({ queryKey: ['/api/guilds', guildId, 'logs', search, eventFilter, categoryFilter, deliveryFilter, eventPage], queryFn: () => get<PageResult<LoggerEvent>>(`${base(guildId)}/logs?${eventParams}`), enabled: tab === 'events' });
  useEffect(() => { setIncidentId(null); setEventId(null); }, [tab]);
  if (context.isLoading) return <PageSkeleton />;
  if (context.error || !context.data) return <div className="mx-auto max-w-3xl px-5 pt-28"><ErrorMessage error={context.error} /></div>;
  const ctx = context.data;
  const currentIncidents = incidents.data?.entries ?? [];
  const currentEvents = events.data?.entries ?? [];
  const selectedIncident = currentIncidents.find((item) => item.incidentId === incidentId) ?? null;
  const labelForStatus = status === 'all' ? 'All incidents' : statusLabels[status];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-24 sm:pt-28" data-testid="incident-center">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="grid size-14 place-items-center rounded-2xl border border-rust-400/20 bg-rust-500/[0.08]"><ShieldAlert className="size-7 text-rust-300" /></div>
        <div className="min-w-0 flex-1"><p className="stamp text-rust-300">{ctx.guild.name} · Server records</p><h1 className="text-[clamp(1.7rem,3vw,2.35rem)] font-extrabold">Incident center</h1><p className="text-[13px] text-muted">Search logger events, review grouped timelines and manage delivery failures.</p></div>
        <Link href={ctx.canManage ? `/dashboard/${guildId}/logging` : '/dashboard'} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px] text-muted transition hover:bg-white/[0.05] hover:text-text"><ArrowLeft className="size-4" /> {ctx.canManage ? 'Logging settings' : 'All servers'}</Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Incident center views">
        <Button variant={tab === 'incidents' ? 'primary' : 'outline'} onClick={() => setTab('incidents')} role="tab" aria-selected={tab === 'incidents'}><AlertTriangle className="size-4" /> Incidents</Button>
        <Button variant={tab === 'events' ? 'primary' : 'outline'} onClick={() => setTab('events')} role="tab" aria-selected={tab === 'events'}><FileSearch className="size-4" /> Search events</Button>
        <span className="ml-auto inline-flex items-center gap-1.5 self-center text-[12px] text-muted"><LockKeyhole className="size-3.5" />{ctx.canViewSensitive ? 'Sensitive evidence access' : 'Limited evidence access'}{ctx.canManage && ' · Server manager'}</span>
      </div>
      {!ctx.loggingEnabled && <div className="mb-4 rounded-2xl border border-hazard/25 bg-hazard/[0.05] p-3 text-[13px] text-muted"><strong className="text-text">Logging is currently off.</strong> Existing records can still be reviewed, but new records will not be captured until the module is enabled.</div>}
      <div className="mb-5 flex items-start gap-2 rounded-2xl border border-hazard/20 bg-hazard/[0.04] p-3 text-[12px] leading-relaxed text-muted"><CircleHelp className="mt-0.5 size-4 shrink-0 text-hazard" /><p>Risk scores and automated groupings are investigation indicators, not proof of misconduct. Review the full context before taking action. A matching SHA-256 hash detects some record changes but cannot prove the original event was truthful or prevent deletion of the whole database.</p></div>
      {tab === 'incidents' ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
          <Panel title="Grouped incidents" description="Related signals are combined into one timeline." action={<select aria-label="Filter incidents by status" value={status} onChange={(e) => { setStatus(e.target.value as 'all' | IncidentStatus); setIncidentPage(0); setIncidentId(null); }} className="h-9 rounded-lg border border-line bg-black/25 px-2 text-[12px]"><option value="all">All</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}>
            {incidents.isLoading ? <div className="py-10 text-center text-[13px] text-muted">Loading incidents…</div> : incidents.error ? <ErrorMessage error={incidents.error} /> : currentIncidents.length ? <div className="space-y-2 pt-3">{currentIncidents.map((incident) => <IncidentListItem key={incident.incidentId} incident={incident} selected={incident.incidentId === incidentId} onClick={() => { setIncidentId(incident.incidentId); setEventId(null); }} />)}</div> : <EmptyState emoji="🧭" title="No incidents in this view" body={`There are no ${labelForStatus.toLowerCase()} incidents to review.`} />}
            {incidents.data && incidents.data.pages > 1 && <div className="mt-4 flex items-center justify-between border-t border-line pt-3"><span className="text-[11px] text-faint">Page {incidentPage + 1} of {incidents.data.pages}</span><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Previous incidents" disabled={incidentPage === 0} onClick={() => setIncidentPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" aria-label="Next incidents" disabled={incidentPage + 1 >= incidents.data.pages} onClick={() => setIncidentPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div></div>}
          </Panel>
          <Panel title={selectedIncident?.title ?? 'Incident review'} description={selectedIncident ? 'Review the timeline, attribution and notes.' : 'Select an incident to open its complete timeline and review history.'}>
            {incidentId ? <IncidentReview guildId={guildId} incidentId={incidentId} /> : <EmptyState emoji="🧾" title="Choose an incident" body="Incident timelines, affected objects and review notes will appear here." />}
          </Panel>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(330px,0.88fr)_minmax(0,1.12fr)]">
          <Panel title="Search event evidence" description="Search summaries and identifiers. Stored message text is never included in search." action={<Filter className="size-4 text-faint" />}>
            <div className="space-y-3 pt-3">
              <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search summary or paste a Discord ID…" className="pl-9" aria-label="Search logger events" /></label>
              <div className="grid gap-2 sm:grid-cols-3">
                <select aria-label="Filter by event type" value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setEventPage(0); }} className="h-9 min-w-0 rounded-lg border border-line bg-black/25 px-2 text-[12px]"><option value="">All events</option>{LOG_EVENTS.map((event) => <option key={event} value={event}>{eventLabels[event]}</option>)}</select>
                <select aria-label="Filter by category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setEventPage(0); }} className="h-9 min-w-0 rounded-lg border border-line bg-black/25 px-2 text-[12px]"><option value="">All categories</option>{LOG_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select>
                <select aria-label="Filter by delivery" value={deliveryFilter} onChange={(e) => { setDeliveryFilter(e.target.value); setEventPage(0); }} className="h-9 min-w-0 rounded-lg border border-line bg-black/25 px-2 text-[12px]"><option value="">Any delivery</option><option value="delivered">Delivered</option><option value="failed">Failed</option><option value="not_configured">No channel</option><option value="pending">Queued</option></select>
              </div>
              {events.isLoading ? <div className="py-10 text-center text-[13px] text-muted">Searching records…</div> : events.error ? <ErrorMessage error={events.error} /> : currentEvents.length ? <div className="space-y-2">{currentEvents.map((event) => <button key={event.eventId} type="button" onClick={() => setEventId(event.eventId)} aria-pressed={event.eventId === eventId} className={cn('w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust-400', event.eventId === eventId ? 'border-rust-400/40 bg-rust-500/[0.08]' : 'border-line bg-black/15 hover:bg-white/[0.03]')}><div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold">{eventLabels[event.eventType]}</span><Badge tone={severityTone[event.severity]}>{event.riskScore ? `${event.riskScore}/100` : 'Routine'}</Badge><span className="ml-auto text-[10px] text-faint">{ago(event.occurredAt)}</span></div><p className="mt-1 line-clamp-2 text-[12px] text-muted">{event.summary}</p><p className="mt-1 text-[10px] text-faint">{event.delivery.status === 'delivered' ? 'Delivered' : deliveryLabels[event.delivery.status]} · {event.actorId ? `actor ${event.actorId}` : 'actor unknown'}</p></button>)}</div> : <EmptyState emoji="🔎" title="No matching records" body="Try a different search word, identifier or filter." />}
              {events.data && events.data.pages > 1 && <div className="flex items-center justify-between border-t border-line pt-3"><span className="text-[11px] text-faint">Page {eventPage + 1} of {events.data.pages}</span><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Previous events" disabled={eventPage === 0} onClick={() => setEventPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button><Button size="icon" variant="outline" aria-label="Next events" disabled={eventPage + 1 >= events.data.pages} onClick={() => setEventPage((p) => p + 1)}><ChevronRight className="size-4" /></Button></div></div>}
            </div>
          </Panel>
          <Panel title="Evidence record" description={eventId ? 'Details and delivery state for the selected event.' : 'Select an event to inspect its evidence and delivery state.'}>
            {eventId ? <EventDetail guildId={guildId} eventId={eventId} canManage={ctx.canManage} /> : <EmptyState emoji="📜" title="No event selected" body="Choose a search result to view its evidence record." />}
          </Panel>
        </div>
      )}
    </div>
  );
}
