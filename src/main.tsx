import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SaasProvider } from '@/lib/saas'

// Clear stale caches and force reload once if a dynamic import (chunk) fails
if (typeof window !== 'undefined') {
  const maybeRecoverFromChunkError = async (reasonOrEvent: any) => {
    const message = (reasonOrEvent?.message) || String(reasonOrEvent?.reason || reasonOrEvent?.error || reasonOrEvent);
    const isChunkLoadError = message.includes('Failed to fetch dynamically imported module')
      || message.includes('ChunkLoadError');
    const didAttemptRecovery = sessionStorage.getItem('did-recover-from-chunk-error') === '1';
    if (isChunkLoadError && !didAttemptRecovery) {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      } catch {}
      try {
        localStorage.removeItem('vite-plugin-pwa:register');
      } catch {}
      sessionStorage.setItem('did-recover-from-chunk-error', '1');
      window.location.reload();
    }
  };
  window.addEventListener('error', (event) => { void maybeRecoverFromChunkError(event); }, { capture: true });
  window.addEventListener('unhandledrejection', (event) => { void maybeRecoverFromChunkError(event); });
}

createRoot(document.getElementById("root")!).render(
  <SaasProvider>
    <App />
  </SaasProvider>
);
