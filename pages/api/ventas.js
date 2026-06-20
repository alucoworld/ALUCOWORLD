import { getData, setData } from '../../lib/data'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(await getData('ventas'))
  }
  if (req.method === 'POST') {
    const ventas = await getData('ventas')
    const nueva = { ...req.body, id: req.body.id || Date.now().toString() }
    ventas.push(nueva)
    await setData('ventas', ventas)
    return res.status(200).json(nueva)
  }
  if (req.method === 'DELETE') {
    const ventas = await getData('ventas')
    await setData('ventas', ventas.filter(v => v.id !== req.query.id))
    return res.status(200).json({ ok: true })
  }
  if (req.method === 'PUT') {
    const ventas = await getData('ventas')
    const idx = ventas.findIndex(v => v.id === req.query.id)
    if (idx !== -1) ventas[idx] = { ...ventas[idx], ...req.body }
    await setData('ventas', ventas)
    return res.status(200).json({ ok: true })
  }
  res.status(405).end()
}
