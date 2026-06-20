import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export async function getData(key) {
  try {
    const data = await redis.get(key)
    return data || []
  } catch {
    return []
  }
}

export async function setData(key, value) {
  await redis.set(key, value)
}
