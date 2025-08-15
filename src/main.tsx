import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SaasProvider } from '@/lib/saas'
import { ThemeProvider } from 'next-themes'

// Clear stale caches and force reload once if a dynamic import (chunk) fails
if (typeof window !== 'undefined') {
	const hardResetCachesAndSW = async () => {
		try {
			if ('serviceWorker' in navigator) {
				const regs = await navigator.serviceWorker.getRegistrations();
				await Promise.all(regs.map((r) => r.unregister()));
			}
		} catch {}
		try {
			if ('caches' in window) {
				const cacheNames = await caches.keys();
				await Promise.all(cacheNames.map((name) => caches.delete(name)));
			}
		} catch {}
		try {
			localStorage.removeItem('vite-plugin-pwa:register');
		} catch {}
	};

	const maybeRecoverFromChunkError = async (reasonOrEvent: any) => {
		const message = (reasonOrEvent?.message) || String(reasonOrEvent?.reason || reasonOrEvent?.error || reasonOrEvent);
		const isChunkLoadError = message.includes('Failed to fetch dynamically imported module')
			|| message.includes('ChunkLoadError');
		const didAttemptRecovery = sessionStorage.getItem('did-recover-from-chunk-error') === '1';
		if (isChunkLoadError && !didAttemptRecovery) {
			try {
				await hardResetCachesAndSW();
			} catch {}
			sessionStorage.setItem('did-recover-from-chunk-error', '1');
			// Perform a cache-busting reload to avoid stale entry/chunk mismatches
			const url = new URL(window.location.href);
			url.searchParams.set('v', String(Date.now()));
			window.location.replace(url.toString());
		}
	};
	window.addEventListener('error', (event) => { void maybeRecoverFromChunkError(event); }, { capture: true });
	window.addEventListener('unhandledrejection', (event) => { void maybeRecoverFromChunkError(event); });

	// Prefetch critical auth routes to reduce chances of lazy-load failures on first navigation
	setTimeout(() => {
		void import('@/pages/Login').catch(() => {});
		void import('@/pages/Register').catch(() => {});
	}, 0);
}

createRoot(document.getElementById("root")!).render(
	<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
		<SaasProvider>
			<App />
		</SaasProvider>
	</ThemeProvider>
);
