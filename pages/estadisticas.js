import { useState, useEffect } from 'react'
import { getCached } from '../lib/offline'

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

const TRIMESTRES = [
  { label: 'Q1 2026 (Ene–Mar)', months: [0,1,2], year: 2026 },
  { label: 'Q2 2026 (Abr–Jun)', months: [3,4,5], year: 2026 },
  { label: 'Q3 2026 (Jul–Sep)', months: [6,7,8], year: 2026 },
  { label: 'Q4 2026 (Oct–Dic)', months: [9,10,11], year: 2026 },
  { label: 'Todo 2026', months: [0,1,2,3,4,5,6,7,8,9,10,11], year: 2026 },
]

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-AR')
const MODAL_STYLE = {
  'PLACAS': { bg: '#E6F1FB', color: '#0C447C', label: 'Placas' },
  'PLACAS + MECANIZADO': { bg: '#EAF3DE', color: '#27500A', label: 'Placa+Meca' },
  'OBRA ALEJANDRO': { bg: '#EEEDFE', color: '#3C3489', label: 'Alejandro' },
  'OBRA AGUSTIN': { bg: '#FAECE7', color: '#712B13', label: 'Agustín' },
}

function inTrimestre(fecha, trimestre) {
  if (!fecha) return false
  const d = new Date(fecha + 'T12:00:00')
  return d.getFullYear() === trimestre.year && trimestre.months.includes(d.getMonth())
}

