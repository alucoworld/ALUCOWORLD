import { useState, useEffect, useCallback } from 'react'
import { getCached, setCached, enqueue } from '../lib/offline'

const COMBOS = [
  ["1006015-1008009","ACM Blanco - Azul"],
  ["1006015-1008008","ACM Blanco - Verde"],
  ["1006015-1008011","ACM Blanco - Amarillo"],
  ["1006015-1006042","ACM Blanco - Oak"],
  ["1006015-1006017","ACM Blanco - Bronze"],
  ["1008002-1006001","ACM Silver - Grafito"],
  ["1008002-1008014","ACM Silver - Negro"],
  ["1008002-1008030","ACM Silver - Brush"],
  ["1008001-1008002","ACM Silver - Silver Mate"],
  ["1008014-1006017","ACM Negro - Bronze"],
  ["1008014-1008006","ACM Negro - Oro"],
  ["1008014-1008009","ACM Negro - Azul"],
  ["1008014-1008007","ACM Negro - Rojo"],
  ["1008014-1008033","Black + Mirror"],
  ["1006015-1006015","ACM Blanco - Blanco"],
]

const TIPOS = [
  { value: 'ENVIO_MECANIZADO', label: 'Envío para mecanizar', color: '#854F0B', bg: '#FAEEDA', entrada: true },
  { value: 'ENVIO_STOCK', label: 'Envío como stock extra', color: '#0C447C', bg: '#E6F1FB', entrada: true },
  { value: 'USO_MECANIZADO', label: 'Usadas en mecanizado', color: '#27500A', bg: '#EAF3DE', entrada: false },
  { value: 'VENTA_ALFREDO', label: 'Vendidas por Alfredo', color: '#3C3489', bg: '#EEEDFE', entrada: false },
  { value: 'DEVOLUCION', label: 'Devolución al depósito', color: '#791F1F', bg: '#FCEBEB', entrada: false },
]

const hoy = () => new Date().toISOString().split('T')[0]
const fmt = n => Math.round(n || 0).toLocaleString('es-AR')

async function apiGet(path) {
  try {
    const r = await fetch(path)
    const data = await r.json()
    setCached(path, data)
    return data
  } catch {
    return getCached(path) || []
  }
}

async function apiPost(path, body) {
  const item = { ...body, id: Date.now().toString() }
  const current = getCached(path) || []
  setCached(path, [...current, item])
  try {
    await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
  } catch {
    enqueue({ url: path, method: 'POST', body: item })
  }
  return item
}

async function apiDelete(path, id) {
  const current = getCached(path) || []
  setCached(path, current.filter(i => i.id !== id))
  try {
    await fetch(`${path}?id=${id}`, { method: 'DELETE' })
  } catch {
    enqueue({ url: `${path}?id=${id}`, method: 'DELETE' })
  }
}

