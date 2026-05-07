import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './lib/i18n';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { pingAppwriteBackend } from './lib/appwrite.js';

pingAppwriteBackend();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
