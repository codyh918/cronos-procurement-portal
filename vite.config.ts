import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: 5002 },
  preview: {
    allowedHosts: ['cronos-procurement-portal-production.up.railway.app'],
  },
})
