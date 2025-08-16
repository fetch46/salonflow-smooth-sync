
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SaasProvider } from '@/lib/saas'
import { ThemeProvider } from 'next-themes'
import { registerGlobalChunkErrorHandlers } from '@/utils/chunkRecovery'

// Clear stale caches and force reload once if a dynamic import (chunk) fails
if (typeof window !== 'undefined') {
	registerGlobalChunkErrorHandlers();

	// Prefetch critical auth routes to reduce chances of lazy-load failures on first navigation
	setTimeout(() => {
		void import('@/pages/Login').catch(() => {});
		void import('@/pages/Register').catch(() => {});
	}, 0);
}

createRoot(document.getElementById("root")!).render(
	<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="theme">
		<SaasProvider>
			<App />
		</SaasProvider>
	</ThemeProvider>
);
