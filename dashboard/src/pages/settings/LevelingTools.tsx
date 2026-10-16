import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, Award, BarChart3, Check, Clock3, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Panel } from '@/components/dash';
import { SingleRolePicker } from '@/components/pickers';
import { useToast } from '@/components/Toast';
import { Avatar, Badge, Button, Field, Input } from '@/components/ui';
import { api, get, queryClient } from '@/lib/api';
import type { Role, UserSummary } from '@/lib/types';
import { ago, n } from '@/lib/utils';

type Season = { seasonId: string; name: string; active: boolean; startedAt: string; endedAt: string | null; rewardRoleId: string | null; rewardTopCount: number };
type Analytics = {
  days: Array<{ day: string; messages: number; xp: number; activeMembers: number }>;
  summary: { messages: number; xp: number; activeMembers: number };
  topGainers: Array<{ userId: string; xp: number; messages: number; user: UserSummary }>;
  seasons: Season[];
  seasonLeaderboard: { season: Season | null; total: number; entries: Array<{ rank: number; xp: number; user: UserSummary }> };
};
type RewardPreview = { membersChecked: number; membersSkipped: number; membersChanged: number; rolesAdded: number; rolesRemoved: number; rolesNotAssignable: string[]; changes: Array<{ userId: string; add: string[]; remove: string[] }> };
type SeasonPreview = { season: Season; winners: Array<{ rank: number; xp: number; user: UserSummary }> };

