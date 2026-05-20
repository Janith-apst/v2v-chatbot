import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Voice Assistant POC",
        short_name: "Voice POC",
        description:
          "Realtime voice-to-voice conversation prototype (Phase 1 — local development only).",
        theme_color: "#0a0a0a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
      },
    }),
  ],

  server: {
    allowedHosts: [".ngrok-free.app", ".ngrok.app", ".ngrok.io"],
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})