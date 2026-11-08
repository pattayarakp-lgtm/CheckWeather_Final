import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/weather': 'http://localhost:3000',
      '/destination-weather': 'http://localhost:3000',
      '/provinces': 'http://localhost:3000'
    }
  }
})
