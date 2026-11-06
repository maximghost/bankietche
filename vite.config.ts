import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Sous-chemin de publication. Sur GitHub Pages (https://<user>.github.io/bankietche/),
// garder '/bankietche/'. Pour un domaine dédié (ex. app.bankietche.com), mettre '/'.
const BASE = process.env.BASE_PATH ?? '/bankietche/';

export default defineConfig({
  base: BASE,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Bankiétché — Mon banquier',
        short_name: 'Bankiétché',
        description: 'Gère ton argent au quotidien : Mobile Money, tontines, épargne. Fonctionne sans connexion.',
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#6D28D9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Les appels Supabase ne sont jamais mis en cache.
        navigateFallbackDenylist: [/^\/rest\//],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
