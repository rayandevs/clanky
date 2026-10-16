import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Clock3, FileText, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Avatar, Badge, Button, Input, Skeleton } from '@/components/ui';
import { Glass } from '@/components/Glass';
import { EmptyState, Panel } from '@/components/dash';
import { ApiError, get } from '@/lib/api';
import type { TicketTranscriptDetailResponse, TicketTranscriptListResponse } from '@/lib/types';
import { ago, cn } from '@/lib/utils';

type Props = { guildId: string };

function transcriptRouteParams(location: string): URLSearchParams {
  const routeQuery = location.includes('?') ? location.slice(location.indexOf('?') + 1) : '';
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?') + 1) : '';
  return new URLSearchParams(routeQuery || window.location.search.slice(1) || hashQuery);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Could not load this transcript.';
}

export default function TicketTranscripts({ guildId }: Props) {
  const [location, navigate] = useLocation();
  const initialRoute = transcriptRouteParams(location);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(() => Number(initialRoute.get('ticketId')) || null);
  const [detailPage, setDetailPage] = useState(() => Math.max(0, Number(initialRoute.get('messagePage')) || 0));
  const [searchInput, setSearchInput] = useState(initialRoute.get('q') ?? '');
  const [search, setSearch] = useState(initialRoute.get('q') ?? '');
  const [listPage, setListPage] = useState(0);

  useEffect(() => {
    const syncRouteState = () => {
      const params = transcriptRouteParams(location);
      setSelectedTicketId(Number(params.get('ticketId')) || null);
      setDetailPage(Math.max(0, Number(params.get('messagePage')) || 0));
      setSearchInput(params.get('q') ?? '');
      setSearch(params.get('q') ?? '');
    };
    syncRouteState();
    window.addEventListener('popstate', syncRouteState);
    return () => window.removeEventListener('popstate', syncRouteState);
  }, [location]);

  const listParams = new URLSearchParams({ page: String(listPage) });
  if (search) listParams.set('q', search);
  const list = useQuery<TicketTranscriptListResponse>({
    queryKey: ['/api/guilds', guildId, 'tickets', 'transcripts', listPage, search],
    queryFn: () => get(`/api/guilds/${guildId}/tickets/transcripts?${listParams.toString()}`),
  });
  const detail = useQuery<TicketTranscriptDetailResponse>({
    queryKey: ['/api/guilds', guildId, 'tickets', 'transcripts', selectedTicketId, detailPage],
    queryFn: () => get(`/api/guilds/${guildId}/tickets/transcripts/${selectedTicketId}?page=${detailPage}`),
    enabled: Boolean(selectedTicketId),
  });

  const setTranscriptRoute = (ticketId: number | null, messagePage = 0) => {
    setSelectedTicketId(ticketId);
    setDetailPage(Math.max(0, messagePage));
    const params = new URLSearchParams();
    if (ticketId) params.set('ticketId', String(ticketId));
    if (ticketId && search) params.set('q', search);
    if (messagePage > 0) params.set('messagePage', String(messagePage));
    const query = params.toString();
    navigate(`/dashboard/${guildId}/transcripts${query ? `?${query}` : ''}`);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchInput.trim();
    setSearch(query);
    setListPage(0);
    const params = new URLSearchParams();
    if (selectedTicketId) params.set('ticketId', String(selectedTicketId));
    if (query) params.set('q', query);
    const suffix = params.toString();
    navigate(`/dashboard/${guildId}/transcripts${suffix ? `?${suffix}` : ''}`);
  };

  const selected = detail.data?.transcript;
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-5 pb-28 pt-24 sm:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={list.data?.canManage ? `/dashboard/${guildId}/tickets` : '/dashboard'} className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-white"><ArrowLeft className="size-3.5" /> {list.data?.canManage ? 'Ticket settings' : 'All servers'}</Link>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-rust-400/20 bg-rust-500/10 text-rust-300"><FileText className="size-5" /></div>
            <div><h1 className="font-display text-3xl font-extrabold tracking-tight">Ticket transcripts</h1><p className="mt-1 text-[13px] text-muted">A searchable record of tickets closed after transcript storage was enabled.</p></div>
          </div>
        </div>
        {list.data && <Badge tone={list.data.canManage ? 'ok' : 'neutral'}><ShieldCheck className="size-3" /> {list.data.canManage ? 'Manage Server' : 'Ticket staff access'}</Badge>}
      </div>

      {list.isError ? (
        <Glass className="rounded-3xl p-5"><EmptyState emoji="🔒" title="Transcript access unavailable" body={errorMessage(list.error)} /></Glass>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Panel title="Closed tickets" description={list.data ? `${list.data.total.toLocaleString()} available transcript${list.data.total === 1 ? '' : 's'} · newest first` : 'Find a ticket by number, panel, category, or opener.'}>
            <form onSubmit={submitSearch} className="flex gap-2 py-2">
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search tickets…" aria-label="Search ticket transcripts" data-testid="input-transcript-search" />
              <Button type="submit" variant="outline" size="icon" aria-label="Search transcripts" data-testid="button-transcript-search"><Search className="size-4" /></Button>
            </form>
            {list.isLoading ? (
              <div className="space-y-2 py-2">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-2xl" />)}</div>
            ) : list.data?.entries.length ? (
              <div className="space-y-2 py-2" data-testid="transcript-list">
                {list.data.entries.map((entry) => (
                  <button
                    key={entry.ticketId}
                    type="button"
                    aria-pressed={entry.ticketId === selectedTicketId}
                    onClick={() => setTranscriptRoute(entry.ticketId)}
                    className={cn('w-full rounded-2xl border p-3 text-left transition-colors', entry.ticketId === selectedTicketId ? 'border-rust-400/40 bg-rust-500/10' : 'border-line bg-black/15 hover:border-white/20 hover:bg-white/[0.03]')}
                    data-testid={`button-open-transcript-${entry.ticketId}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={null} name={entry.openerDisplayName} className="size-9 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-bold">Ticket #{entry.ticketId}</span><span className="text-[10px] text-faint">{ago(entry.closedAt)}</span></div>
                        <p className="mt-0.5 truncate text-[12px] text-muted">{entry.openerDisplayName} · {entry.panelTitle}</p>
                        <p className="mt-1 truncate text-[11px] text-faint">{entry.categoryLabel || 'No category'} · {entry.messageCount} messages{entry.truncated ? ' · capped' : ''}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <div className="flex items-center justify-between pt-2 text-[11px] text-faint">
                  <span>Page {listPage + 1} of {list.data.pages}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label="Previous transcript page" disabled={listPage <= 0} onClick={() => setListPage((page) => page - 1)}><ChevronLeft className="size-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Next transcript page" disabled={listPage + 1 >= list.data.pages} onClick={() => setListPage((page) => page + 1)}><ChevronRight className="size-4" /></Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-5"><EmptyState emoji="🧾" title={search ? 'No matching tickets' : 'No stored transcripts yet'} body={search ? 'Try another ticket number, panel, category, or member name.' : 'Transcripts are saved when a ticket is closed. Older text files are not imported.'} /></div>
            )}
          </Panel>

          <Panel title={selected ? `Ticket #${selected.ticketId}` : 'Transcript detail'} description={selected ? `${selected.panelTitle}${selected.categoryLabel ? ` · ${selected.categoryLabel}` : ''}` : 'Choose a ticket from the list to read its conversation.'}>
            {detail.isLoading && selectedTicketId ? <div className="space-y-3 py-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-2xl" />)}</div> : detail.isError ? (
              <div className="py-6"><EmptyState emoji="🔒" title="Could not open transcript" body={errorMessage(detail.error)} /></div>
            ) : selected ? (
              <>
                <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-black/15 p-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3"><Avatar src={selected.openerAvatarUrl} name={selected.openerDisplayName} className="size-10 rounded-xl" /><div><p className="text-[13px] font-semibold">{selected.openerDisplayName}</p><p className="text-[11px] text-faint">Opened {formatDate(selected.createdAt)}</p></div></div>
                  <div className="flex items-center gap-2 text-[12px] text-muted"><Clock3 className="size-4 shrink-0 text-rust-300" /><span>Closed {formatDate(selected.closedAt)} · {selected.messageCount} messages</span></div>
                  <div className="grid gap-1 text-[12px] text-muted sm:grid-cols-2">
                    <p>Closed by <span className="font-semibold text-white">{selected.closedByName || selected.closedBy}</span></p>
                    {selected.claimedBy && <p>Claimed by <span className="font-semibold text-white">{selected.claimedByName || selected.claimedBy}</span></p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {selected.expiresAt ? <Badge tone="neutral">Expires {formatDate(selected.expiresAt)}</Badge> : <Badge tone="ok">Kept indefinitely</Badge>}
                    {selected.truncated && <Badge tone="hazard"><AlertTriangle className="size-3" /> Most recent 1,000 only</Badge>}
                  </div>
                  {selected.closeReason && <p className="text-[12px] text-muted sm:col-span-2"><span className="font-semibold text-white">Close reason:</span> {selected.closeReason}</p>}
                </div>
                {selected.answers.length > 0 && (
                  <div className="mb-4 rounded-2xl border border-line bg-black/15 p-4">
                    <p className="stamp text-[10px] text-faint">INTAKE ANSWERS</p>
                    <div className="mt-3 space-y-3">{selected.answers.map((answer) => <div key={answer.questionId}><p className="text-[12px] font-semibold">{answer.label}</p><p className="mt-1 whitespace-pre-wrap break-words text-[12px] text-muted">{answer.answer || 'No answer provided'}</p></div>)}</div>
                  </div>
                )}
                <div className="space-y-3" data-testid="transcript-messages">
                  {detail.data!.messages.length ? detail.data!.messages.map((message) => (
                    <article key={message.messageId} className="flex gap-3 rounded-2xl border border-line bg-black/10 p-3.5">
                      <Avatar src={message.authorAvatarUrl} name={message.authorName} className="mt-0.5 size-8 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className={cn('text-[12px] font-bold', message.isBot && 'text-rust-300')}>{message.authorName}</span><span className="font-mono text-[10px] text-faint">{formatDate(message.createdAt)}</span></div>
                        {message.content && <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted">{message.content}</p>}
                        {message.embeds.map((embed, index) => <div key={index} className="mt-2 rounded-lg border-l-2 border-rust-400 bg-white/[0.03] px-3 py-2 text-[12px]">{embed.title && <p className="font-semibold text-white">{embed.title}</p>}{embed.description && <p className="mt-1 whitespace-pre-wrap break-words text-muted">{embed.description}</p>}{embed.fields.map((field) => <p key={field.name} className="mt-1 text-muted"><strong className="text-white">{field.name}:</strong> {field.value}</p>)}</div>)}
                        {message.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.attachments.map((attachment) => attachment.contentType?.startsWith('image/') ? <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="block max-w-full overflow-hidden rounded-lg border border-line"><img src={attachment.url} alt={attachment.name} loading="lazy" className="max-h-64 max-w-full object-contain" /></a> : <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-[11px] text-rust-300 hover:bg-white/[0.04]">{attachment.name}</a>)}</div>}
                      </div>
                    </article>
                  )) : <EmptyState emoji="💬" title="No message rows" body="The ticket may have closed without any available messages." />}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-faint">
                  <span>Messages page {detailPage + 1} of {detail.data!.messagePages}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label="Previous messages" disabled={detailPage <= 0} onClick={() => setTranscriptRoute(selected.ticketId, detailPage - 1)}><ChevronLeft className="size-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Next messages" disabled={detailPage + 1 >= detail.data!.messagePages} onClick={() => setTranscriptRoute(selected.ticketId, detailPage + 1)}><ChevronRight className="size-4" /></Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8"><EmptyState emoji="📨" title="Select a closed ticket" body="Intake answers, staff activity, messages, embeds, and attachments will appear here." /></div>
            )}
          </Panel>
        </div>
      )}
      <p className="flex items-center gap-2 text-[11px] text-faint"><ShieldCheck className="size-3.5" /> Transcript access is limited to Manage Server users and configured ticket staff; archived attachments follow server retention and are permission-checked.</p>
    </div>
  );
}
