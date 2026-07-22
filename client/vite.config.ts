import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Only precaches the built app shell (JS/CSS/HTML/icons) for a fast,
      // installable load — deliberately does NOT add any runtime caching
      // rule for /api or /uploads, so table status, orders, and menu data
      // always come straight from the till's server, never a stale cache.
      manifest: {
        name: 'Sarini Bistro POS',
        short_name: 'Sarini Bistro',
        description: 'Point of sale for Sarini Bistro',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#181614',
        theme_color: '#181614',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    // Listen on 0.0.0.0, not just localhost, so a phone on the same WiFi
    // can reach the dev server too (only matters for `npm run dev`; the
    // packaged desktop app already serves everything from one already
    // LAN-reachable port, see server/src/index.js).
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
})
