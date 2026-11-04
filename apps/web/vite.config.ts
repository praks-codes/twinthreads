import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const target =
    loadEnv(mode, import.meta.dirname).VITE_SERVER_URL ??
    "http://localhost:3001";
  return {
    plugins: [react()],
    resolve: { conditions: ["@twinthreads/source"] },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // Same-origin in dev, so a phone on the network reaches the server through Vite.
      proxy: {
        "/health": target,
        "/socket.io": { target, ws: true },
      },
    },
  };
});
