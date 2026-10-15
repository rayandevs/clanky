import { motion } from 'motion/react';
import { Link } from 'wouter';
import { Glass } from '@/components/Glass';
import { buttonClass, Emoji } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 pt-20">
      <Glass strong className="w-full max-w-md rounded-[28px] p-10 text-center">
        <motion.div initial={{ rotate: -20, y: 10, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }} className="mx-auto w-fit">
          <Emoji e="🕳️" className="size-16" />
        </motion.div>
        <p className="stamp mt-6 text-rust-300">Error 404</p>
        <h1 className="mt-2 text-[32px] font-extrabold">Nothing buried here</h1>
        <p className="mt-2 text-[15px] text-muted">We dug around, but this page doesn't exist.</p>
        <Link href="/" className={buttonClass('primary', 'lg', 'mt-8')} data-testid="link-home">
          Back to the surface
        </Link>
      </Glass>
    </div>
  );
}
