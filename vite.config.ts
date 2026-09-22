import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// No GitHub Pages o site fica em https://<usuario>.github.io/gabrielpatinetes-erp/
// (a variável BASE_PATH é definida no workflow .github/workflows/deploy.yml)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
