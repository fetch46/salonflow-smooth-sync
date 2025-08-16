// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig(async ({ mode }) => {
  let componentTagger = null;
  if (mode === "development") {
    try {
      ({ componentTagger } = await import("file:///home/project/node_modules/lovable-tagger/dist/index.js"));
    } catch {
    }
  }
  return {
    base: process.env.VITE_BASE || "/",
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          secure: false
        }
      }
    },
    plugins: [
      react(),
      mode === "development" && componentTagger && componentTagger()
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src"),
        // Ensure only one copy of React is bundled – prevents "hooks" runtime errors
        react: path.resolve(__vite_injected_original_dirname, "./node_modules/react"),
        "react-dom": path.resolve(__vite_injected_original_dirname, "./node_modules/react-dom")
      },
      dedupe: ["react", "react-dom"]
    },
    optimizeDeps: {
      include: ["react", "react-dom"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyhhc3luYyAoeyBtb2RlIH0pID0+IHtcblx0bGV0IGNvbXBvbmVudFRhZ2dlcjogYW55ID0gbnVsbDtcblx0aWYgKG1vZGUgPT09ICdkZXZlbG9wbWVudCcpIHtcblx0XHR0cnkge1xuXHRcdFx0KHsgY29tcG9uZW50VGFnZ2VyIH0gPSBhd2FpdCBpbXBvcnQoJ2xvdmFibGUtdGFnZ2VyJykpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gT3B0aW9uYWwgZGV2LW9ubHkgcGx1Z2luIG5vdCBpbnN0YWxsZWQ7IGlnbm9yZVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0YmFzZTogcHJvY2Vzcy5lbnYuVklURV9CQVNFIHx8IFwiL1wiLFxuXHRcdHNlcnZlcjoge1xuXHRcdFx0aG9zdDogXCI6OlwiLFxuXHRcdFx0cG9ydDogODA4MCxcblx0XHRcdHByb3h5OiB7XG5cdFx0XHRcdCcvYXBpJzoge1xuXHRcdFx0XHRcdHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NDAwMCcsXG5cdFx0XHRcdFx0Y2hhbmdlT3JpZ2luOiB0cnVlLFxuXHRcdFx0XHRcdHNlY3VyZTogZmFsc2UsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHBsdWdpbnM6IFtcblx0XHRcdHJlYWN0KCksXG5cdFx0XHRtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmIGNvbXBvbmVudFRhZ2dlciAmJiBjb21wb25lbnRUYWdnZXIoKSxcblx0XHRdLmZpbHRlcihCb29sZWFuKSBhcyBhbnksXG5cdFx0cmVzb2x2ZToge1xuXHRcdFx0YWxpYXM6IHtcblx0XHRcdFx0XCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG5cdFx0XHRcdC8vIEVuc3VyZSBvbmx5IG9uZSBjb3B5IG9mIFJlYWN0IGlzIGJ1bmRsZWQgXHUyMDEzIHByZXZlbnRzIFwiaG9va3NcIiBydW50aW1lIGVycm9yc1xuXHRcdFx0XHRyZWFjdDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9yZWFjdFwiKSxcblx0XHRcdFx0XCJyZWFjdC1kb21cIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9yZWFjdC1kb21cIiksXG5cdFx0XHR9LFxuXHRcdFx0ZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiXSxcblx0XHR9LFxuXHRcdG9wdGltaXplRGVwczoge1xuXHRcdFx0aW5jbHVkZTogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIl0sXG5cdFx0fSxcblx0fTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUNBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLE9BQU8sRUFBRSxLQUFLLE1BQU07QUFDL0MsTUFBSSxrQkFBdUI7QUFDM0IsTUFBSSxTQUFTLGVBQWU7QUFDM0IsUUFBSTtBQUNILE9BQUMsRUFBRSxnQkFBZ0IsSUFBSSxNQUFNLE9BQU8sZ0VBQWdCO0FBQUEsSUFDckQsUUFBUTtBQUFBLElBRVI7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUFBLElBQ04sTUFBTSxRQUFRLElBQUksYUFBYTtBQUFBLElBQy9CLFFBQVE7QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNOLFFBQVE7QUFBQSxVQUNQLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNSLE1BQU07QUFBQSxNQUNOLFNBQVMsaUJBQWlCLG1CQUFtQixnQkFBZ0I7QUFBQSxJQUM5RCxFQUFFLE9BQU8sT0FBTztBQUFBLElBQ2hCLFNBQVM7QUFBQSxNQUNSLE9BQU87QUFBQSxRQUNOLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQTtBQUFBLFFBRXBDLE9BQU8sS0FBSyxRQUFRLGtDQUFXLHNCQUFzQjtBQUFBLFFBQ3JELGFBQWEsS0FBSyxRQUFRLGtDQUFXLDBCQUEwQjtBQUFBLE1BQ2hFO0FBQUEsTUFDQSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQUEsSUFDOUI7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNiLFNBQVMsQ0FBQyxTQUFTLFdBQVc7QUFBQSxJQUMvQjtBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
