import { useMutation } from '@tanstack/react-query';
import { Check, Send, Star } from 'lucide-react';
import { useState } from 'react';
import { Button, Textarea } from './ui';
import { api } from '@/lib/api';
import { DEMO } from '@/lib/utils';

export function FeedbackForm({ compact = false, onSubmitted }: { compact?: boolean; onSubmitted?: () => void }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const mutation = useMutation({
    mutationFn: () => api<{ ok: true }>('POST', '/api/feedback', {
      rating,
      note,
      page: window.location.pathname,
      consent,
      website,
    }),
    onSuccess: () => {
      setSubmitted(true);
      onSubmitted?.();
    },
  });
  const stars = hoverRating || rating;

  if (submitted) {
    return (
      <div role="status" className="py-5 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-ok/25 bg-ok/10 text-ok"><Check className="size-6" /></span>
        <h2 className="mt-4 text-xl font-bold">Thanks for the feedback.</h2>
        <p className="mt-2 text-sm text-muted">{DEMO ? 'This is a demo, so nothing was sent.' : 'Your note has been sent to the Clanky team.'}</p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold">How would you rate Clanky?</legend>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
              aria-pressed={rating === value}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              onFocus={() => setHoverRating(value)}
              onBlur={() => setHoverRating(0)}
              onClick={() => setRating(value)}
              className="grid size-10 place-items-center rounded-xl text-faint transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust-400"
            >
              <Star className={`size-6 transition-colors ${value <= stars ? 'fill-hazard text-hazard' : 'text-faint'}`} />
            </button>
          ))}
          <span className="ml-2 text-[13px] text-muted" aria-live="polite">{rating ? `${rating} out of 5` : 'Choose a rating'}</span>
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">Your note</span>
        <span className="mt-1 block text-[13px] text-muted">What’s working well? What would you change or add?</span>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} required aria-label="Your feedback note" placeholder="Share as much detail as you like…" className={`mt-2 ${compact ? 'min-h-24' : 'min-h-36'}`} />
      </label>

      <label aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden">
        Leave this field empty
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>

      {!DEMO && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-black/15 p-3 text-[12px] leading-5 text-muted">
          <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-rust-500" />
          <span>I understand my Discord user ID/name, feedback, current dashboard page, submission time, source IP, and browser user-agent are sent to the dashboard operator’s Discord webhook. Session IDs, cookies, and OAuth tokens are never included.</span>
        </label>
      )}
      {DEMO && <p className="text-xs text-muted">Demo mode: your submission is preview-only and will not be delivered.</p>}
      {mutation.error && <p role="alert" className="rounded-xl border border-bad/25 bg-bad/[0.06] px-4 py-3 text-sm text-bad">{mutation.error instanceof Error ? mutation.error.message : 'Feedback could not be sent. Please try again.'}</p>}

      <Button type="submit" variant="primary" size="lg" loading={mutation.isPending} disabled={!rating || !note.trim() || (!DEMO && !consent)}>
        <Send className="size-4" /> Send feedback
      </Button>
    </form>
  );
}
