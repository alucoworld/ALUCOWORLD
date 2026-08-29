import { getData, setData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(await getData('taller-alfredo'))
  }
  if (req.method === 'POST') {
    const movs = await getData('taller-alfredo')
    const nuevo = { ...req.body, id: req.body.id || Date.now().toString() }
    movs.push(nuevo)
    await setData('taller-alfredo', movs)
    return res.status(200).json(nuevo)
  }
  if (req.method === 'DELETE') {
    const movs = await getData('taller-alfredo')
    await setData('taller-alfredo', movs.filter(m => m.id !== req.query.id))
    return res.status(200).json({ ok: true })
  }
  res.status(405).end()
}
