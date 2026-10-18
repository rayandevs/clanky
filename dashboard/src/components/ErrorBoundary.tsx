import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Clanky dashboard failed to render.', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main role="alert" className="grid min-h-[100dvh] place-items-center bg-ink px-5 py-16 text-text">
        <section className="glass glass-strong w-full max-w-lg rounded-3xl p-7 text-center sm:p-9">
          <p className="stamp text-rust-300">Clanky dashboard</p>
          <h1 className="mt-3 text-2xl font-extrabold">This page couldn’t load.</h1>
          <p className="mt-3 text-sm text-muted">Try reloading. If this keeps happening, please try again in a moment.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-rust-500 px-5 text-sm font-bold text-[#1a0f08] transition-colors hover:bg-rust-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rust-300"
          >
            Reload dashboard
          </button>
        </section>
      </main>
    );
  }
}
