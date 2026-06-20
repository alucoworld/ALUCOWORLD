import '../styles/globals.css'
import { useEffect } from 'react'
import { flushQueue } from '../lib/offline'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    // Flush queue when coming back online
    window.addEventListener('online', flushQueue)
    flushQueue()
    return () => window.removeEventListener('online', flushQueue)
  }, [])

  return <Component {...pageProps} />
}
