import {
  ArrowLeft, ArrowRight, BellRing, BookOpen, Bot, Check, ChevronRight, CircleHelp, Clock3,
  Copy, FileQuestion, LayoutDashboard, Lightbulb, ListChecks, MessageSquareText,
  PartyPopper, Pickaxe, ScrollText, Search, ShieldCheck, Sparkles, Trophy, UserRoundCog,
  UsersRound, X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useLocation } from 'wouter';
import { Glass } from '@/components/Glass';
import { Eyebrow, Reveal } from '@/components/Reveal';
import { Input } from '@/components/ui';
import { HELP_ARTICLES, HELP_CATEGORIES, searchHelpArticles, type HelpArticle, type HelpBlock } from '@/content/help';
import { cn, DEMO } from '@/lib/utils';

const ARTICLE_ICONS: Record<string, LucideIcon> = {
  Sparkles, LayoutDashboard, MessageSquareText, Shield: ShieldCheck,
  Bot, PartyPopper, Ticket: FileQuestion, Lightbulb, UsersRound,
  Trophy, Pickaxe, BellRing, ScrollText,
  UserRoundCog, CircleHelp,
};
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  start: Sparkles, dashboard: BookOpen, community: Lightbulb, safety: ShieldCheck, engagement: ListChecks, account: CircleHelp,
};

function ArticleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ARTICLE_ICONS[name] ?? BookOpen;
  return <Icon className={className} aria-hidden="true" />;
}

function CategoryLabel({ id }: { id: string }) {
  return HELP_CATEGORIES.find((category) => category.id === id)?.title ?? id;
}

function ArticleCard({ article, index = 0 }: { article: HelpArticle; index?: number }) {
  return (
    <Link href={`/help/${article.slug}`} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust-400">
      <Glass className="h-full rounded-2xl p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-rust-400/25 group-hover:bg-white/[0.04]" interactive={index < 3}>
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-rust-400/15 bg-rust-500/[0.08] text-rust-300">
            <ArticleIcon name={article.icon} className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-snug transition-colors group-hover:text-rust-200">{article.title}</p>
            <p className="mt-2 text-[13px] leading-5 text-muted">{article.summary}</p>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-rust-300" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-faint">
          <span>{CategoryLabel({ id: article.category })}</span><span aria-hidden="true">·</span><span>{article.readTime} min read</span>
        </div>
      </Glass>
    </Link>
  );
}

function SearchBar({ value, onChange, inputRef, onClear }: { value: string; onChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null>; onClear: () => void }) {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-rust-300" aria-hidden="true" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search guides, commands, settings…"
        aria-label="Search help articles"
        className="h-14 rounded-2xl border-white/[0.12] bg-black/35 pl-12 pr-20 text-[15px] shadow-[0_20px_60px_-35px_rgb(226_112_47/0.55)] placeholder:text-faint"
      />
      {value ? (
        <button type="button" onClick={onClear} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-white/[0.06] hover:text-text" aria-label="Clear search"><X className="size-4" /></button>
      ) : (
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center rounded-lg border border-line bg-white/[0.035] px-2 py-1 font-mono text-[10px] text-faint">Ctrl/⌘ K</span>
      )}
    </div>
  );
}

