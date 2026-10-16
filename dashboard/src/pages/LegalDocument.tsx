import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Glass } from '@/components/Glass';
import { Eyebrow, Reveal } from '@/components/Reveal';

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: LegalSection[];
  notice?: ReactNode;
};

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-[14px] leading-7 text-muted sm:text-[15px]">{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2 text-[14px] leading-7 text-muted marker:text-rust-400 sm:text-[15px]">{children}</ul>;
}

export function LegalItem({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

export default function LegalDocument({ eyebrow, title, introduction, sections, notice }: LegalDocumentProps) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:pt-36">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl text-[clamp(2.35rem,5vw,4rem)] font-extrabold">{title}</h1>
        <p className="mt-4 max-w-3xl text-[16px] leading-7 text-muted sm:text-[17px]">{introduction}</p>
        <p className="stamp mt-5 text-[10px] text-faint">Last updated · October 16, 2026</p>
      </Reveal>

      {notice && (
        <Reveal delay={0.08} className="mt-8">
          <Glass strong className="rounded-2xl border-rust-400/20 p-5 sm:p-6">
            <div className="flex gap-3">
              <span className="mt-0.5 size-2 shrink-0 rounded-full bg-hazard shadow-[0_0_14px_rgb(245_197_66/0.5)]" aria-hidden="true" />
              <div className="space-y-2 text-[14px] leading-7 text-muted">{notice}</div>
            </div>
          </Glass>
        </Reveal>
      )}

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <Reveal delay={0.12} className="lg:sticky lg:top-28">
          <Glass className="rounded-2xl p-5">
            <p className="stamp text-[10px] text-rust-300">On this page</p>
            <nav aria-label={`${title} sections`} className="mt-4">
              <ol className="space-y-1.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="group flex gap-2 rounded-lg px-2 py-1.5 text-[12px] leading-5 text-muted transition-colors hover:bg-white/[0.04] hover:text-text">
                      <span className="font-mono text-[10px] text-faint group-hover:text-rust-300">{String(index + 1).padStart(2, '0')}</span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </Glass>
        </Reveal>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0"
        >
          <Glass className="rounded-3xl p-6 sm:p-9">
            <div className="space-y-9">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-line pb-8 last:border-0 last:pb-0">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-rust-400">{String(index + 1).padStart(2, '0')}</span>
                    <h2 className="text-[21px] font-bold sm:text-[24px]">{section.title}</h2>
                  </div>
                  <div className="mt-4 space-y-4">{section.body}</div>
                </section>
              ))}
            </div>
          </Glass>
        </motion.article>
      </div>
    </div>
  );
}
