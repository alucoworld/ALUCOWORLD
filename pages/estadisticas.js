import { useState, useEffect, useRef } from 'react'
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

// Barra horizontal simple sin Chart.js
function BarRow({ label, value, max, color = '#185FA5', bold = false }) {
  const pct = Math.round(value / max * 100)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 45px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: bold ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: bold ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ background: '#f0f0f0', borderRadius: 4, height: 14, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{value}</div>
    </div>
  )
}

export default function Estadisticas() {
  const [ventas, setVentas] = useState([])
  const [trimIdx, setTrimIdx] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = getCached('/api/ventas')
    if (cached?.length) { setVentas(cached); setLoading(false) }
    fetch('/api/ventas').then(r => r.json()).then(v => { setVentas(v || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const trimestre = TRIMESTRES[trimIdx]
  const ventasFiltradas = ventas.filter(v => inTrimestre(v.entrega || v.fecha, trimestre))

  // Combos más vendidos
  const comboMap = {}
  ventasFiltradas.forEach(v => v.lineas?.forEach(l => {
    if (!l.combo || !l.cant) return
    const desc = COMBOS.find(c => c[0] === l.combo)?.[1] || l.combo
    comboMap[desc] = (comboMap[desc] || 0) + parseFloat(l.cant)
  }))
  const combosOrdenados = Object.entries(comboMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const totalPlacas = ventasFiltradas.reduce((s, v) => s + (v.lineas?.reduce((ss, l) => ss + (parseFloat(l.cant) || 0), 0) || 0), 0)

  // Color vendido por combo
  const colorPorCombo = {}
  ventasFiltradas.forEach(v => v.lineas?.forEach(l => {
    if (!l.combo || !l.cant || !l.color) return
    const desc = COMBOS.find(c => c[0] === l.combo)?.[1] || l.combo
    if (!colorPorCombo[desc]) colorPorCombo[desc] = {}
    colorPorCombo[desc][l.color] = (colorPorCombo[desc][l.color] || 0) + parseFloat(l.cant)
  }))
  const colorPorComboOrdenado = Object.entries(colorPorCombo)
    .map(([combo, colores]) => ({ combo, colores, total: Object.values(colores).reduce((s, n) => s + n, 0) }))
    .sort((a, b) => b.total - a.total).slice(0, 8)

  // Ranking colores individuales
  const colorMap = {}
  ventasFiltradas.forEach(v => v.lineas?.forEach(l => {
    if (!l.color || !l.cant) return
    colorMap[l.color] = (colorMap[l.color] || 0) + parseFloat(l.cant)
  }))
  const coloresOrdenados = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Top clientes
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

  // Sin movimiento
  const combosConVenta = new Set(Object.keys(comboMap))
  const sinMovimiento = COMBOS.filter(c => !combosConVenta.has(c[1]))
  const coloresDistintos = combosOrdenados.length
  const colorTop = combosOrdenados[0]?.[0] || '—'

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#888', fontFamily: 'system-ui' }}>Cargando estadísticas...</div>

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <a href="/" style={{ color: '#fff', fontSize: 13, textDecoration: 'none', opacity: 0.8 }}>← Volver</a>
        <span style={S.headerTitle}>Estadísticas</span>
        <select style={S.select} value={trimIdx} onChange={e => setTrimIdx(Number(e.target.value))}>
          {TRIMESTRES.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
        </select>
      </div>

      <div style={S.content}>
        {/* Métricas resumen */}
        <div style={S.metrics}>
          {[
            ['Placas vendidas', totalPlacas, null],
            ['Combos distintos', coloresDistintos, null],
            ['Combo top', colorTop, null, true],
            ['Sin movimiento', sinMovimiento.length, sinMovimiento.length > 0 ? '#A32D2D' : '#3B6D11'],
          ].map(([l, v, c, sm]) => (
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
            : combosOrdenados.map(([desc, cant], i) => (
              <BarRow key={desc} label={desc} value={cant} max={combosOrdenados[0][1]} bold={i < 3} />
            ))
          }
        </div>

        {/* Color vendido por combo */}
        <div style={S.card}>
          <div style={S.cardTitle}>Color efectivamente vendido (lado pedido por el cliente)</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>De cada combo, cuántos se vendieron por cada lado</div>
          {colorPorComboOrdenado.length === 0
            ? <div style={S.empty}>Sin datos. Completá el campo "Color vendido" al cargar ventas.</div>
            : colorPorComboOrdenado.map(({ combo, colores, total }) => {
              const cols = Object.entries(colores).sort((a, b) => b[1] - a[1])
              return (
                <div key={combo} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{combo}</div>
                  <div>
                    <div style={{ display: 'flex', gap: 2, height: 14, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                      {cols.map(([color, n], i) => (
                        <div key={color} title={`${color}: ${n}`} style={{ width: `${Math.round(n / total * 100)}%`, background: i === 0 ? '#185FA5' : i === 1 ? '#B5D4F4' : '#e0e0e0' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#888', flexWrap: 'wrap' }}>
                      {cols.map(([color, n]) => <span key={color}>{color} ({n})</span>)}
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
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Suma de todas las ventas donde ese color fue el lado pedido</div>
          {coloresOrdenados.length === 0
            ? <div style={S.empty}>Sin datos de color vendido.</div>
            : coloresOrdenados.map(([color, cant], i) => (
              <BarRow key={color} label={`${i + 1}. ${color}`} value={cant} max={coloresOrdenados[0][1]}
                color={i === 0 ? '#185FA5' : i === 1 ? '#378ADD' : '#85B7EB'} bold={i < 3} />
            ))
          }
        </div>

        {/* Top 10 clientes */}
        <div style={S.card}>
          <div style={S.cardTitle}>Top 10 clientes por placas compradas</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{trimestre.label}</div>
          {topClientes.length === 0
            ? <div style={S.empty}>Sin datos de clientes.</div>
            : <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  {['#','Cliente','Placas','Facturas','Participación','Modalidad'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {topClientes.map(([nombre, d], i) => {
                    const rankBg = ['#FFF8DC','#F5F5F5','#FDF0E0']
                    const rankColor = ['#B8860B','#666','#8B4513']
                    const ms = MODAL_STYLE[d.modal] || { bg: '#eee', color: '#333', label: d.modal }
                    return (
                      <tr key={nombre} style={i % 2 ? { background: '#fafafa' } : {}}>
                        <td style={S.td}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: rankBg[i] || '#f0f0f0', color: rankColor[i] || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500 }}>{i + 1}</div>
                        </td>
                        <td style={{ ...S.td, fontWeight: i < 3 ? 500 : 400 }}>{nombre}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 500 }}>{d.placas}</td>
                        <td style={{ ...S.td, textAlign: 'right', color: '#888' }}>{d.facturas}</td>
                        <td style={S.td}>
                          <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 60 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
              {sinMovimiento.map(c => (
                <div key={c[0]} style={{ background: '#f5f5f5', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>{c[1]}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#A32D2D', marginTop: 4 }}>0 placas</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  page: { fontFamily: 'system-ui,-apple-system,sans-serif', minHeight: '100vh', background: '#f9fafb' },
  header: { background: '#171D80', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 },
  headerTitle: { fontWeight: 700, fontSize: 15, flex: 1 },
  select: { border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: '#fff' },
  content: { padding: 16, maxWidth: 1100, margin: '0 auto' },
  card: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 600, marginBottom: 12 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
  metric: { background: '#f5f5f5', borderRadius: 8, padding: 12, textAlign: 'center' },
  metricLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  metricVal: { fontSize: 18, fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: '#f5f5f5', padding: '7px 8px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#666', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { padding: '7px 8px', borderBottom: '0.5px solid #f0f0f0', verticalAlign: 'middle' },
  empty: { textAlign: 'center', color: '#888', padding: '20px 0', fontSize: 13 },
}
