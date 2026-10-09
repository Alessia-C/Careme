import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { initSentry, maybeThrowTestError } from './lib/sentry';

initSentry();
maybeThrowTestError();

ReactDOM.createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Qualcosa è andato storto.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
