import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Emit the service worker with a per-build id baked in, so every deploy is a
// byte-different sw.js -> the browser detects the update and main.tsx reloads.
const BUILD_ID = Date.now().toString(36)
const SW_SOURCE = `const CACHE = 'dmd-${BUILD_ID}'
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', event => { event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))); await self.clients.claim() })()) })
self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/llm-proxy')) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try { const res = await fetch(req); if (res && res.status === 200) cache.put(req, res.clone()); return res }
    catch { const cached = await cache.match(req); if (cached) return cached; if (req.mode === 'navigate') { const shell = await cache.match('/monthly') || await cache.match('/index.html') || await cache.match('/'); if (shell) return shell } throw new Error('offline and not cached') }
  })())
})
`
const emitServiceWorker = (): Plugin => ({
  name: 'emit-service-worker',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW_SOURCE }) }
})

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react(), emitServiceWorker()],
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
