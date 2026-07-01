import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is overridden at build time for GitHub Pages via VITE_BASE env var
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
