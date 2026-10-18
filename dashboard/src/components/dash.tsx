import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, queryClient } from '@/lib/api';
import { useLogin, useMe } from '@/lib/hooks';
import type { GuildSettings, SectionId, SettingsPayload } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Glass } from './Glass';
import { ClankyLoader } from './ClankyLoader';
import { DiscordGlyph } from './Nav';
import { useToast } from './Toast';
import { Button, Emoji, Skeleton, Switch } from './ui';

/* ───────────────────────── Login gate ───────────────────────── */

export function RequireLogin({ children, next }: { children: ReactNode; next: string }) {
  const { me, isLoading, loggedOut, error } = useMe();
  const login = useLogin();
  if (isLoading) return <PageSkeleton />;
  if (loggedOut || !me) {
    return (
      <div className="grid min-h-[100dvh] place-items-center px-5 pt-20">
        <Glass strong className="w-full max-w-md rounded-[28px] p-10 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-black/30 ring-1 ring-line">
            <Lock className="size-7 text-rust-300" />
          </div>
          <h1 className="mt-6 text-[30px] font-extrabold">Log in to continue</h1>
          <p className="mt-2 text-[15px] text-muted">{error && !loggedOut ? "We couldn't reach Clanky. Try again in a moment." : 'Use your Discord account. Clanky only sees your name and your servers.'}</p>
          <Button variant="primary" size="lg" className="mt-8 w-full" onClick={() => login(next)} data-testid="button-login-gate">
            <DiscordGlyph className="size-5" /> Log in with Discord
          </Button>
        </Glass>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-32">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-4 h-5 w-96 max-w-full" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Layout bits ───────────────────────── */

export function Panel({ title, description, children, className, action, emoji }: { title?: string; description?: ReactNode; children: ReactNode; className?: string; action?: ReactNode; emoji?: string }) {
  return (
    <Glass className={cn('rounded-3xl p-5 sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="flex items-center gap-2 font-sans text-[17px] font-bold tracking-normal">
                {emoji && <Emoji e={emoji} className="size-[18px]" />}
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-[13.5px] text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="divide-y divide-line">{children}</div>
    </Glass>
  );
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <Emoji e={emoji} className="size-12" />
      </motion.div>
      <p className="mt-4 text-[16px] font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-[14px] text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function BrandSpinner() {
  return <ClankyLoader size="compact" className="py-24" />;
}

/* ───────────────────────── Settings drafts ───────────────────────── */

export const settingsKey = (guildId: string) => ['/api/guilds', guildId, 'settings'];

export function useGuildSettings(guildId: string) {
  return useQuery<SettingsPayload>({ queryKey: settingsKey(guildId) });
}

/**
 * Local draft of one settings section. Edits stay local until Save.
 * Returns helpers for the floating save bar.
 */
export function useDraft<S extends SectionId>(guildId: string, section: S, saved: GuildSettings[S] | undefined) {
  const [draft, setDraft] = useState<GuildSettings[S] | undefined>(saved);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const savedJson = JSON.stringify(saved);
  useEffect(() => setDraft(saved), [savedJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => draft !== undefined && JSON.stringify(draft) !== savedJson, [draft, savedJson]);
  const mutation = useMutation({
    mutationFn: (value: GuildSettings[S]) => api<{ settings: GuildSettings }>('PATCH', `/api/guilds/${guildId}/settings/${section}`, value),
    onSuccess: ({ settings }) => {
      queryClient.setQueryData<SettingsPayload>(settingsKey(guildId), (old) => (old ? { ...old, settings } : old));
      queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId], exact: true });
      setError(null);
      toast('Saved. Clanky is using it now.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Could not save.';
      setError(message);
      toast(message, 'bad');
    },
  });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = <K extends keyof GuildSettings[S]>(key: K, value: GuildSettings[S][K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return {
    draft,
    set,
    dirty,
    error,
    saving: mutation.isPending,
    /** Saves the draft. `clean` can tidy it first (e.g. drop unfinished rows). */
    save: (clean?: (value: GuildSettings[S]) => GuildSettings[S]) => {
      if (!draft) return;
      const value = clean ? clean(draft) : draft;
      if (clean) setDraft(value);
      mutation.mutate(value);
    },
    reset: () => (setDraft(saved), setError(null)),
  };
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 90, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 90, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
        >
          <div className="glass glass-strong flex w-full max-w-xl items-center gap-3 rounded-2xl py-2.5 pl-5 pr-2.5" data-testid="savebar">
            <span className="size-2 animate-pulse rounded-full bg-hazard" />
            <p className="flex-1 text-[14px] font-medium">You have unsaved changes</p>
            <Button variant="ghost" size="sm" onClick={onReset} disabled={saving} data-testid="button-reset">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button variant="primary" size="sm" onClick={onSave} loading={saving} data-testid="button-save">
              Save changes
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Instantly turns a module on or off (not part of a draft). */
export function useModuleToggle(guildId: string) {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: SectionId; enabled: boolean }) => api<{ settings: GuildSettings }>('PATCH', `/api/guilds/${guildId}/settings/${id}`, { enabled }),
    onSuccess: ({ settings }, { id, enabled }) => {
      queryClient.setQueryData<SettingsPayload>(settingsKey(guildId), (old) => (old ? { ...old, settings } : old));
      queryClient.invalidateQueries({ queryKey: ['/api/guilds', guildId], exact: true });
      toast(`${id[0]!.toUpperCase()}${id.slice(1)} is ${enabled ? 'on' : 'off'}.`);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not change that.', 'bad'),
  });
}

export function ModuleSwitch({ guildId, id, enabled, label }: { guildId: string; id: SectionId; enabled: boolean; label: string }) {
  const toggle = useModuleToggle(guildId);
  const [optimistic, setOptimistic] = useState(enabled);
  useEffect(() => setOptimistic(enabled), [enabled]);
  return (
    <Switch
      checked={optimistic}
      disabled={toggle.isPending}
      label={`Turn ${label} on or off`}
      testId={`switch-module-${id}`}
      onChange={(v) => {
        setOptimistic(v);
        toggle.mutate({ id, enabled: v }, { onError: () => setOptimistic(!v) });
      }}
    />
  );
}
