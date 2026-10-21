import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Keep the origin stable so an occupied port cannot silently break CORS.
      port: Number(process.env.PORT || env.PORT || 6100),
      strictPort: true,
    },
  }
})
