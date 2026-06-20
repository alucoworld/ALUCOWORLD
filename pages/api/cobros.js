import { getData, setData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(await getData('cobros'))
  }
  if (req.method === 'POST') {
    const cobros = await getData('cobros')
    const nuevo = { ...req.body, id: req.body.id || Date.now().toString() }
    cobros.push(nuevo)
    await setData('cobros', cobros)
    return res.status(200).json(nuevo)
  }
  if (req.method === 'DELETE') {
    const cobros = await getData('cobros')
    await setData('cobros', cobros.filter(c => c.id !== req.query.id))
    return res.status(200).json({ ok: true })
  }
  res.status(405).end()
}
