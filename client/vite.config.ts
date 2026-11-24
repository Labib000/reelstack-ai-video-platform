import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The Express API (added later) runs on :4000; same-origin /api keeps the
    // refresh-token cookie first-party in development.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
