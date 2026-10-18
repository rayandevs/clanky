import { Dialog } from 'radix-ui';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { FeedbackForm } from './FeedbackForm';
import { Button } from './ui';
import { useMe, useMeta } from '@/lib/hooks';
import { DEMO } from '@/lib/utils';

const DAY = 24 * 60 * 60 * 1000;
const PROMPT_COOLDOWN = 30 * DAY;
const RETRY_COOLDOWN = 7 * DAY;

export function FeedbackPrompt() {
  const { me } = useMe();
  const { data: meta } = useMeta();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (DEMO || !me || !meta?.feedbackEnabled || !(/^\/dashboard(?:\/|$)|^\/me(?:\/|$)/.test(location))) return;
    if (location === '/feedback' || location.startsWith('/me/salvage')) return;

    const prefix = `clanky:feedback-prompt:${me.user.id}`;
    const neverKey = `${prefix}:never`;
    const nextKey = `${prefix}:next-at`;
    try {
      if (localStorage.getItem(neverKey) === '1') return;
      const nextAt = Number(localStorage.getItem(nextKey) ?? 0);
      if (nextAt > Date.now()) return;

      const timer = window.setTimeout(() => {
        const show = Math.random() < 0.35;
        localStorage.setItem(nextKey, String(Date.now() + (show ? PROMPT_COOLDOWN : RETRY_COOLDOWN)));
        if (show) setOpen(true);
      }, 12_000 + Math.random() * 28_000);
      return () => window.clearTimeout(timer);
    } catch {
      // If browser storage is unavailable, skip the prompt instead of risking repeats.
    }
  }, [location, me?.user.id, meta?.feedbackEnabled]);

  const stopPrompts = () => {
    if (me) {
      try {
        localStorage.setItem(`clanky:feedback-prompt:${me.user.id}:never`, '1');
      } catch {
        // The current prompt can still be closed when storage is unavailable.
      }
    }
    setOpen(false);
  };

  const closePrompt = () => setOpen(false);
  const submitted = () => {
    if (me) {
      try {
        localStorage.setItem(`clanky:feedback-prompt:${me.user.id}:next-at`, String(Date.now() + 180 * DAY));
      } catch {
        // Submission itself is complete; storage only controls future prompts.
      }
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm data-[state=open]:animate-[fade_.2s_ease-out]" />
        <Dialog.Content className="glass glass-strong fixed inset-x-4 top-[5vh] z-[61] mx-auto max-h-[90vh] max-w-xl overflow-y-auto rounded-3xl p-5 shadow-2xl data-[state=open]:animate-[pop_.25s_var(--ease-out-expo)] sm:top-[8vh] sm:p-7">
          <Dialog.Title className="font-display text-[24px] font-extrabold">Quick Clanky check-in</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-5 text-muted">Got a moment? A rating and note help us improve. This prompt won’t return for at least 30 days if it appears.</Dialog.Description>
          <div className="mt-5"><FeedbackForm compact onSubmitted={submitted} /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <button type="button" onClick={stopPrompts} className="text-[12px] text-faint underline decoration-dotted underline-offset-4 hover:text-text">Don’t show this again</button>
            <Button type="button" variant="ghost" size="sm" onClick={closePrompt}>Not now</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
