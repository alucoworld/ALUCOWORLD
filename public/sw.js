const CACHE = 'alucoworld-v1'
const OFFLINE_URLS = ['/', '/_next/static/chunks/main.js']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/'])
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // API calls: network first, fallback to queued offline actions
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request.clone()).catch(() => {
        // Offline: return empty arrays for GET, ok for mutations
        if (e.request.method === 'GET') {
          return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
        }
        return new Response(JSON.stringify({ ok: true, offline: true }), { headers: { 'Content-Type': 'application/json' } })
      })
    )
    return
  }

  // Pages & assets: cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      return cached || network
    })
  )
})