export default function LevelingTools({ guildId, roles, rewardSettingsUnsaved = false }: { guildId: string; roles: Role[]; rewardSettingsUnsaved?: boolean }) {
  const toast = useToast();
  const [seasonName, setSeasonName] = useState('');
  const [rewardRoleId, setRewardRoleId] = useState<string | null>(null);
  const [rewardTopCount, setRewardTopCount] = useState(3);
  const [pendingEnd, setPendingEnd] = useState(false);
  const [rewardPreview, setRewardPreview] = useState<RewardPreview | null>(null);
  const [seasonPreview, setSeasonPreview] = useState<SeasonPreview | null>(null);
  const queryKey = ['/api/guilds', guildId, 'leveling', 'analytics', 14];
  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey,
    queryFn: () => get(`/api/guilds/${guildId}/leveling/analytics?days=14`),
    staleTime: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const startSeason = useMutation({
    mutationFn: () => api('POST', `/api/guilds/${guildId}/leveling/seasons`, { name: seasonName.trim(), rewardRoleId, rewardTopCount }),
    onSuccess: async () => { toast('Season started'); setSeasonName(''); setSeasonPreview(null); await refresh(); },
    onError: (e) => toast((e as Error).message, 'bad'),
  });
  const endSeason = useMutation({
    mutationFn: () => api('POST', `/api/guilds/${guildId}/leveling/seasons/end`, { confirm: true }),
    onSuccess: async () => { toast('Season ended; lifetime XP was not changed'); setPendingEnd(false); await refresh(); },
    onError: (e) => toast((e as Error).message, 'bad'),
  });
  const previewRewards = useMutation({
    mutationFn: () => api<RewardPreview>('POST', `/api/guilds/${guildId}/leveling/rewards/preview`, {}),
    onSuccess: (result) => { setRewardPreview(result); toast('Reward-role preview is ready', 'info'); },
    onError: (e) => toast((e as Error).message, 'bad'),
  });
  const syncRewards = useMutation({
    mutationFn: () => api<{ membersChanged: number; rolesAdded: number; rolesRemoved: number; membersSkipped: number }>('POST', `/api/guilds/${guildId}/leveling/rewards/sync`, { confirm: true }),
    onSuccess: async (result) => { toast(`Updated ${n(result.membersChanged)} members · ${n(result.rolesAdded)} roles added · ${n(result.rolesRemoved)} removed`); setRewardPreview(null); await refresh(); },
    onError: (e) => toast((e as Error).message, 'bad'),
  });
  const previewSeason = useMutation({
    mutationFn: (seasonId: string) => api<SeasonPreview>('POST', `/api/guilds/${guildId}/leveling/season-rewards/preview`, { seasonId }),
    onSuccess: setSeasonPreview,
    onError: (e) => toast((e as Error).message, 'bad'),
  });
  const grantSeason = useMutation({
    mutationFn: () => api<{ granted: number; winners: number }>('POST', `/api/guilds/${guildId}/leveling/season-rewards/grant`, { seasonId: seasonPreview!.season.seasonId, confirm: true }),
    onSuccess: async (result) => { toast(`Granted winner roles to ${result.granted} of ${result.winners} winners`); setSeasonPreview(null); await refresh(); },
    onError: (e) => toast((e as Error).message, 'bad'),
  });

  const activeSeason = data?.seasons.find((season) => season.active);
  const maxMessages = Math.max(1, ...(data?.days.map((day) => day.messages) ?? []));
  const maxXp = Math.max(1, ...(data?.days.map((day) => day.xp) ?? []));
  const maxActive = Math.max(1, ...(data?.days.map((day) => day.activeMembers) ?? []));
  const assignableRoles = roles.filter((role) => role.assignable && !role.managed);

  return (
    <div className="space-y-5">
      <Panel title="Leveling activity" description="Daily totals are stored in UTC. Message history begins when all-message tracking was introduced; no message content is stored." emoji="📈">
        {isLoading ? <p className="py-4 text-[13px] text-muted">Loading activity…</p> : error || !data ? <p className="py-4 text-[13px] text-faint">Activity data is not available yet.</p> : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Metric icon={<Activity className="size-4" />} label="Messages · 14 days" value={data.summary.messages} />
              <Metric icon={<Trophy className="size-4" />} label="XP awarded" value={data.summary.xp} />
              <Metric icon={<Users className="size-4" />} label="Active members" value={data.summary.activeMembers} />
            </div>
            <div className="mt-5 rounded-2xl border border-line bg-black/15 p-3 sm:p-4">
              <div className="flex h-40 items-end gap-1 overflow-x-auto pb-1" aria-label="Daily message and XP chart">
                {data.days.map((day) => (
                  <div key={day.day} title={`${day.day}: ${n(day.messages)} messages · ${n(day.xp)} XP · ${n(day.activeMembers)} active`} className="group flex h-full min-w-3 flex-1 items-end justify-center gap-[2px]">
                    <span className="w-1/3 rounded-t-sm bg-rust-400/80" style={{ height: `${Math.max(day.messages ? 3 : 0, (day.messages / maxMessages) * 100)}%` }} />
                    <span className="w-1/3 rounded-t-sm bg-steel-300/70" style={{ height: `${Math.max(day.xp ? 3 : 0, (day.xp / maxXp) * 100)}%` }} />
                    <span className="w-1/3 rounded-t-sm bg-ok/70" style={{ height: `${Math.max(day.activeMembers ? 3 : 0, (day.activeMembers / maxActive) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-rust-400" /> Messages</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-steel-300" /> XP</span>
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-ok" /> Active members</span>
                <span className="ml-auto flex items-center gap-1.5"><BarChart3 className="size-3.5" /> Last 14 days</span>
              </div>
            </div>
            <div className="mt-5">
              <p className="stamp mb-2 text-muted">Top XP gainers · 14 days</p>
              {data.topGainers.length ? data.topGainers.map((row, index) => (
                <div key={row.userId} className="flex items-center gap-3 border-t border-line py-2.5">
                  <span className="w-5 text-center font-mono text-[12px] text-faint">{index + 1}</span>
                  <Avatar src={row.user.avatar} name={row.user.name} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{row.user.name}</span>
                  <span className="text-right text-[12px] text-muted">{n(row.xp)} XP</span>
                </div>
              )) : <p className="py-3 text-[13px] text-faint">No XP activity in this period yet.</p>}
            </div>
          </>
        )}
      </Panel>

      <Panel title="Level rewards" description="Review the exact role changes before applying updated milestone rewards to current members." emoji="🏆">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => previewRewards.mutate()} disabled={previewRewards.isPending || !roles.length || rewardSettingsUnsaved} data-testid="button-preview-level-rewards">
            <ShieldCheck className="size-4" /> {previewRewards.isPending ? 'Checking…' : 'Preview role changes'}
          </Button>
          {rewardSettingsUnsaved && <span className="text-[12px] text-hazard">Save your leveling settings first.</span>}
          {rewardPreview && <Badge tone="info">{n(rewardPreview.membersChecked)} checked · {n(rewardPreview.membersSkipped)} not in server</Badge>}
        </div>
        {rewardPreview && (
          <div className="mt-4 rounded-2xl border border-line bg-black/15 p-4">
            <p className="text-[13px] font-semibold">{n(rewardPreview.membersChanged)} members would change · {n(rewardPreview.rolesAdded)} roles added · {n(rewardPreview.rolesRemoved)} removed</p>
            {rewardPreview.changes.length > 0 && <p className="mt-1 text-[12px] text-muted">Preview includes the first {rewardPreview.changes.length} affected accounts. Members whose reward roles are above Clanky’s role are left untouched.</p>}
            {rewardPreview.rolesNotAssignable.length > 0 && <p className="mt-2 text-[12px] text-hazard">{rewardPreview.rolesNotAssignable.length} configured reward role(s) are missing or above Clanky’s role and will be skipped.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" disabled={syncRewards.isPending || rewardPreview.membersChanged === 0} onClick={() => syncRewards.mutate()} data-testid="button-confirm-level-reward-sync">
                <RefreshCw className="size-4" /> {syncRewards.isPending ? 'Applying…' : 'Apply these changes'}
              </Button>
              <Button variant="ghost" onClick={() => setRewardPreview(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Seasons" description="Run separate, manually controlled competitions. Lifetime XP and rank are never reset." emoji="🏅">
        {activeSeason ? (
          <div className="rounded-2xl border border-ok/20 bg-ok/[0.05] p-4">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="ok">Active</Badge><p className="font-semibold">{activeSeason.name}</p><span className="ml-auto flex items-center gap-1 text-[11px] text-faint"><Clock3 className="size-3.5" /> Started {ago(activeSeason.startedAt)}</span></div>
            <p className="mt-2 text-[12px] text-muted">Season XP is tracked separately. Ending a season freezes its leaderboard; it does not touch lifetime XP.</p>
            {data?.seasonLeaderboard.entries.length ? <div className="mt-4 rounded-xl border border-line bg-black/15 px-3">
              <p className="stamp py-2 text-muted">LIVE SEASON LEADERBOARD · TOP 10 OF {n(data.seasonLeaderboard.total)}</p>
              {data.seasonLeaderboard.entries.map((entry) => <div key={entry.user.id} className="flex items-center gap-2 border-t border-line py-2"><span className="w-6 text-center font-mono text-[11px] text-faint">#{entry.rank}</span><Avatar src={entry.user.avatar} name={entry.user.name} className="size-7" /><span className="min-w-0 flex-1 truncate text-[12px] font-medium">{entry.user.name}</span><span className="font-mono text-[12px] text-muted">{n(entry.xp)} XP</span></div>)}
            </div> : <p className="mt-4 rounded-xl border border-line bg-black/15 p-3 text-[12px] text-faint">No seasonal XP has been earned yet.</p>}
            {pendingEnd ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-auto text-[12px] text-muted">End “{activeSeason.name}” now?</span>
                <Button variant="danger" onClick={() => endSeason.mutate()} disabled={endSeason.isPending}>{endSeason.isPending ? 'Ending…' : 'Confirm end'}</Button>
                <Button variant="ghost" onClick={() => setPendingEnd(false)}>Keep running</Button>
              </div>
            ) : <Button className="mt-4" variant="outline" onClick={() => setPendingEnd(true)} data-testid="button-end-season">End season</Button>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_110px_auto] md:items-end">
            <Field label="Season name"><Input value={seasonName} onChange={(event) => setSeasonName(event.target.value)} placeholder="Autumn 2026" maxLength={80} data-testid="input-season-name" /></Field>
            <Field label="Winner role" description="Optional; only granted after reviewing the final standings."><SingleRolePicker value={rewardRoleId} onChange={setRewardRoleId} roles={assignableRoles} testId="picker-season-reward-role" /></Field>
            <Field label="Reward places"><Input type="number" min={1} max={100} value={rewardTopCount} onChange={(event) => setRewardTopCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></Field>
            <Button variant="primary" onClick={() => startSeason.mutate()} disabled={startSeason.isPending || !seasonName.trim()} data-testid="button-start-season"><Trophy className="size-4" /> Start season</Button>
          </div>
        )}
        {seasonPreview && (
          <div className="mt-4 rounded-2xl border border-line bg-black/15 p-4">
            <p className="font-semibold">Final rewards · {seasonPreview.season.name}</p>
            {seasonPreview.winners.map((winner) => <p key={winner.user.id} className="mt-2 text-[13px] text-muted">#{winner.rank} {winner.user.name} · {n(winner.xp)} seasonal XP</p>)}
            <div className="mt-4 flex gap-2"><Button variant="primary" disabled={grantSeason.isPending || !seasonPreview.season.rewardRoleId || !seasonPreview.winners.length} onClick={() => grantSeason.mutate()}><Award className="size-4" /> {grantSeason.isPending ? 'Granting…' : 'Confirm winner roles'}</Button><Button variant="ghost" onClick={() => setSeasonPreview(null)}>Cancel</Button></div>
          </div>
        )}
        {data?.seasons.filter((season) => !season.active).length ? <div className="mt-5 space-y-2 border-t border-line pt-4">
          <p className="stamp text-muted">Past seasons</p>
          {data.seasons.filter((season) => !season.active).map((season) => <div key={season.seasonId} className="flex flex-wrap items-center gap-2 text-[13px]"><span className="flex-1 font-medium">{season.name}</span><span className="text-[11px] text-faint">Ended {season.endedAt ? ago(season.endedAt) : '—'}</span><Button size="sm" variant="ghost" disabled={previewSeason.isPending} onClick={() => previewSeason.mutate(season.seasonId)}><Check className="size-3.5" /> Review winners</Button></div>)}
        </div> : null}
      </Panel>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-line bg-black/15 p-3"><div className="flex items-center gap-1.5 text-faint">{icon}<span className="stamp text-[9px]">{label}</span></div><p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{n(value)}</p></div>;
}
