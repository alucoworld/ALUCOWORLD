import { kv } from '@vercel/kv'

export async function getData(key) {
  try {
    const data = await kv.get(key)
    return data || []
  } catch {
    return []
  }
}

export async function setData(key, value) {
  await kv.set(key, value)
}
