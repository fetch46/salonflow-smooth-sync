
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
	let componentTagger: any = null;
	if (mode === 'development') {
		try {
			({ componentTagger } = await import('lovable-tagger'));
		} catch {
			// Optional dev-only plugin not installed; ignore
		}
	}

	return {
		base: process.env.VITE_BASE || (mode === 'production' ? './' : '/'),
		server: {
			host: "::",
			port: 8080,
			proxy: {
				'/api': {
					target: 'http://localhost:4000',
					changeOrigin: true,
					secure: false,
				}
			}
		},
		plugins: [
			react(),
			mode === 'development' && componentTagger && componentTagger(),
		].filter(Boolean) as any,
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
				// Ensure only one copy of React is bundled – prevents "hooks" runtime errors
				react: path.resolve(__dirname, "./node_modules/react"),
				"react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
			},
			dedupe: ["react", "react-dom"],
		},
		optimizeDeps: {
			include: ["react", "react-dom"],
		},
	};
});
