import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "TarabayMais - AI Farming Assistant",
        short_name: "TarabayMais",
        description: "AI farming assistant for corn farmers",
        theme_color: "#2e7d32",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        screenshots: [
          {
            src: "screenshots/desktop.png",
            sizes: "1917x1077",
            type: "image/png",
            form_factor: "wide",
            label: "Farm dashboard",
          },
          {
            src: "screenshots/mobile.png",
            sizes: "330x745",
            type: "image/png",
            label: "Plant health scanner",
          },
        ],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // Authentication responses must never be shared through the
            // service-worker cache. The app stores `/auth/me` per Firebase UID
            // in AuthProvider instead, which makes offline startup safe on a
            // shared device.
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/v1/") &&
              !url.pathname.startsWith("/api/v1/auth/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/ai/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "ai-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
});
