import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { lazy, Suspense, useEffect } from 'react';
import { Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Background } from './components/Background';
import { ClankyLoader } from './components/ClankyLoader';
import { FeedbackPrompt } from './components/FeedbackPrompt';
import { Footer } from './components/Footer';
import { Nav } from './components/Nav';
import { ToastProvider } from './components/Toast';
import { queryClient } from './lib/api';
import { DEMO } from './lib/utils';
import Home from './pages/Home';

const Servers = lazy(() => import('./pages/Servers'));
const Guild = lazy(() => import('./pages/Guild'));
const Me = lazy(() => import('./pages/Me'));
const Salvage = lazy(() => import('./pages/Salvage'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Feedback = lazy(() => import('./pages/Feedback'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-20">
      <div className="glass glass-strong rounded-3xl px-9 py-7">
        <ClankyLoader label="Clanky is gearing up…" />
      </div>
    </div>
  );
}

function Routes() {
  const [location] = useLocation();
  const area = location.startsWith('/dashboard/') ? location.split('/').slice(0, 3).join('/') : location;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [area]);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={area}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-[100dvh]"
      >
        <Suspense fallback={<RouteLoading />}>
          <Switch location={location}>
            <Route path="/" component={Home} />
            <Route path="/dashboard" component={Servers} />
            <Route path="/dashboard/:guildId/:section?" component={Guild} />
            <Route path="/me" component={Me} />
            <Route path="/me/salvage" component={Salvage} />
            <Route path="/changelog" component={Changelog} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/feedback" component={Feedback} />
            <Route path="/help" component={HelpCenter} />
            <Route path="/help/:slug" component={HelpCenter} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.main>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <Router hook={DEMO ? useHashLocation : undefined}>
            <Background />
            <Nav />
            <Routes />
            <FeedbackPrompt />
            <Footer />
          </Router>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
