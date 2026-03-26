import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/wave_browser/' : '/',
  server: {
    port: 5317,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: ['waveformviewerweb.it.cyou', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8800',
        changeOrigin: true,
      }
    }
  }
})
