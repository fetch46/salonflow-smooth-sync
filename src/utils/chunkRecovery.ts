export const CHUNK_ERROR_FLAG_KEY = 'did-recover-from-chunk-error';

export function isChunkError(reasonOrEvent: any): boolean {
  try {
    const message = String(
      reasonOrEvent?.message ||
      reasonOrEvent?.reason?.message ||
      reasonOrEvent?.error?.message ||
      reasonOrEvent?.reason ||
      reasonOrEvent?.error ||
      reasonOrEvent
    );
    return message.includes('Failed to fetch dynamically imported module') ||
      message.includes('ChunkLoadError') ||
      message.includes('Loading chunk') && message.includes('failed');
  } catch {
    return false;
  }
}

export async function hardResetCachesAndServiceWorkers(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {}
  try {
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vite-plugin-pwa:register');
    }
  } catch {}
}

export async function recoverFromChunkErrorOnce(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const didAttemptRecovery = sessionStorage.getItem(CHUNK_ERROR_FLAG_KEY) === '1';
    if (didAttemptRecovery) return;

    await hardResetCachesAndServiceWorkers();
    sessionStorage.setItem(CHUNK_ERROR_FLAG_KEY, '1');

    const url = new URL(window.location.href);
    url.searchParams.set('v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    // As a last resort, try a normal reload
    try { window.location.reload(); } catch {}
  }
}

export function registerGlobalChunkErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  const handler = (evt: any) => {
    const payload = (evt && ('reason' in evt || 'error' in evt)) ? (evt.reason || evt.error) : evt;
    if (isChunkError(payload)) {
      void recoverFromChunkErrorOnce();
    }
  };

  window.addEventListener('error', handler as any, { capture: true });
  window.addEventListener('unhandledrejection', handler as any);
}