export default function TallerAlfredo() {
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ fecha: hoy(), combo: '', cant: '', tipo: 'ENVIO_MECANIZADO', obs: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    const data = await apiGet('/api/taller-alfredo')
    setMovs(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Stock por combo
  const stockPorCombo = {}
  COMBOS.forEach(c => stockPorCombo[c[0]] = { desc: c[1], enviadas: 0, usadas: 0 })
  movs.forEach(m => {
    if (!stockPorCombo[m.combo]) return
    const t = TIPOS.find(t => t.value === m.tipo)
    if (t?.entrada) stockPorCombo[m.combo].enviadas += parseFloat(m.cant) || 0
    else stockPorCombo[m.combo].usadas += parseFloat(m.cant) || 0
  })

  const stockConMovimiento = Object.entries(stockPorCombo)
    .map(([cod, d]) => ({ cod, ...d, enTaller: d.enviadas - d.usadas }))
    .filter(d => d.enviadas > 0)
    .sort((a, b) => b.enTaller - a.enTaller)

  const totalEnTaller = stockConMovimiento.reduce((s, d) => s + Math.max(0, d.enTaller), 0)

  const handleAdd = async () => {
    if (!form.combo || !form.cant || parseFloat(form.cant) <= 0) return alert('Completá combo y cantidad')
    const nuevo = await apiPost('/api/taller-alfredo', form)
    setMovs(prev => [...prev, nuevo])
    setForm({ fecha: hoy(), combo: '', cant: '', tipo: 'ENVIO_MECANIZADO', obs: '' })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Borrar este movimiento?')) return
    await apiDelete('/api/taller-alfredo', id)
    setMovs(prev => prev.filter(m => m.id !== id))
  }

  const tipoStyle = (tipo) => TIPOS.find(t => t.value === tipo) || { label: tipo, color: '#333', bg: '#eee', entrada: true }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <a href="/" style={{ color: '#fff', fontSize: 13, textDecoration: 'none', opacity: 0.8 }}>← Volver</a>
        <span style={S.headerTitle}>Taller Alfredo</span>
        <div style={{ fontSize: 12, opacity: 0.8 }}>En taller ahora: <strong>{fmt(totalEnTaller)} placas</strong></div>
      </div>

      <div style={S.content}>

        {/* Stock actual */}
        <div style={S.card}>
          <div style={S.cardTitle}>Stock actual en taller Alfredo</div>
          {stockConMovimiento.length === 0
            ? <div style={S.empty}>Sin movimientos registrados todavía.</div>
            : <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3,90px)', gap: 8, fontSize: 11, color: '#888', paddingBottom: 6, borderBottom: '1px solid #e5e7eb', marginBottom: 8 }}>
                <span>COLOR</span>
                <span style={{ textAlign: 'right' }}>ENVIADAS</span>
                <span style={{ textAlign: 'right' }}>USADAS</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>EN TALLER</span>
              </div>
              {stockConMovimiento.map(d => (
                <div key={d.cod} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3,90px)', gap: 8, padding: '7px 0', borderBottom: '0.5px solid #f0f0f0', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: d.enTaller > 0 ? 500 : 400 }}>{d.desc}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: '#0C447C' }}>{fmt(d.enviadas)}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: '#888' }}>{fmt(d.usadas)}</div>
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: d.enTaller > 0 ? '#27500A' : d.enTaller < 0 ? '#A32D2D' : '#888' }}>
                    {fmt(d.enTaller)}{d.enTaller < 0 && ' ⚠'}
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3,90px)', gap: 8, padding: '10px 0 0', marginTop: 4, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>TOTAL</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#0C447C' }}>{fmt(stockConMovimiento.reduce((s, d) => s + d.enviadas, 0))}</div>
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#888' }}>{fmt(stockConMovimiento.reduce((s, d) => s + d.usadas, 0))}</div>
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#27500A' }}>{fmt(totalEnTaller)}</div>
              </div>
            </>
          }
        </div>

        {/* Nuevo movimiento */}
        <div style={S.card}>
          <div style={S.cardTitle}>Registrar movimiento</div>
          <div style={S.formRow}>
            <FG l="Fecha"><input type="date" style={S.input} value={form.fecha} onChange={e => set('fecha', e.target.value)} /></FG>
            <FG l="Tipo">
              <select style={S.input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FG>
            <FG l="Color / Combo">
              <select style={S.input} value={form.combo} onChange={e => set('combo', e.target.value)}>
                <option value="">— elegir —</option>
                {COMBOS.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
              </select>
            </FG>
            <FG l="Cantidad">
              <input type="number" style={S.input} value={form.cant} onChange={e => set('cant', e.target.value)} placeholder="0" min="1" />
            </FG>
            <FG l="Observaciones">
              <input style={S.input} value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Ej: Remito 123" />
            </FG>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={S.btnPrimary} onClick={handleAdd}>Registrar</button>
          </div>
        </div>

        {/* Historial */}
        <div style={S.card}>
          <div style={S.cardTitle}>Historial de movimientos</div>
          {loading ? <div style={S.empty}>Cargando...</div>
            : movs.length === 0 ? <div style={S.empty}>Sin movimientos.</div>
            : <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  {['FECHA','TIPO','COLOR','CANT','OBS',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[...movs].reverse().map((m, i) => {
                    const ts = tipoStyle(m.tipo)
                    const desc = COMBOS.find(c => c[0] === m.combo)?.[1] || m.combo
                    return (
                      <tr key={m.id} style={i % 2 ? { background: '#fafafa' } : {}}>
                        <td style={S.td}>{m.fecha}</td>
                        <td style={S.td}><span style={{ background: ts.bg, color: ts.color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{ts.label}</span></td>
                        <td style={S.td}>{desc}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: ts.entrada ? '#0C447C' : '#A32D2D' }}>
                          {ts.entrada ? '+' : '-'}{fmt(m.cant)}
                        </td>
                        <td style={{ ...S.td, color: '#888', fontSize: 12 }}>{m.obs || '—'}</td>
                        <td style={S.td}><button style={S.btnDanger} onClick={() => handleDelete(m.id)}>×</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  )
}

function FG({ l, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 12, color: '#888' }}>{l}</label>{children}</div>
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', minHeight: '100vh', background: '#f9fafb' },
  header: { background: '#171D80', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 },
  headerTitle: { fontWeight: 700, fontSize: 15, flex: 1 },
  content: { padding: 16, maxWidth: 1100, margin: '0 auto' },
  card: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 600, marginBottom: 12 },
  formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 },
  input: { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 10px', fontSize: 13, width: '100%', background: '#fff', color: '#111' },
  btnPrimary: { padding: '7px 20px', border: 'none', borderRadius: 8, background: '#171D80', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnDanger: { padding: '4px 10px', border: '1px solid #E24B4A', borderRadius: 6, background: '#fff', color: '#E24B4A', cursor: 'pointer', fontSize: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: '#f5f5f5', padding: '7px 8px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#666', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { padding: '7px 8px', borderBottom: '0.5px solid #f0f0f0', verticalAlign: 'middle' },
  empty: { textAlign: 'center', color: '#888', padding: '20px 0', fontSize: 13 },
}
