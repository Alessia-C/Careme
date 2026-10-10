import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry(): void {
  // Senza DSN (unit test, E2E in CI) Sentry resta spento.
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_VERCEL_ENV ?? import.meta.env.MODE,
    dataCollection: { userInfo: false },
    initialScope: { tags: { runtime: 'frontend' } },
  });
}

/** Errore di prova deliberato: si attiva solo aprendo /?sentry-test=1 */
export function maybeThrowTestError(): void {
  if (new URLSearchParams(window.location.search).has('sentry-test')) {
    setTimeout(() => {
      throw new Error('Sentry frontend test error');
    });
  }
}
