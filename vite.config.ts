import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Recharts is the bulk of the bundle; one chunk is fine for this app.
    chunkSizeWarningLimit: 800,
  },
})
