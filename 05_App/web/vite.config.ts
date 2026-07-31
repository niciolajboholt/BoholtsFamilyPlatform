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
      manifest: {
        name: 'Boholts Familieapp',
        short_name: 'Boholts',
        description: 'Familiens fælles kalender og aftaler, samlet ét sted.',
        lang: 'da',
        start_url: '/',
        display: 'standalone',
        theme_color: '#2E7D32',
        background_color: '#F7F8FA',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Google Calendar-kald og OAuth må aldrig gå gennem service
        // workerens cache — appens app-skal (JS/CSS/HTML) precaches og
        // virker offline, men kalenderdata og adgangstoken skal altid være
        // friske og går derfor altid direkte til netværket (Audit F-04).
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://www.googleapis.com' ||
              url.origin === 'https://accounts.google.com',
            handler: 'NetworkOnly',
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
