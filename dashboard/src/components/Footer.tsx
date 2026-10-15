import { Link } from 'wouter';
import { useMeta } from '@/lib/hooks';
import { LogoMark } from './Logo';

export function Footer() {
  const { data: meta } = useMeta();
  return (
    <footer className="relative mt-24 border-t border-line">
      <div className="h-1.5 hazard opacity-60" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <LogoMark className="size-9" />
          <div>
            <p className="font-display text-[18px] font-extrabold">Clanky</p>
            <p className="text-[13px] text-muted">Built from spare parts. Runs your server.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted sm:ml-auto">
          <Link href="/changelog" className="hover:text-text">Changelog</Link>
          <Link href="/dashboard" className="hover:text-text">Dashboard</Link>
          <a href="https://github.com/rayandevs/clanky" target="_blank" rel="noopener noreferrer" className="hover:text-text">GitHub</a>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px] text-faint sm:items-end" data-testid="text-versions">
          <span>Bot {meta?.bot.version.label ?? '…'}</span>
          <span>Dashboard {meta?.dashboard.version.label ?? '…'}</span>
        </div>
      </div>
    </footer>
  );
}
