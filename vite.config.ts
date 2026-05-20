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
        target: "http://10.10.112.72:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://10.10.112.72:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
})