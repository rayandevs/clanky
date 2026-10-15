import { DropdownMenu } from 'radix-ui';
import { LayoutDashboard, LogOut, Pickaxe, Settings2 } from 'lucide-react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLogin, useLogout, useMe, useMeta } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { Avatar, Button, buttonClass } from './ui';

export function Nav() {
  const { me } = useMe();
  const { data: meta } = useMeta();
  const login = useLogin();
  const [location, navigate] = useLocation();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  const scrollTo = (id: string) => {
    if (location !== '/') {
      navigate('/');
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 250);
    } else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4">
      <nav className={cn('glass glass-sheen mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-2xl px-3 transition-all duration-500 sm:px-4', scrolled ? 'glass-strong' : 'bg-transparent')}>
        <Link href="/" className="mr-2 rounded-lg" data-testid="link-home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <button onClick={() => scrollTo('features')} className="rounded-lg px-3 py-1.5 text-[14px] text-muted transition-colors hover:text-text">Features</button>
          <button onClick={() => scrollTo('salvage')} className="rounded-lg px-3 py-1.5 text-[14px] text-muted transition-colors hover:text-text">Salvage</button>
          <Link href="/changelog" className="rounded-lg px-3 py-1.5 text-[14px] text-muted transition-colors hover:text-text">Changelog</Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {meta && (
            <span className="hidden items-center gap-2 rounded-full border border-line px-2.5 py-1 text-[12px] text-muted lg:flex">
              <span className={cn('size-1.5 rounded-full', meta.bot.online ? 'bg-ok shadow-[0_0_8px_#4ade80]' : 'bg-bad')} />
              {meta.bot.online ? 'Online' : 'Offline'} · {meta.bot.version.label}
            </span>
          )}
          {me ? (
            <>
              <Link href="/dashboard" className={buttonClass('primary', 'sm', 'hidden sm:inline-flex')} data-testid="link-dashboard">
                <LayoutDashboard className="size-4" /> Dashboard
              </Link>
              <UserMenu name={me.user.globalName ?? me.user.username} avatar={me.user.avatar} />
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => login()} data-testid="button-login">
              <DiscordGlyph className="size-4" /> Log in
            </Button>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

function UserMenu({ name, avatar }: { name: string; avatar: string }) {
  const logout = useLogout();
  const [, navigate] = useLocation();
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-muted outline-none data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-text';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="rounded-full ring-1 ring-line transition hover:ring-rust-400/60" aria-label="Account menu" data-testid="button-user-menu">
          <Avatar src={avatar} name={name} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={10} className="glass glass-strong z-50 w-56 rounded-2xl p-1.5 data-[state=open]:animate-[pop_.22s_var(--ease-out-expo)]">
          <p className="px-2.5 pb-2 pt-1.5 text-[13px] font-semibold">{name}</p>
          <DropdownMenu.Item className={item} onSelect={() => navigate('/dashboard')}><LayoutDashboard className="size-4" /> Your servers</DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => navigate('/me/salvage')}><Pickaxe className="size-4" /> Salvage profile</DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => navigate('/me')}><Settings2 className="size-4" /> Preferences</DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={cn(item, 'data-[highlighted]:text-bad')} onSelect={() => logout.mutate()} data-testid="button-logout"><LogOut className="size-4" /> Log out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DiscordGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.6.2 18.1A19.8 19.8 0 0 0 6.2 21l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.7-3.5-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}
