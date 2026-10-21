import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ExternalLink, FileCheck2, FileWarning, MessageSquareText, ShieldCheck, ShieldX } from 'lucide-react';
import { EmptyState, PageSkeleton, Panel } from '@/components/dash';
import { useToast } from '@/components/Toast';
import { Badge, Button, Input, Textarea } from '@/components/ui';
import { api, ApiError, get, queryClient } from '@/lib/api';
import { ago, cn } from '@/lib/utils';

type Kind = 'reports' | 'appeals' | 'cases';
type Report = { reportId: string; reporterId: string; targetId: string; channelId: string; messageId: string; messageUrl: string; reason: string; details: string | null; contentSnapshot: string; status: string; processingAt: string | null; reviewNote: string | null; caseId: number | null; createdAt: string };
type Appeal = { appealId: string; caseId: number; targetId: string; statement: string; status: string; reviewerNote: string | null; createdAt: string; case: { type: string; reason: string | null; status: string; createdAt: string } | null };
type Case = { caseId: number; type: string; targetId: string; targetTag: string; moderatorId: string; reason: string | null; duration: number | null; status?: 'active' | 'voided'; notes?: Array<{ moderatorId: string; text: string; createdAt: string }>; createdAt: string };
type QueueResult = { kind: Kind; page: number; pages: number; total: number; entries: Array<Report | Appeal | Case>; stats?: { open: number; reviewing: number } };
const base = (guildId: string) => `/api/guilds/${guildId}/moderation`;
const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const time = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function ErrorBox({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-2xl border border-bad/25 bg-bad/[0.06] p-4 text-[14px] text-bad">{error instanceof ApiError ? error.message : 'Could not load this moderation information.'}</div>;
}

function ReviewActions({ guildId, report }: { guildId: string; report: Report }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const action = useMutation({
    mutationFn: (choice: 'claim' | 'resolve' | 'dismiss' | 'delete' | 'timeout') => api('POST', `${base(guildId)}/reports/${report.reportId}/review`, { action: choice, note: note.trim() }),
    onSuccess: (_result, choice) => { toast(choice === 'timeout' ? 'Timeout applied and case recorded.' : 'Report updated.'); setNote(''); void queryClient.invalidateQueries({ queryKey: ['moderation-reviews', guildId] }); },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'Could not update this report.', 'bad'),
  });
  if (['resolved', 'dismissed'].includes(report.status)) return <Badge tone={report.status === 'resolved' ? 'ok' : 'neutral'}>{pretty(report.status)}</Badge>;
  const processingIsRecent = report.status === 'processing' && !!report.processingAt && Date.now() - new Date(report.processingAt).getTime() < 5 * 60_000;
  if (processingIsRecent) return <p className="text-[12px] text-muted">A moderator action is in progress. If it was interrupted, retry it after {new Date(new Date(report.processingAt!).getTime() + 5 * 60_000).toLocaleTimeString()}.</p>;
  return <div className="space-y-2">
    <label className="sr-only" htmlFor={`report-note-${report.reportId}`}>Staff-only note for report</label>
    <Input id={`report-note-${report.reportId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional staff-only note" />
    <div className="flex flex-wrap gap-2">
      {report.status !== 'processing' && report.status === 'open' && <Button size="sm" variant="outline" loading={action.isPending} onClick={() => action.mutate('claim')}><FileCheck2 className="size-3.5" /> Review</Button>}
      {report.status !== 'processing' && <><Button size="sm" variant="outline" loading={action.isPending} onClick={() => action.mutate('resolve')}>Resolve</Button><Button size="sm" variant="ghost" loading={action.isPending} onClick={() => action.mutate('dismiss')}>Dismiss</Button></>}
      <Button size="sm" variant="danger" loading={action.isPending} onClick={() => action.mutate('delete')}>Delete message</Button>
      <Button size="sm" variant="danger" loading={action.isPending} onClick={() => action.mutate('timeout')}>Timeout 1 hour</Button>
    </div>
  </div>;
}

function ReportCard({ guildId, entry }: { guildId: string; entry: Report }) {
  return <article className="rounded-2xl border border-line bg-black/15 p-4" data-testid={`report-${entry.reportId}`}>
    <div className="flex flex-wrap items-center gap-2"><Badge tone={entry.status === 'open' ? 'hazard' : entry.status === 'in_review' ? 'info' : 'neutral'}>{pretty(entry.status)}</Badge><Badge>{pretty(entry.reason)}</Badge><span className="ml-auto text-[11px] text-faint">{ago(entry.createdAt)}</span></div>
    <p className="mt-3 text-[13px]"><strong>Member:</strong> <a className="text-rust-300 hover:underline" href={`https://discord.com/users/${entry.targetId}`} target="_blank" rel="noreferrer">{entry.targetId}</a> · <strong>Reported by:</strong> {entry.reporterId}</p>
    <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-line bg-black/20 p-3 text-[13px] text-muted">{entry.contentSnapshot || 'No text content was captured.'}</p>
    {entry.details && <p className="mt-2 text-[13px] text-muted"><strong className="text-text">Reporter details:</strong> {entry.details}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-faint"><a className="inline-flex items-center gap-1 text-rust-300 hover:underline" href={entry.messageUrl} target="_blank" rel="noreferrer">Open message <ExternalLink className="size-3" /></a><span>Submitted {time(entry.createdAt)}</span>{entry.caseId && <span>Case #{entry.caseId}</span>}</div>
    {entry.reviewNote && <p className="mt-2 text-[12px] text-muted"><strong>Staff note:</strong> {entry.reviewNote}</p>}
    <div className="mt-4 border-t border-line pt-3"><ReviewActions guildId={guildId} report={entry} /></div>
  </article>;
}

function AppealCard({ guildId, entry }: { guildId: string; entry: Appeal }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const update = useMutation({
    mutationFn: (status: 'reviewing' | 'accepted' | 'denied') => api('POST', `${base(guildId)}/appeals/${entry.appealId}/review`, { status, note: note.trim() }),
    onSuccess: (_result, status) => { toast(`Appeal marked ${pretty(status).toLowerCase()}.`); setNote(''); void queryClient.invalidateQueries({ queryKey: ['moderation-reviews', guildId] }); },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'Could not update this appeal.', 'bad'),
  });
  return <article className="rounded-2xl border border-line bg-black/15 p-4" data-testid={`appeal-${entry.appealId}`}>
    <div className="flex flex-wrap items-center gap-2"><Badge tone={entry.status === 'submitted' ? 'hazard' : entry.status === 'accepted' ? 'ok' : 'info'}>{pretty(entry.status)}</Badge><span className="text-[12px] text-faint">Case #{entry.caseId} · {pretty(entry.case?.type ?? 'case')} · {ago(entry.createdAt)}</span></div>
    <p className="mt-3 text-[13px]"><strong>Member:</strong> {entry.targetId}</p>
    <div className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-line bg-black/20 p-3 text-[13px] leading-relaxed text-text">{entry.statement}</div>
    {entry.case && <p className="mt-2 text-[12px] text-muted">Original case: {entry.case.reason ?? 'No reason given'} · {pretty(entry.case.status)}</p>}
    {entry.reviewerNote && <p className="mt-2 text-[12px] text-muted"><strong>Decision note:</strong> {entry.reviewerNote}</p>}
    {!['accepted', 'denied'].includes(entry.status) && <div className="mt-4 space-y-2 border-t border-line pt-3">
      <label className="sr-only" htmlFor={`appeal-note-${entry.appealId}`}>Private staff decision note</label>
      <Input id={`appeal-note-${entry.appealId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional private decision note" />
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={update.isPending} onClick={() => update.mutate('reviewing')}>Mark reviewing</Button><Button size="sm" variant="primary" loading={update.isPending} onClick={() => update.mutate('accepted')}><ShieldCheck className="size-3.5" /> Accept appeal</Button><Button size="sm" variant="danger" loading={update.isPending} onClick={() => update.mutate('denied')}><ShieldX className="size-3.5" /> Decline</Button></div>
    </div>}
  </article>;
}

function CaseCard({ guildId, entry }: { guildId: string; entry: Case }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const notes = useMutation({
    mutationFn: () => api('POST', `${base(guildId)}/cases/${entry.caseId}/notes`, { text: note.trim() }),
    onSuccess: () => { toast('Private case note added.'); setNote(''); void queryClient.invalidateQueries({ queryKey: ['moderation-reviews', guildId] }); },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'Could not add the note.', 'bad'),
  });
  const status = useMutation({
    mutationFn: (next: 'active' | 'voided') => api('POST', `${base(guildId)}/cases/${entry.caseId}/status`, { status: next, reason: note.trim() || (next === 'voided' ? 'Voided from moderation desk.' : 'Reopened from moderation desk.') }),
    onSuccess: (_result, next) => { toast(next === 'voided' ? 'Case voided, not deleted.' : 'Case reopened.'); setNote(''); void queryClient.invalidateQueries({ queryKey: ['moderation-reviews', guildId] }); },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'Could not change the case status.', 'bad'),
  });
  return <article className="rounded-2xl border border-line bg-black/15 p-4" data-testid={`case-${entry.caseId}`}>
    <div className="flex flex-wrap items-center gap-2"><Badge>{pretty(entry.type)}</Badge><Badge tone={entry.status === 'voided' ? 'neutral' : 'ok'}>{pretty(entry.status ?? 'active')}</Badge><span className="ml-auto text-[11px] text-faint">{ago(entry.createdAt)}</span></div>
    <p className="mt-3 text-[14px] font-semibold">Case #{entry.caseId} · {entry.targetTag}</p>
    <p className="mt-1 text-[12px] text-muted">{entry.reason ?? 'No reason given'} · moderator {entry.moderatorId}</p>
    {!!entry.notes?.length && <ul className="mt-3 space-y-2 border-l border-line pl-3">{entry.notes.slice(-5).map((item, i) => <li key={`${item.createdAt}-${i}`} className="text-[12px] text-muted"><span className="font-semibold text-text">{item.moderatorId}</span> · {item.text}</li>)}</ul>}
    <div className="mt-4 space-y-2 border-t border-line pt-3"><label className="sr-only" htmlFor={`case-note-${entry.caseId}`}>Private case note or status reason</label><Textarea id={`case-note-${entry.caseId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Add a private note, or give a reason before changing case status" /><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" loading={notes.isPending} disabled={!note.trim()} onClick={() => notes.mutate()}><MessageSquareText className="size-3.5" /> Add note</Button>{entry.status !== 'voided' ? <Button size="sm" variant="danger" loading={status.isPending} disabled={note.trim().length < 5} onClick={() => status.mutate('voided')}>Void case</Button> : <Button size="sm" variant="outline" loading={status.isPending} disabled={note.trim().length < 5} onClick={() => status.mutate('active')}>Reopen case</Button>}</div></div>
  </article>;
}

export default function ModerationQueue({ guildId }: { guildId: string }) {
  const [kind, setKind] = useState<Kind>('reports');
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => { setQ(search); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, isLoading, error } = useQuery<QueueResult>({
    queryKey: ['moderation-reviews', guildId, kind, status, q, page],
    queryFn: () => get<QueueResult>(`${base(guildId)}/reviews?kind=${kind}&status=${status}&q=${encodeURIComponent(q)}&page=${page}`),
  });
  const tabs: Array<{ id: Kind; label: string; icon: typeof FileWarning }> = [{ id: 'reports', label: 'Reports', icon: FileWarning }, { id: 'appeals', label: 'Appeals', icon: ShieldCheck }, { id: 'cases', label: 'Cases', icon: FileCheck2 }];
  const filters = kind === 'reports' ? [['open', 'Open'], ['in_review', 'In review'], ['processing', 'Action in progress'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed'], ['all', 'All']] : kind === 'appeals' ? [['submitted', 'Submitted'], ['reviewing', 'Reviewing'], ['accepted', 'Accepted'], ['denied', 'Denied'], ['all', 'All']] : [['active', 'Active'], ['voided', 'Voided'], ['all', 'All']];
  return <div className="space-y-5" data-testid="moderation-queue">
    <div><p className="stamp text-rust-300">SERVER SAFETY</p><h1 className="mt-1 text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold">Moderation desk</h1><p className="mt-1 text-[14px] text-muted">Review message reports and member appeals, then keep case notes in one private place.</p></div>
    <div className="rounded-2xl border border-hazard/20 bg-hazard/[0.05] p-3 text-[12px] leading-relaxed text-muted"><strong className="text-text">Review before acting.</strong> Reports and appeals are member-submitted context, not proof by themselves. Discord permissions are checked again for each action; private staff notes are not shown in case-log messages. Voiding a case preserves its history—it does not undo the Discord action.</div>
    {kind === 'appeals' && <p className="text-[12px] text-faint">Accepting or declining records the appeal decision and adds it to the private case history; it does not automatically remove a timeout or ban.</p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Moderation record type">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" aria-pressed={kind === tab.id} onClick={() => { setKind(tab.id); setStatus(tab.id === 'reports' ? 'open' : tab.id === 'appeals' ? 'submitted' : 'active'); setPage(0); }} className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust-400', kind === tab.id ? 'border-rust-400/40 bg-rust-500/10 text-text' : 'border-line text-muted hover:bg-white/[0.04]')}><Icon className="size-4" />{tab.label}</button>; })}</div>
    <Panel title={`${pretty(kind)} queue`} description={data ? `${data.total} record${data.total === 1 ? '' : 's'} matching this view.` : 'Review pending records and follow up on previous decisions.'}>
      {kind !== 'cases' && data?.stats && <div className="grid grid-cols-2 gap-3 pb-2"><div className="rounded-xl border border-line bg-black/15 p-3"><p className="text-[11px] uppercase tracking-wide text-faint">{kind === 'appeals' ? 'Submitted' : 'Open'}{kind === 'reports' ? ' (includes retries)' : ''}</p><p className="mt-1 text-xl font-bold">{data.stats.open}</p></div><div className="rounded-xl border border-line bg-black/15 p-3"><p className="text-[11px] uppercase tracking-wide text-faint">In review</p><p className="mt-1 text-xl font-bold">{data.stats.reviewing}</p></div></div>}
      <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="sr-only" htmlFor="moderation-search">Search reports, appeals, cases, or members</label><Input id="moderation-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search case number, member, or details" />
        <label className="sr-only" htmlFor="moderation-status">Filter records by status</label><select id="moderation-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="h-10 rounded-xl border border-line bg-black/25 px-3 text-[13px] text-text">{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      {isLoading ? <PageSkeleton /> : error ? <ErrorBox error={error} /> : !data?.entries.length ? <EmptyState emoji={kind === 'reports' ? '🧾' : kind === 'appeals' ? '📨' : '📋'} title="Nothing to review" body="Try another status filter or check back when new records arrive." /> : <div className="space-y-3">{data.entries.map((entry) => kind === 'reports' ? <ReportCard key={(entry as Report).reportId} guildId={guildId} entry={entry as Report} /> : kind === 'appeals' ? <AppealCard key={(entry as Appeal).appealId} guildId={guildId} entry={entry as Appeal} /> : <CaseCard key={(entry as Case).caseId} guildId={guildId} entry={entry as Case} />)}</div>}
      {!!data && data.pages > 1 && <div className="mt-4 flex items-center justify-between border-t border-line pt-3"><Button size="sm" disabled={page === 0} onClick={() => setPage((x) => Math.max(0, x - 1))}>Previous</Button><span className="text-[12px] text-faint">Page {page + 1} of {data.pages}</span><Button size="sm" disabled={page >= data.pages - 1} onClick={() => setPage((x) => Math.min(data.pages - 1, x + 1))}>Next</Button></div>}
    </Panel>
  </div>;
}
