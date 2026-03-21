
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: process.env.BUILD_TARGET === 'github' ? '/frigogest-2026/' : '/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // S5-07: Cache strategy para uso offline no curral
        runtimeCaching: [
          {
            // App shell — cache primeiro (sempre disponível offline)
            urlPattern: /^https:\/\/gestfri\.web\.app\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'frigogest-app-shell',
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          },
          {
            // Supabase REST — Network first, fallback cache (funciona offline com dados recentes)
            urlPattern: /^https:\/\/fgzbkvgaxnwlufhndoqp\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'frigogest-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 2 * 60 * 60 }
            }
          },
          {
            // Google Fonts / CDN (ícones, etc)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } }
          }
        ]
      },
      manifest: {
        name: 'FrigoGest 2026',
        short_name: 'FrigoGest',
        description: 'Gestão Inteligente de Frigoríficos — Vitória da Conquista BA',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
});