function GuideBlock({ block }: { block: HelpBlock }) {
  if (block.type === 'paragraph') return <p className="text-[14px] leading-7 text-muted sm:text-[15px]">{block.text}</p>;
  if (block.type === 'list') {
    return (
      <div>
        {block.title && <h3 className="mb-3 text-[14px] font-bold">{block.title}</h3>}
        <ul className="space-y-2.5">
          {block.items.map((item) => <li key={item} className="flex gap-3 text-[14px] leading-6 text-muted"><span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-rust-400" /><span>{item}</span></li>)}
        </ul>
      </div>
    );
  }
  if (block.type === 'steps') {
    return (
      <div>
        {block.title && <h3 className="mb-3 text-[14px] font-bold">{block.title}</h3>}
        <ol className="relative space-y-3">
          {block.items.map((step, index) => (
            <li key={step.title} className="relative flex gap-3.5 rounded-2xl border border-line bg-white/[0.018] p-4 sm:gap-4 sm:p-5">
              {index < block.items.length - 1 && <span className="absolute bottom-[-13px] left-[29px] top-[52px] w-px bg-gradient-to-b from-rust-400/35 to-line sm:left-[33px]" aria-hidden="true" />}
              <span className="relative z-[1] grid size-8 shrink-0 place-items-center rounded-xl border border-rust-400/25 bg-rust-500/10 font-mono text-[12px] font-bold text-rust-300">{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0 pt-0.5"><span className="block text-[14px] font-bold text-text">{step.title}</span><span className="mt-1 block text-[13px] leading-6 text-muted">{step.body}</span></span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const styles = {
    tip: { icon: Lightbulb, shell: 'border-rust-400/20 bg-rust-500/[0.055]', color: 'text-rust-300' },
    note: { icon: BookOpen, shell: 'border-info/20 bg-info/[0.055]', color: 'text-info' },
    important: { icon: ShieldCheck, shell: 'border-hazard/20 bg-hazard/[0.05]', color: 'text-hazard' },
  }[block.tone];
  const Icon = styles.icon;
  return (
    <aside className={cn('rounded-2xl border p-4 sm:p-5', styles.shell)}>
      <p className={cn('flex items-center gap-2 text-[13px] font-bold', styles.color)}><Icon className="size-4" />{block.title}</p>
      <p className="mt-2 text-[13px] leading-6 text-muted">{block.body}</p>
    </aside>
  );
}

function SearchResults({ query, results, onSelect }: { query: string; results: HelpArticle[]; onSelect: () => void }) {
  return (
    <section className="mx-auto mt-6 max-w-4xl" aria-live="polite">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-muted">{results.length ? `${results.length} ${results.length === 1 ? 'guide' : 'guides'} for “${query.trim()}”` : `No guides found for “${query.trim()}”`}</h2>
        {results.length > 0 && <span className="text-[11px] text-faint">Searches guide text, too</span>}
      </div>
      {results.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{results.map((article, index) => <div key={article.slug} onClick={onSelect}><ArticleCard article={article} index={index} /></div>)}</div>
      ) : (
        <Glass className="rounded-2xl p-6 text-center">
          <CircleHelp className="mx-auto size-7 text-faint" />
          <p className="mt-3 text-[14px] font-semibold">Try a different word or browse all topics.</p>
          <p className="mt-1 text-[13px] text-muted">You can also send a question through the feedback page.</p>
          <Link href="/feedback" className="mt-3 inline-flex text-[13px] font-semibold text-rust-300 hover:text-rust-200">Contact us <ArrowRight className="ml-1 size-4" /></Link>
        </Glass>
      )}
    </section>
  );
}

function ArticleView({ article, onBack }: { article: HelpArticle; onBack: () => void }) {
  const [location] = useLocation();
  const [copied, setCopied] = useState(false);
  const articleIndex = HELP_ARTICLES.findIndex((item) => item.slug === article.slug);
  const previous = HELP_ARTICLES[(articleIndex - 1 + HELP_ARTICLES.length) % HELP_ARTICLES.length];
  const next = HELP_ARTICLES[(articleIndex + 1) % HELP_ARTICLES.length];
  const related = HELP_ARTICLES.filter((item) => item.slug !== article.slug && item.category === article.category).slice(0, 2);

  useEffect(() => {
    document.title = `${article.title} · Clanky Help`;
    return () => { document.title = 'Clanky'; };
  }, [article.title]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${DEMO ? `/#${location}` : location}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:pt-32">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted transition hover:bg-white/[0.04] hover:text-text"><ArrowLeft className="size-4" />All guides</button>
        <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-faint transition hover:bg-white/[0.04] hover:text-text" aria-label="Copy link to this guide">{copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}{copied ? 'Link copied' : 'Copy guide link'}</button>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-10">
        <article className="min-w-0">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-faint"><Link href="/help" className="hover:text-text">Help Center</Link><ChevronRight className="size-3.5" /><span>{CategoryLabel({ id: article.category })}</span></div>
            <div className="mt-5 flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-rust-400/20 bg-rust-500/[0.08] text-rust-300 sm:size-14"><ArticleIcon name={article.icon} className="size-6" /></span>
              <div><Eyebrow>{CategoryLabel({ id: article.category })}</Eyebrow><h1 className="mt-2 text-[clamp(2rem,4.4vw,3.2rem)] font-extrabold">{article.title}</h1></div>
            </div>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-muted">{article.summary}</p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-faint"><Clock3 className="size-3.5" />{article.readTime} min read<span aria-hidden="true">·</span><span>Clanky Help</span></div>
          </Reveal>

          <div className="mt-8 space-y-6">
            {article.sections.map((section, sectionIndex) => (
              <section id={section.id} key={section.id} className="scroll-mt-28">
                <Glass className="rounded-3xl p-5 sm:p-7">
                  <div className="mb-5 flex items-baseline gap-3 border-b border-line pb-4"><span className="font-mono text-[11px] text-rust-400">{String(sectionIndex + 1).padStart(2, '0')}</span><h2 className="text-[20px] font-bold sm:text-[23px]">{section.title}</h2></div>
                  <div className="space-y-5">{section.blocks.map((block, blockIndex) => <GuideBlock key={`${section.id}-${blockIndex}`} block={block} />)}</div>
                </Glass>
              </section>
            ))}
          </div>

          {related.length > 0 && <div className="mt-10"><h2 className="mb-4 text-[18px] font-bold">Keep exploring</h2><div className="grid gap-3 sm:grid-cols-2">{related.map((item) => <ArticleCard key={item.slug} article={item} />)}</div></div>}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/help/${previous!.slug}`} className="group flex flex-1 items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-4 hover:border-rust-400/20"><ArrowLeft className="size-4 text-faint group-hover:text-rust-300" /><span><span className="block text-[10px] text-faint">PREVIOUS GUIDE</span><span className="mt-1 block text-[13px] font-semibold">{previous!.title}</span></span></Link>
            <Link href={`/help/${next!.slug}`} className="group flex flex-1 items-center justify-end gap-3 rounded-2xl border border-line bg-white/[0.02] p-4 text-right hover:border-rust-400/20"><span><span className="block text-[10px] text-faint">NEXT GUIDE</span><span className="mt-1 block text-[13px] font-semibold">{next!.title}</span></span><ArrowRight className="size-4 text-faint group-hover:text-rust-300" /></Link>
          </div>
          <p className="mt-5 text-center text-[12px] text-faint">Still stuck? <Link href="/feedback" className="font-semibold text-rust-300 hover:text-rust-200">Ask the Clanky team</Link>.</p>
        </article>

        <aside className="lg:sticky lg:top-24">
          <details className="group rounded-2xl border border-line bg-white/[0.02] p-4 lg:block lg:border-0 lg:bg-transparent lg:p-0" open>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-bold text-muted lg:cursor-default"><span>IN THIS GUIDE</span><ChevronRight className="size-4 transition-transform group-open:rotate-90 lg:hidden" /></summary>
            <nav aria-label="Guide contents" className="mt-3 space-y-1">
              {article.sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="flex gap-2 rounded-lg px-2.5 py-2 text-[12px] leading-5 text-muted transition hover:bg-white/[0.04] hover:text-text"><span className="font-mono text-[10px] text-faint">{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}
            </nav>
          </details>
          <Glass className="mt-5 hidden rounded-2xl p-4 lg:block"><p className="text-[12px] font-bold">Need a hand?</p><p className="mt-1 text-[12px] leading-5 text-muted">Search another guide or send us a note.</p><Link href="/feedback" className="mt-3 inline-flex items-center text-[12px] font-semibold text-rust-300 hover:text-rust-200">Get in touch <ArrowRight className="ml-1 size-3.5" /></Link></Glass>
        </aside>
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const [location, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const slug = location.split('?')[0]?.startsWith('/help/') ? decodeURIComponent(location.split('?')[0]!.slice('/help/'.length)) : '';
  const article = HELP_ARTICLES.find((item) => item.slug === slug);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (slug) navigate('/help');
        window.setTimeout(() => searchRef.current?.focus(), 0);
      } else if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (slug) navigate('/help');
        window.setTimeout(() => searchRef.current?.focus(), 0);
      } else if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, slug]);

  useEffect(() => {
    document.title = article ? `${article.title} · Clanky Help` : 'Help Center · Clanky';
    return () => { document.title = 'Clanky'; };
  }, [article]);

  const results = useMemo(() => searchHelpArticles(query, category), [category, query]);

  if (article) return <ArticleView key={article.slug} article={article} onBack={() => navigate('/help')} />;

  const clearSearch = () => { setQuery(''); searchRef.current?.focus(); };
  const landing = !query.trim() && category === 'all';
  const featured = HELP_ARTICLES.filter((item) => ['first-steps', 'dashboard-tour', 'commands-and-help', 'common-fixes'].includes(item.slug));

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:pt-32">
      <section className="relative overflow-hidden rounded-[30px] border border-line bg-[radial-gradient(ellipse_at_78%_0%,rgb(226_112_47/0.18),transparent_44%),linear-gradient(145deg,rgb(255_255_255/0.035),transparent_60%)] px-5 py-9 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-12 -top-14 size-56 rounded-full border border-rust-400/[0.08] sm:size-72" /><div className="pointer-events-none absolute -right-3 -top-5 size-40 rounded-full border border-rust-400/[0.1] sm:size-52" />
        <Reveal className="relative">
          <Eyebrow>Clanky Help Center</Eyebrow>
          <div className="mt-3 flex items-center gap-3"><h1 className="text-[clamp(2.25rem,5.5vw,4rem)] font-extrabold">Find your next step.</h1><span className="hidden rounded-2xl border border-rust-400/20 bg-rust-500/10 p-3 text-rust-300 sm:grid"><BookOpen className="size-6" /></span></div>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-muted sm:text-[16px] sm:leading-7">Friendly, practical guides to Clanky in Discord and on the dashboard. Search for what you need or browse by topic.</p>
          <div className="mt-6"><SearchBar value={query} onChange={setQuery} inputRef={searchRef} onClear={clearSearch} /></div>
          <p className="mt-2 text-center text-[10px] text-faint">Tip: press <kbd className="rounded border border-line bg-white/[0.04] px-1.5 py-0.5 font-mono">/</kbd> or <kbd className="rounded border border-line bg-white/[0.04] px-1.5 py-0.5 font-mono">Ctrl/⌘ K</kbd> to search from anywhere in Help.</p>
        </Reveal>
      </section>

      {query.trim() ? <SearchResults query={query} results={results} onSelect={() => setQuery('')} /> : (
        <>
          <section className="mt-8" aria-label="Help topics">
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="stamp text-[10px] text-rust-300">Browse by topic</p><h2 className="mt-1 text-[20px] font-bold">What are you here to do?</h2></div><span className="hidden text-[12px] text-faint sm:block">{HELP_ARTICLES.length} practical guides</span></div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              <button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'} className={cn('shrink-0 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition', category === 'all' ? 'border-rust-400/35 bg-rust-500/15 text-rust-200' : 'border-line bg-white/[0.02] text-muted hover:bg-white/[0.05] hover:text-text')}>All guides</button>
              {HELP_CATEGORIES.map((item) => { const Icon = CATEGORY_ICONS[item.id] ?? BookOpen; return <button key={item.id} type="button" onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={cn('flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition', category === item.id ? 'border-rust-400/35 bg-rust-500/15 text-rust-200' : 'border-line bg-white/[0.02] text-muted hover:bg-white/[0.05] hover:text-text')}><Icon className="size-3.5" />{item.title}</button>; })}
            </div>
          </section>

          {landing ? (
            <>
              <section className="mt-6">
                <div className="mb-3 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-rust-500/10 text-rust-300"><Sparkles className="size-4" /></span><h2 className="text-[17px] font-bold">A good place to begin</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">{featured.map((item, index) => <ArticleCard key={item.slug} article={item} index={index} />)}</div>
              </section>
              <section className="mt-10 space-y-9">
                {HELP_CATEGORIES.map((topic) => { const articles = HELP_ARTICLES.filter((item) => item.category === topic.id && !featured.some((guide) => guide.slug === item.slug)); const Icon = CATEGORY_ICONS[topic.id] ?? BookOpen; if (!articles.length) return null; return <div key={topic.id}><div className="mb-3 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-white/[0.04] text-muted"><Icon className="size-4" /></span><div><h2 className="text-[17px] font-bold">{topic.title}</h2><p className="text-[12px] text-faint">{topic.description}</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{articles.map((item, index) => <ArticleCard key={item.slug} article={item} index={index} />)}</div></div>; })}
              </section>
            </>
          ) : (
            <section className="mt-6" aria-live="polite">
              <div className="mb-3 flex items-center justify-between"><div><p className="stamp text-[10px] text-rust-300">{CategoryLabel({ id: category })}</p><p className="mt-1 text-[13px] text-muted">{HELP_CATEGORIES.find((item) => item.id === category)?.description}</p></div><span className="text-[11px] text-faint">{results.length} guides</span></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map((item, index) => <ArticleCard key={item.slug} article={item} index={index} />)}</div>
            </section>
          )}

          <section className="mt-12 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <Glass className="flex items-center gap-4 rounded-2xl p-5 sm:p-6"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-info/15 bg-info/[0.08] text-info"><CircleHelp className="size-5" /></span><div><h2 className="text-[14px] font-bold">Didn’t find what you need?</h2><p className="mt-1 text-[12px] leading-5 text-muted">Tell us what guide would make Clanky easier to use.</p></div></Glass>
            <Link href="/feedback" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-[13px] font-semibold text-muted transition hover:border-rust-400/25 hover:text-text"><FileQuestion className="size-4" />Send a suggestion<ArrowRight className="size-4" /></Link>
          </section>
        </>
      )}
    </main>
  );
}
