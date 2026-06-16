import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['0211cf94ff1d00f6-121-46-87-65.serveousercontent.com', 'localhost', '.serveousercontent.com', 'all']
  }
})
