import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          // Benign when the browser or Django closes the socket mid-handoff (chat
          // session switch, reconnect, tab refresh). Vite still logs EPIPE otherwise.
          proxy.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EPIPE" || err.code === "ECONNRESET") return;
            console.error("[vite] ws proxy error:", err);
          });
        },
      },
    },
  },
})