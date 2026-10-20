import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ArrowRight, Crown, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import { EmptyState, RequireLogin } from '@/components/dash';
import { Glass } from '@/components/Glass';
import { Eyebrow } from '@/components/Reveal';
import { Avatar, Badge, Button, buttonClass, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import type { GuildListItem } from '@/lib/types';
import { n } from '@/lib/utils';

function ServerList() {
  const { me } = useMe();
  const [fresh, setFresh] = useState(0);
  const { data, isLoading, isFetching, error, refetch } = useQuery<GuildListItem[]>({
    queryKey: ['/api/guilds', fresh],
    queryFn: () => get(`/api/guilds${fresh ? '?fresh=1' : ''}`),
  });
  const withBot = data?.filter((g) => g.botIn) ?? [];
  const without = data?.filter((g) => !g.botIn) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-5 pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Dashboard</Eyebrow>
          <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.2rem)] font-extrabold">Hey {me?.user.globalName ?? me?.user.username}, pick a server.</h1>
          <p className="mt-2 text-[15px] text-muted">Servers you manage, plus any server where a staff role lets you review logs.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => (setFresh(Date.now()), refetch())} loading={isFetching && !isLoading} data-testid="button-refresh-servers">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      )}
      {error && (
        <Glass className="mt-10 rounded-3xl">
          <EmptyState emoji="⚠️" title="Couldn't load your servers" body={(error as Error).message} action={<Button onClick={() => refetch()}>Try again</Button>} />
        </Glass>
      )}

      {data && (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {withBot.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                <Link href={g.access === 'logs' ? `/dashboard/${g.id}/incidents` : `/dashboard/${g.id}`} data-testid={`card-server-${g.id}`} className="group block rounded-3xl">
                  <Glass interactive className="flex h-full items-center gap-4 rounded-3xl p-5">
                    <Avatar src={g.icon} name={g.name} className="size-14 rounded-2xl text-[18px]" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[16px] font-bold">
                        {g.name}
                        {g.owner && <Crown className="size-3.5 shrink-0 text-hazard" aria-label="Owner" />}
                      </p>
                      <p className="text-[13px] text-muted">{g.memberCount ? `${n(g.memberCount)} members` : 'Clanky is here'}</p>
                      {g.access === 'logs' && <Badge tone="info" className="mt-1">Logs only</Badge>}
                    </div>
                    <ArrowRight className="size-5 text-faint transition-all group-hover:translate-x-1 group-hover:text-rust-300" />
                  </Glass>
                </Link>
              </motion.div>
            ))}
          </div>
          {!withBot.length && (
            <Glass className="mt-4 rounded-3xl">
              <EmptyState emoji="🔩" title="Clanky isn't in any of your servers yet" body="Add it to a server below and it'll show up here." />
            </Glass>
          )}

          {without.length > 0 && (
            <>
              <p className="stamp mt-14 text-muted">Add Clanky</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {without.map((g) => (
                  <div key={g.id} className="flex items-center gap-3.5 rounded-2xl border border-dashed border-line p-4" data-testid={`card-invite-${g.id}`}>
                    <Avatar src={g.icon} name={g.name} className="size-11 rounded-xl opacity-70 grayscale" />
                    <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-muted">{g.name}</p>
                    <a href={g.inviteUrl ?? '#'} target="_blank" rel="noopener noreferrer" className={buttonClass('outline', 'sm')}>
                      <Plus className="size-3.5" /> Add
                    </a>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-faint">After adding Clanky, press Refresh.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function Servers() {
  return (
    <RequireLogin next="/dashboard">
      <ServerList />
    </RequireLogin>
  );
}
