import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export async function getData(key) {
  // Si Redis falla, el error sube (HTTP 500): asi nunca se guarda una lista vacia encima de datos reales.
  const data = await redis.get(key)
  return data || []
}

export async function setData(key, value) {
  await redis.set(key, value)
}
