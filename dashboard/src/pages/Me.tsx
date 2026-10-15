import { useMutation } from '@tanstack/react-query';
import { AlertDialog } from 'radix-ui';
import { ArrowRight, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Panel, RequireLogin } from '@/components/dash';
import { Glass } from '@/components/Glass';
import { Eyebrow } from '@/components/Reveal';
import { useToast } from '@/components/Toast';
import { Avatar, Button, buttonClass, Emoji, Field, Input, Segmented, Switch } from '@/components/ui';
import { api, ApiError, queryClient } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import type { Me, Preferences } from '@/lib/types';
import { n } from '@/lib/utils';

function usePreference() {
  const toast = useToast();
  return useMutation({
    mutationFn: (patch: Partial<Preferences>) => api<{ preferences: Preferences }>('PATCH', '/api/me/preferences', patch),
    onMutate: (patch) => {
      const previous = queryClient.getQueryData<Me>(['/api/me']);
      if (previous) queryClient.setQueryData<Me>(['/api/me'], { ...previous, preferences: { ...previous.preferences, ...patch } });
      return { previous };
    },
    onSuccess: ({ preferences }) => {
      queryClient.setQueryData<Me>(['/api/me'], (old) => (old ? { ...old, preferences } : old));
      toast('Saved.');
    },
    onError: (e, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['/api/me'], ctx.previous);
      toast(e instanceof ApiError ? e.message : 'Could not save.', 'bad');
    },
  });
}

function Pref({ emoji, label, description, children }: { emoji: string; label: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/30 ring-1 ring-line">
        <Emoji e={emoji} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{label}</p>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DeleteData() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [, navigate] = useLocation();
  const toast = useToast();
  const del = useMutation({
    mutationFn: () => api('POST', '/api/me/delete', { confirm: 'DELETE' }),
    onSuccess: () => {
      queryClient.clear();
      setOpen(false);
      toast('Your data was deleted.');
      navigate('/');
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not delete your data.', 'bad'),
  });
  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => (setOpen(v), setText(''))}>
      <AlertDialog.Trigger asChild>
        <Button variant="danger" data-testid="button-delete-data">
          <Trash2 className="size-4" /> Delete my data
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade_.2s_ease-out]" />
        <AlertDialog.Content className="glass glass-strong fixed inset-x-4 top-[18vh] z-50 mx-auto max-w-md rounded-3xl p-7 data-[state=open]:animate-[pop_.25s_var(--ease-out-expo)]">
          <AlertDialog.Title className="font-display text-[24px] font-extrabold">Delete everything?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[14px] text-muted">
            This removes your preferences, Salvage progress, levels and reminders from every server. You will be logged out. This can't be undone.
          </AlertDialog.Description>
          <Field label="Type DELETE to confirm">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" className="font-mono" data-testid="input-confirm-delete" />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <Button variant="danger" disabled={text !== 'DELETE'} loading={del.isPending} onClick={() => del.mutate()} data-testid="button-confirm-delete">
              Delete forever
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function MePage() {
  const { me } = useMe();
  const pref = usePreference();
  if (!me) return null;
  const p = me.preferences;
  const set = (patch: Partial<Preferences>) => pref.mutate(patch);
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 pb-24 pt-32">
      <Eyebrow>Your account</Eyebrow>
      <Glass strong className="flex flex-wrap items-center gap-5 rounded-[28px] p-6">
        <Avatar src={me.user.avatar} name={me.user.username} className="size-20 rounded-3xl text-[26px]" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold">{me.user.globalName ?? me.user.username}</h1>
          <p className="text-[14px] text-muted">
            @{me.user.username} · {n(me.stats.commandsUsed)} commands used
          </p>
        </div>
        <Link href="/me/salvage" className={buttonClass('primary', 'md', 'group')} data-testid="link-salvage">
          <Emoji e="🔧" className="size-4" /> My Salvage <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Glass>

      <Panel title="Preferences" description="These follow you to every server. Changes save right away.">
        <Pref emoji="🔒" label="Private replies" description="Show your command replies only to you, where possible.">
          <Switch checked={p.privateReplies} onChange={(v) => set({ privateReplies: v })} label="Private replies" testId="switch-private" />
        </Pref>
        <Pref emoji="⭐" label="Level-up pings" description="Get mentioned when you level up.">
          <Switch checked={p.levelUpPings} onChange={(v) => set({ levelUpPings: v })} label="Level-up pings" testId="switch-pings" />
        </Pref>
        <Pref emoji="⏰" label="Reminders" description="Where Clanky sends your reminders.">
          <Segmented value={p.reminderDelivery} onChange={(v) => set({ reminderDelivery: v })} options={[{ value: 'dm', label: 'DM' }, { value: 'channel', label: 'Channel' }]} testId="segment-reminders" />
        </Pref>
        <Pref emoji="✨" label="Update notes" description="Hear about new Clanky features.">
          <Switch checked={p.updateNotices} onChange={(v) => set({ updateNotices: v })} label="Update notes" testId="switch-updates" />
        </Pref>
      </Panel>

      <Panel title="Your data" description="Clanky stores only what it needs: your settings, levels and game progress.">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <p className="max-w-md text-[13.5px] text-muted">Want a clean start? You can delete all your data here, or with /data delete in Discord.</p>
          <DeleteData />
        </div>
      </Panel>
    </div>
  );
}

export default function MeRoute() {
  return (
    <RequireLogin next="/me">
      <MePage />
    </RequireLogin>
  );
}
