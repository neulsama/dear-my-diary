import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react()],
  server: {
    port: 5180, strictPort: true,
    // Proxy browser LLM calls same-origin -> provider, to avoid CORS in local dev.
    proxy: {
      '/llm-proxy/deepseek': { target: 'https://api.deepseek.com', changeOrigin: true, secure: true, rewrite: p => p.replace(/^\/llm-proxy\/deepseek/, '') },
      '/llm-proxy/openai': { target: 'https://api.openai.com', changeOrigin: true, secure: true, rewrite: p => p.replace(/^\/llm-proxy\/openai/, '') }
    }
  },
  preview: { port: 4180, strictPort: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
})
