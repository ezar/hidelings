import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { log } from './app/report';
import './app/app.css';

registerSW({
  immediate: true,
  onOfflineReady: () => log('Offline ready'),
  onRegisterError: e => log(`Service worker error: ${String(e)}`),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
