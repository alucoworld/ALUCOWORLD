// Local cache keys
const CACHE_KEY = 'aw_cache'
const QUEUE_KEY = 'aw_queue'

export function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
export function setCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
}
export function getCached(key) {
  return getCache()[key] || []
}
export function setCached(key, value) {
  const cache = getCache()
  cache[key] = value
  setCache(cache)
}

// Pending mutations when offline
export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}
export function enqueue(op) {
  const q = getQueue()
  q.push({ ...op, ts: Date.now() })
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch {}
}
export function clearQueue() {
  try { localStorage.removeItem(QUEUE_KEY) } catch {}
}

// Flush pending ops when back online
export async function flushQueue() {
  const q = getQueue()
  if (!q.length) return
  for (const op of q) {
    try {
      await fetch(op.url, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: op.body ? JSON.stringify(op.body) : undefined,
      })
    } catch { return } // still offline, stop
  }
  clearQueue()
}
