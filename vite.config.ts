import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // Гарантируем единственный экземпляр React (motion подтягивает свою копию иначе).
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['motion/react', 'react', 'react-dom'],
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true, // 0.0.0.0 чтобы был доступен из туннеля
    // Разрешаем любые хосты (для ngrok/cloudflared). На проде/в Vercel это не нужно.
    allowedHosts: true,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
})