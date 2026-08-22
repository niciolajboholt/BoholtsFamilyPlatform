/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Sprint 21, Del A: skiftet fra generateSW til injectManifest — kun
      // injectManifest lader os skrive vores egen service worker-kode
      // (src/sw.ts) og dermed tilføje "push"/"notificationclick"-lyttere.
      // Precaching og navigations-fallback (herunder /auth+/api-undtagelsen,
      // tidligere sat via workbox.navigateFallbackDenylist) er nu
      // implementeret direkte i src/sw.ts i stedet for konfigureret her.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Google Calendar-kald og OAuth må aldrig cache — de precaches ikke
        // (kun app-skallens egne build-outputs matcher globPatterns), så
        // de går altid direkte til netværket uden nogen ekstra regel.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      manifest: {
        name: 'Boholts Familieapp',
        short_name: 'Boholts',
        description: 'Familiens fælles kalender og aftaler, samlet ét sted.',
        lang: 'da',
        start_url: '/',
        display: 'standalone',
        theme_color: '#2F6B4F',
        background_color: '#F6F5EF',
        // Sprint 25: rigtige PNG'er i flere størrelser i stedet for kun
        // favicon.svg overalt — iOS-installation og Androids maskable-
        // beskæring forventer begge konkrete raster-størrelser, ikke en
        // enkelt SVG i alle roller. SVG'en beholdes som fallback (sizes:
        // "any") for browsere der foretrækker den.
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
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
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setupTimezone.ts'],
  },
})
