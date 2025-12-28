import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/stock-exchange/',
  plugins: [react()],
  css: {
    devSourcemap: true,
  },
  build: {
    // Bundle ist ~570 KB durch React + Redux + i18next + lightweight-charts
    // Gzip: ~176 KB - akzeptabel für eine SPA ohne Routing
    chunkSizeWarningLimit: 600,
    sourcemap: 'hidden',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
