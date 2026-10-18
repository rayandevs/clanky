import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Lock, RotateCcw } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!dirty) setCollapsed(false);
  }, [dirty]);

  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ x: 48, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="pointer-events-none fixed inset-y-0 right-0 z-50 flex items-center"
        >
          <div
            className="pointer-events-auto w-[min(360px,calc(100vw-12px))] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: collapsed ? 'translateX(calc(100% - 48px))' : 'translateX(0)' }}
          >
            <div className="glass glass-strong flex overflow-hidden rounded-l-2xl rounded-r-none border-r-0 shadow-[-18px_0_44px_-28px_rgb(0_0_0/0.8)]" data-testid="savebar">
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="grid w-12 shrink-0 place-items-center border-r border-line text-muted transition-colors hover:bg-white/[0.06] hover:text-text focus-visible:z-10"
                aria-label={collapsed ? 'Show unsaved changes' : 'Collapse unsaved changes'}
                aria-expanded={!collapsed}
                aria-controls={panelId}
                title={collapsed ? 'Show unsaved changes' : 'Collapse to the side'}
                data-testid="button-collapse-savebar"
              >
                {collapsed ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              <div id={panelId} className="min-w-0 flex-1 p-4" aria-hidden={collapsed} inert={collapsed}>
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-hazard" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold">Unsaved changes</p>
                    <p className="mt-1 text-[12px] leading-5 text-muted">Save to apply your edits, or reset to discard them.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="ghost" size="sm" className="w-full" onClick={onReset} disabled={saving} data-testid="button-reset">
                    <RotateCcw className="size-3.5" /> Reset
                  </Button>
                  <Button variant="primary" size="sm" className="w-full" onClick={onSave} loading={saving} data-testid="button-save">
                    Save changes
                  </Button>
                </div>
              </div>
            </div>
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
