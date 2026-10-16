import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, Panel } from '@/components/dash';
import { Button, Input, Badge } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { api, get, queryClient } from '@/lib/api';
import type { SuggestionQueueEntry, SuggestionQueueResponse, SuggestionStatus } from '@/lib/types';
import { ago, n } from '@/lib/utils';

const STATUS: Record<SuggestionStatus, { label: string; tone: 'neutral' | 'rust' | 'ok' | 'bad' | 'info' | 'hazard' }> = {
  pending: { label: 'Open for votes', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'hazard' },
  planned: { label: 'Planned', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  approved: { label: 'Approved', tone: 'ok' },
  denied: { label: 'Declined', tone: 'bad' },
  implemented: { label: 'Implemented', tone: 'rust' },
};
const STATUSES = Object.keys(STATUS) as SuggestionStatus[];
const statusName = (status: SuggestionStatus) => STATUS[status].label;

export default function SuggestionsQueue({ guildId }: { guildId: string }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'votes'>('newest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [draftStatus, setDraftStatus] = useState<Record<number, SuggestionStatus>>({});
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>({});
  const toast = useToast();
  const params = new URLSearchParams({ page: String(page), sort });
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (search.trim()) params.set('q', search.trim());
  const query = useQuery<SuggestionQueueResponse>({
    queryKey: ['/api/guilds', guildId, 'suggestions', params.toString()],
    queryFn: () => get(`/api/guilds/${guildId}/suggestions?${params.toString()}`),
    staleTime: 15_000,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId, 'suggestions'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId], exact: true });
  };
  const review = useMutation({
    mutationFn: (entry: SuggestionQueueEntry) => api('POST', `/api/guilds/${guildId}/suggestions/${entry.suggestionId}/review`, {
      status: draftStatus[entry.suggestionId] ?? entry.status,
      note: draftNotes[entry.suggestionId] ?? entry.reviewNote ?? '',
    }),
    onSuccess: () => { toast('Review saved.'); refresh(); },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not save the review.', 'bad'),
  });
  const retry = useMutation({
    mutationFn: (suggestionId: number) => api('POST', `/api/guilds/${guildId}/suggestions/${suggestionId}/retry`, {}),
    onSuccess: () => { toast('Suggestion post recovered.'); refresh(); },
    onError: (error) => toast(error instanceof Error ? error.message : 'Could not recover the suggestion post.', 'bad'),
  });

  const data = query.data;
  return (
    <div className="space-y-5">
      <Panel title="Suggestions at a glance" emoji="📊" description="A quick view of review workload and the ideas getting the most support.">
        {data ? (
          <>
            <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-4">
              <Metric label="Waiting" value={data.stats.byStatus.pending} />
              <Metric label="Under review" value={data.stats.byStatus.under_review} />
              <Metric label="Failed posts" value={data.stats.failedPosts} />
              <Metric label="Oldest waiting" value={data.stats.oldestPendingAt ? ago(data.stats.oldestPendingAt) : '—'} />
            </div>
            {data.stats.topSupported.length > 0 && <p className="border-t border-line py-3 text-[13px] text-muted"><span className="font-semibold text-text">Most supported:</span> {data.stats.topSupported.map((item) => `#${item.suggestionId} ${item.title} (${item.votes})`).join(' · ')}</p>}
          </>
        ) : <div className="py-4 text-[13px] text-muted">{query.isLoading ? 'Loading suggestion stats…' : 'Suggestion stats are unavailable.'}</div>}
      </Panel>

      <Panel title="Review queue" emoji="💡" description="Reviewers can change status and add a note. Meaningful status changes are sent to the author and reflected on the Discord post.">
        <div className="flex flex-col gap-2 py-3 md:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search title, description, category or #ID" className="pl-9" data-testid="input-suggestion-search" />
          </label>
          <select aria-label="Filter suggestions by status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="h-10 rounded-xl border border-line bg-black/25 px-3 text-[14px] text-text">
            <option value="all">All statuses</option><option value="failed">Posting failed</option>
            {STATUSES.map((status) => <option key={status} value={status}>{statusName(status)}</option>)}
          </select>
          <select aria-label="Sort suggestions" value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(0); }} className="h-10 rounded-xl border border-line bg-black/25 px-3 text-[14px] text-text">
            <option value="newest">Newest</option><option value="oldest">Oldest first</option><option value="votes">Most votes</option>
          </select>
        </div>
        {query.isLoading && <p className="py-6 text-center text-[14px] text-muted">Loading the review queue…</p>}
        {query.error && <p className="py-6 text-center text-[14px] text-bad">{query.error instanceof Error ? query.error.message : 'Could not load suggestions.'}</p>}
        {data && !data.entries.length && <EmptyState emoji="🫧" title="No suggestions match" body="Try another status filter or search term." />}
        {data?.entries.map((entry) => {
          const status = STATUS[entry.status];
          const votes = entry.upvotes.length + entry.downvotes.length;
          const note = draftNotes[entry.suggestionId] ?? entry.reviewNote ?? '';
          return (
            <article key={entry.suggestionId} className="border-t border-line py-5" data-testid={`suggestion-${entry.suggestionId}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold">#{entry.suggestionId} · {entry.title}</h3>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {entry.category && <Badge>{entry.category}</Badge>}
                    {entry.anonymous && <Badge>Publicly anonymous</Badge>}
                    {entry.postStatus !== 'posted' && <Badge tone={entry.postStatus === 'failed' ? 'bad' : 'hazard'}>Post {entry.postStatus}</Badge>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{entry.content}</p>
                  <p className="mt-2 text-[12px] text-faint">Submitted by <span className="text-muted">{entry.author.name}</span> · {ago(entry.createdAt)} · 👍 {n(entry.upvotes.length)} · 👎 {n(entry.downvotes.length)} · {n(votes)} total votes</p>
                </div>
                {entry.messageId && <a className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-semibold text-muted hover:bg-white/[0.05] hover:text-text" href={`https://discord.com/channels/${guildId}/${entry.channelId}/${entry.messageId}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Discord</a>}
              </div>
              {entry.postStatus !== 'posted' ? (
                <div className="mt-4 rounded-xl border border-hazard/20 bg-hazard/[0.05] p-3">
                  <p className="text-[13px] text-muted">{entry.postError ?? 'This suggestion was saved but is not yet visible in Discord.'}</p>
                  <Button className="mt-3" size="sm" loading={retry.isPending} onClick={() => retry.mutate(entry.suggestionId)}><RefreshCw className="size-3.5" /> Retry Discord post</Button>
                </div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(170px,0.35fr)_minmax(0,1fr)_auto]">
                  <select aria-label={`New status for suggestion ${entry.suggestionId}`} value={draftStatus[entry.suggestionId] ?? entry.status} onChange={(e) => setDraftStatus((items) => ({ ...items, [entry.suggestionId]: e.target.value as SuggestionStatus }))} className="h-10 rounded-xl border border-line bg-black/25 px-3 text-[13px] text-text">
                    {STATUSES.map((next) => <option key={next} value={next}>{statusName(next)}</option>)}
                  </select>
                  <Input value={note} onChange={(e) => setDraftNotes((items) => ({ ...items, [entry.suggestionId]: e.target.value }))} placeholder="Optional note for the author" maxLength={500} aria-label={`Review note for suggestion ${entry.suggestionId}`} />
                  <Button variant="primary" size="sm" loading={review.isPending} onClick={() => review.mutate(entry)} data-testid={`button-review-${entry.suggestionId}`}>Save review</Button>
                </div>
              )}
              {entry.reviewHistory.length > 0 && <details className="mt-3 text-[12px] text-faint"><summary className="cursor-pointer select-none font-semibold text-muted">Review history · {entry.reviewHistory.length}</summary><div className="mt-2 space-y-1.5">{[...entry.reviewHistory].reverse().slice(0, 8).map((item, i) => <p key={`${item.changedAt}-${i}`}>{ago(item.changedAt)} · <span className="text-text">{item.reviewer.name}</span> set <span className="text-text">{statusName(item.status)}</span>{item.note ? ` — ${item.note}` : ''}</p>)}</div></details>}
            </article>
          );
        })}
        {data && data.pages > 1 && <div className="flex items-center justify-between border-t border-line pt-4"><span className="text-[12px] text-faint">Page {data.page + 1} of {data.pages} · {n(data.total)} suggestions</span><div className="flex gap-2"><Button size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button><Button size="sm" disabled={page + 1 >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>}
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-line bg-black/15 p-3"><p className="stamp text-faint">{label}</p><p className="mt-1 text-[20px] font-bold tabular-nums">{typeof value === 'number' ? n(value) : value}</p></div>;
}
