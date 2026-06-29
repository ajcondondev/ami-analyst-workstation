import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://ajcondondev.github.io/ami-analyst-workstation/
  base: '/ami-analyst-workstation/',
})
