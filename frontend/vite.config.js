import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Proxy Groq API calls so the browser can reach it without CORS issues.
    // The frontend calls /groq/... and Vite forwards to https://api.groq.com/...
    proxy: {
      "/groq": {
        target: "https://api.groq.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/groq/, ""),
      },
    },
  },
});
