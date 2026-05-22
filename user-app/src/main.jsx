import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './lib/i18n';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { pingAppwriteBackend } from './lib/appwrite.js';

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
