import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // relative paths, so the build works from any folder (e.g. GitHub Pages' /play-along/)
  base: './',
  plugins: [
    react(),
    // Makes the website installable and usable offline. The store apps (`--mode native`)
    // carry their files inside the app, so they need no service worker.
    VitePWA({
      disable: mode === 'native' || mode === 'test',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Play Along',
        short_name: 'Play Along',
        description: 'Strum your guitar along with the notes. The microphone listens for your strums and chords.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#1a110d',
        theme_color: '#1a110d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // every modern browser reads woff2, so the older woff copies stay out of the offline cache
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
}))
