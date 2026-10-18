import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const CHUNK_RELOAD_KEY = 'clanky:chunk-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    const now = Date.now();
    const previousReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (!previousReload || now - previousReload > 30_000) {
      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
      window.location.reload();
      return;
    }
  } catch {
    // If session storage is unavailable, let the error boundary offer a manual retry.
  }
  console.error('A dashboard page chunk failed to load; automatic reload was skipped to avoid a loop.');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
