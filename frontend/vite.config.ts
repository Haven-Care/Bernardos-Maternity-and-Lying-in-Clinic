import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Vite doesn't read PORT on its own — it just increments off 5173 when the
    // port is busy. Honouring it means a second checkout, or tooling that
    // assigns a port, gets the server where it expects it rather than silently
    // landing on 5174.
    port: Number(process.env.PORT) || undefined,
  },
})