export default function Estadisticas() {
  const [ventas, setVentas] = useState([])
  const [trimIdx, setTrimIdx] = useState(1)
  const [loading, setLoading] = useState(true)
  const [ChartJS, setChartJS] = useState(null)

  useEffect(() => {
    const cached = getCached('/api/ventas')
    if (cached?.length) setVentas(cached)
    fetch('/api/ventas').then(r => r.json()).then(v => { setVentas(v || []); setLoading(false) }).catch(() => setLoading(false))
    import('chart.js').then(m => {
      m.Chart.register(...m.registerables)
      setChartJS(m.Chart)
    })
  }, [])

  const trimestre = TRIMESTRES[trimIdx]
  const ventasFiltradas = ventas.filter(v => inTrimestre(v.entrega || v.fecha, trimestre))

  // ── Combos más vendidos
  const comboMap = {}
  ventasFiltradas.forEach(v => v.lineas?.forEach(l => {
    if (!l.combo || !l.cant) return
    const desc = COMBOS.find(c => c[0] === l.combo)?.[1] || l.combo
    comboMap[desc] = (comboMap[desc] || 0) + parseFloat(l.cant)
  }))
  const combosOrdenados = Object.entries(comboMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const totalPlacas = combosOrdenados.reduce((s, [, n]) => s + n, 0)

  // ── Color vendido (lado) por combo
  const colorPorCombo = {}
  ventasFiltradas.forEach(v => v.lineas?.forEach(l => {
    if (!l.combo || !l.cant || !l.color) return
    const desc = COMBOS.find(c => c[0] === l.combo)?.[1] || l.combo
    if (!colorPorCombo[desc]) colorPorCombo[desc] = {}
    colorPorCombo[desc][l.color] = (colorPorCombo[desc][l.color] || 0) + parseFloat(l.cant)
  }))

  // ── Ranking colores individuales
  const colorMap = {}
  ventasFiltradas.forEach(v => v.lineas?.forEach(l => {
    if (!l.color || !l.cant) return
    colorMap[l.color] = (colorMap[l.color] || 0) + parseFloat(l.cant)
  }))
  const coloresOrdenados = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // ── Top clientes por placas
  const clienteMap = {}
  ventasFiltradas.forEach(v => {
    const cant = v.lineas?.reduce((s, l) => s + (parseFloat(l.cant) || 0), 0) || 0
    if (!cant) return
    if (!clienteMap[v.cliente]) clienteMap[v.cliente] = { placas: 0, facturas: 0, modal: v.modal }
    clienteMap[v.cliente].placas += cant
    clienteMap[v.cliente].facturas += 1
  })
  const topClientes = Object.entries(clienteMap).sort((a, b) => b[1].placas - a[1].placas).slice(0, 10)
  const maxPlacas = topClientes[0]?.[1].placas || 1

  // ── Sin movimiento
  const combosConVenta = new Set(Object.keys(comboMap))
  const sinMovimiento = COMBOS.filter(c => !combosConVenta.has(c[1]))

  const coloresDistintos = Object.keys(comboMap).length
  const colorTop = combosOrdenados[0]?.[0] || '—'

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>Cargando estadísticas...</div>

  return (
    <div style={S.content}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Estadísticas</div>
        <select style={S.select} value={trimIdx} onChange={e => setTrimIdx(Number(e.target.value))}>
          {TRIMESTRES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
        </select>
      </div>

      {/* Métricas resumen */}
      <div style={S.metrics}>
        {[
          ['Placas vendidas', totalPlacas],
          ['Combos distintos', coloresDistintos],
          ['Combo top', colorTop, true],
          ['Sin movimiento', sinMovimiento.length, false, sinMovimiento.length > 0 ? '#A32D2D' : '#3B6D11'],
        ].map(([l, v, sm, c]) => (
          <div key={l} style={S.metric}>
            <div style={S.metricLabel}>{l}</div>
            <div style={{ ...S.metricVal, ...(sm ? { fontSize: 13 } : {}), ...(c ? { color: c } : {}) }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Combos más vendidos */}
      <div style={S.card}>
        <div style={S.cardTitle}>Combos más vendidos — {trimestre.label}</div>
        {combosOrdenados.length === 0
          ? <div style={S.empty}>Sin ventas en este período.</div>
          : combosOrdenados.map(([desc, cant]) => (
            <div key={desc} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 50px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
              <div style={{ background: 'var(--color-background-secondary)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(cant / combosOrdenados[0][1] * 100)}%`, height: '100%', background: '#185FA5', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{cant}</div>
            </div>
          ))
        }
      </div>

      {/* Color vendido por combo */}
      <div style={S.card}>
        <div style={S.cardTitle}>Color efectivamente vendido (lado pedido por el cliente)</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>De cada combo, cuántos se vendieron por cada lado</div>
        {Object.keys(colorPorCombo).length === 0
          ? <div style={S.empty}>Sin datos de color vendido. Asegurate de completar el campo "Color vendido" al cargar ventas.</div>
          : Object.entries(colorPorCombo)
              .sort((a, b) => Object.values(b[1]).reduce((s, n) => s + n, 0) - Object.values(a[1]).reduce((s, n) => s + n, 0))
              .slice(0, 8)
              .map(([combo, colores]) => {
                const total = Object.values(colores).reduce((s, n) => s + n, 0)
                const cols = Object.entries(colores).sort((a, b) => b[1] - a[1])
                return (
                  <div key={combo} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{combo}</div>
                    <div>
                      <div style={{ display: 'flex', gap: 2, height: 14, borderRadius: 4, overflow: 'hidden', marginBottom: 3 }}>
                        {cols.map(([color, n], i) => (
                          <div key={color} style={{ width: `${Math.round(n / total * 100)}%`, background: i === 0 ? '#185FA5' : i === 1 ? '#B5D4F4' : '#e0e0e0' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--color-text-secondary)' }}>
                        {cols.map(([color, n]) => (
                          <span key={color}>{color} ({n})</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{total}</div>
                  </div>
                )
              })
        }
      </div>

      {/* Ranking colores individuales */}
      <div style={S.card}>
        <div style={S.cardTitle}>Ranking de colores individuales</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Suma de todas las ventas donde ese color fue el lado pedido</div>
        {coloresOrdenados.length === 0
          ? <div style={S.empty}>Sin datos de color vendido.</div>
          : coloresOrdenados.map(([color, cant], i) => (
            <div key={color} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 50px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: i < 3 ? 500 : 400 }}>{i + 1}. {color}</div>
              <div style={{ background: 'var(--color-background-secondary)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(cant / coloresOrdenados[0][1] * 100)}%`, height: '100%', background: i === 0 ? '#185FA5' : i === 1 ? '#378ADD' : '#85B7EB', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{cant}</div>
            </div>
          ))
        }
      </div>

      {/* Top 10 clientes */}
      <div style={S.card}>
        <div style={S.cardTitle}>Top 10 clientes por placas compradas</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>{trimestre.label}</div>
        {topClientes.length === 0
          ? <div style={S.empty}>Sin datos de clientes.</div>
          : <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>#</th>
                <th style={S.th}>Cliente</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Placas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Facturas</th>
                <th style={S.th}>Participación</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Modalidad</th>
              </tr></thead>
              <tbody>
                {topClientes.map(([nombre, d], i) => {
                  const rankColors = ['#FFD700','#C0C0C0','#CD7F32']
                  const rankBg = ['#FFF8DC','#F5F5F5','#FDF0E0']
                  const ms = MODAL_STYLE[d.modal] || { bg: '#eee', color: '#333', label: d.modal }
                  return (
                    <tr key={nombre} style={i % 2 ? { background: '#fafafa' } : {}}>
                      <td style={S.td}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: rankBg[i] || '#f0f0f0', color: rankColors[i] || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500 }}>{i + 1}</div>
                      </td>
                      <td style={{ ...S.td, fontWeight: i < 3 ? 500 : 400 }}>{nombre}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 500 }}>{d.placas}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#888' }}>{d.facturas}</td>
                      <td style={S.td}>
                        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ width: `${Math.round(d.placas / maxPlacas * 100)}%`, height: '100%', background: '#185FA5', borderRadius: 4 }} />
                        </div>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <span style={{ background: ms.bg, color: ms.color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{ms.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        }
      </div>

      {/* Sin movimiento */}
      {sinMovimiento.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Sin movimiento este período</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 8 }}>
            {sinMovimiento.map(c => (
              <div key={c[0]} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{c[1]}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#A32D2D', marginTop: 4 }}>0 placas</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  content: { padding: 16, fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 1100, margin: '0 auto' },
  card: { background: 'var(--color-background-primary,#fff)', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 600, marginBottom: 12 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
  metric: { background: '#f5f5f5', borderRadius: 8, padding: 12, textAlign: 'center' },
  metricLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  metricVal: { fontSize: 18, fontWeight: 600 },
  select: { border: '0.5px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: '#fff', color: '#111' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: '#f5f5f5', padding: '7px 8px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#666', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { padding: '7px 8px', borderBottom: '0.5px solid #f0f0f0', verticalAlign: 'middle' },
  empty: { textAlign: 'center', color: '#888', padding: '24px 0', fontSize: 13 },
}
