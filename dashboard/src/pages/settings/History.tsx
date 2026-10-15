import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BrandSpinner, EmptyState, Panel } from '@/components/dash';
import { Avatar, Badge, Button } from '@/components/ui';
import { get } from '@/lib/api';
import type { UserSummary } from '@/lib/types';
import { ago, DEMO } from '@/lib/utils';
import { SectionHeader } from './shared';

interface AuditPage {
  total: number;
  page: number;
  pages: number;
  entries: Array<{ section: string; source: string; actor: UserSummary; before: unknown; after: unknown; createdAt: string }>;
}

/** Which fields changed between two versions of a section. */
function changedKeys(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k]));
}

const human = (key: string) => key.replace(/Ids?$/, '').replace(/([A-Z])/g, ' $1').toLowerCase().trim();

export default function History({ guildId }: { guildId: string }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery<AuditPage>({
    queryKey: ['/api/guilds', guildId, 'audit', page],
    queryFn: () =>
      DEMO
        ? Promise.resolve({ total: 0, page: 0, pages: 1, entries: [] })
        : get(`/api/guilds/${guildId}/audit?page=${page}`),
  });
  return (
    <div className="space-y-5">
      <SectionHeader emoji="📝" title="Change history" description="Every settings change from Discord or the dashboard, kept for 90 days." />
      <Panel>
        {isLoading && <BrandSpinner />}
        {data && !data.entries.length && <EmptyState emoji="🔧" title="No changes yet" body={DEMO ? 'History shows up here once you change settings on a live server.' : 'Change something and it shows up here.'} />}
        {data?.entries.map((a, i) => {
          const keys = changedKeys(a.before, a.after);
          return (
            <div key={i} className="flex items-start gap-3 py-3.5">
              <Avatar src={a.actor.avatar} name={a.actor.name} className="mt-0.5 size-9" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px]">
                  <span className="font-semibold">{a.actor.name}</span> changed <span className="font-semibold capitalize">{a.section}</span>
                </p>
                {keys.length > 0 && <p className="truncate text-[13px] text-muted">{keys.map(human).join(', ')}</p>}
              </div>
              <Badge tone={a.source === 'dashboard' ? 'rust' : 'info'}>{a.source === 'dashboard' ? 'Web' : 'Discord'}</Badge>
              <span className="w-16 shrink-0 text-right text-[12px] text-faint">{ago(a.createdAt)}</span>
            </div>
          );
        })}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" /> Newer
            </Button>
            <span className="font-mono text-[12px] text-faint">
              {page + 1} / {data.pages}
            </span>
            <Button size="sm" variant="ghost" disabled={page + 1 >= data.pages} onClick={() => setPage((p) => p + 1)}>
              Older <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
