import { MessageSquareText } from 'lucide-react';
import { Glass } from '@/components/Glass';
import { ClankyLoader } from '@/components/ClankyLoader';
import { FeedbackForm } from '@/components/FeedbackForm';
import { Eyebrow } from '@/components/Reveal';
import { Button } from '@/components/ui';
import { useLogin, useMe, useMeta } from '@/lib/hooks';
import { DEMO } from '@/lib/utils';

export default function Feedback() {
  const { me, isLoading: authLoading } = useMe();
  const { data: meta, isLoading: metaLoading } = useMeta();
  const login = useLogin();

  if (authLoading) return <div className="grid min-h-[70vh] place-items-center px-5 pt-24"><ClankyLoader label="Checking your Clanky account…" /></div>;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:pt-36">
      <Eyebrow>Help us improve</Eyebrow>
      <h1 className="mt-3 text-[clamp(2.3rem,5vw,3.7rem)] font-extrabold">Send Clanky a note.</h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">A rating and a few words from you help us make the bot and dashboard better for everyone.</p>

      <Glass strong className="mt-9 rounded-3xl p-6 sm:p-8">
        {!me ? (
          <div className="py-4 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-rust-400/20 bg-rust-500/10 text-rust-300"><MessageSquareText className="size-7" /></span>
            <h2 className="mt-4 text-xl font-bold">Log in to send feedback.</h2>
            <p className="mt-2 text-sm text-muted">Feedback is tied to your Discord account so we can keep submissions useful and limit spam.</p>
            <Button type="button" variant="primary" className="mt-5" disabled={!meta?.loginEnabled && !DEMO} onClick={() => void login('/feedback')}>Log in with Discord</Button>
            {meta?.loginEnabled === false && <p className="mt-3 text-xs text-muted">Discord login is not enabled for this dashboard.</p>}
          </div>
        ) : metaLoading ? (
          <div className="grid min-h-56 place-items-center"><ClankyLoader size="compact" label="Checking feedback availability…" /></div>
        ) : !DEMO && !meta?.feedbackEnabled ? (
          <div role="status" className="py-6 text-center">
            <h2 className="text-xl font-bold">Feedback is temporarily unavailable.</h2>
            <p className="mt-2 text-sm text-muted">Please check back later. You can still reach us through the project’s GitHub page.</p>
          </div>
        ) : <FeedbackForm />}
      </Glass>
    </main>
  );
}
