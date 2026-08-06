// Minimal offline-capable service worker (network-first, cache fallback).
// Registered only in production (see main.tsx), so local dev/HMR is untouched.
const CACHE = 'dmd-v1'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  // Only handle same-origin GETs; never cache the LLM proxy or API calls.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/llm-proxy')) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const res = await fetch(req)
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    } catch {
      const cached = await cache.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') {
        const shell = await cache.match('/monthly') || await cache.match('/index.html') || await cache.match('/')
        if (shell) return shell
      }
      throw new Error('offline and not cached')
    }
  })())
})
