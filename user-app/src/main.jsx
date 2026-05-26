import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './lib/i18n';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { pingAppwriteBackend } from './lib/appwrite.js';

// Silence console output when VITE_OFF_DEBUG is enabled.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OFF_DEBUG === 'true') {
    ['log', 'info', 'warn', 'error', 'debug', 'trace'].forEach((m) => {
      console[m] = () => {};
    });
  }
} catch {
  // ignore
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
    } catch (error) {
      console.error('PWA service worker registration failed', error);
    }
  });
}

pingAppwriteBackend();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
