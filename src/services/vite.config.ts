import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: Number(process.env.VITE_DEV_PORT ?? 5002) },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 4173),
    allowedHosts: true,
  },
})
