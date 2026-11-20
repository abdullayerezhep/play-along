import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // relative paths, so the build works from any folder (e.g. GitHub Pages' /play-along/)
  base: './',
  plugins: [react()],
})
