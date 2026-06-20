import { useState, useEffect, useCallback } from 'react'
import { getCached, setCached, enqueue, flushQueue } from '../lib/offline'

const COMBOS = [
  ["1006015-1008009","ACM Blanco - Azul",240],
  ["1006015-1008008","ACM Blanco - Verde",40],
  ["1006015-1008011","ACM Blanco - Amarillo",66],
  ["1006015-1006042","ACM Blanco - Oak",81],
  ["1006015-1006017","ACM Blanco - Bronze",35],
  ["1008002-1006001","ACM Silver - Grafito",142],
  ["1008002-1008014","ACM Silver - Negro",336],
  ["1008002-1008030","ACM Silver - Brush",98],
  ["1008001-1008002","ACM Silver - Silver Mate",105],
  ["1008014-1006017","ACM Negro - Bronze",33],
  ["1008014-1008006","ACM Negro - Oro",95],
  ["1008014-1008009","ACM Negro - Azul",24],
  ["1008014-1008007","ACM Negro - Rojo",0],
  ["1008014-1008033","Black + Mirror",2],
  ["1006015-1006015","ACM Blanco - Blanco",26],
]
const COLORES = ["Blanco","Azul","Verde","Amarillo","Oak","Bronze","Silver","Grafito","Negro","Brush","Silver Mate","Oro","Rojo","Mirror"]
const TABS = ["Ventas","+ Nueva","Cobros","Stock","Despacho","Clientes","Socios"]

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-AR')
const hoy = () => new Date().toISOString().split('T')[0]
const sivaDe = v => (v.placas || 0) + (v.meca || 0)
const civaDe = v => sivaDe(v) * 1.21
const cobPara = (fac, cobros) => cobros.filter(c => c.fac === fac).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)

// ─── API helpers con soporte offline ─────────────────────────
async function apiGet(path, fallback = []) {
  try {
    const r = await fetch(path)
    if (!r.ok) throw new Error()
    const data = await r.json()
    setCached(path, data)
    return data
  } catch {
    return getCached(path) || fallback
  }
}

async function apiPost(path, body, optimistic) {
  // Guardamos optimistamente en cache primero
  const current = getCached(path) || []
  const item = { ...body, id: body.id || Date.now().toString() }
  if (optimistic) {
    setCached(path, [...current, item])
  }
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
    const saved = await r.json()
    return saved
  } catch {
    enqueue({ url: path, method: 'POST', body: item })
    return item
  }
}

async function apiDelete(path, id, cacheKey) {
  const current = getCached(cacheKey) || []
  setCached(cacheKey, current.filter(i => i.id !== id))
  try {
    await fetch(`${path}?id=${id}`, { method: 'DELETE' })
  } catch {
    enqueue({ url: `${path}?id=${id}`, method: 'DELETE' })
  }
}

async function apiPut(path, id, body, cacheKey) {
  const current = getCached(cacheKey) || []
  setCached(cacheKey, current.map(i => i.id === id ? { ...i, ...body } : i))
  try {
    await fetch(`${path}?id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    enqueue({ url: `${path}?id=${id}`, method: 'PUT', body })
  }
}

// ─── APP ROOT ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState(0)
  const [ventas, setVentas] = useState([])
  const [cobros, setCobros] = useState([])
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setSyncing(true)
    const [v, c] = await Promise.all([
      apiGet('/api/ventas'),
      apiGet('/api/cobros'),
    ])
    setVentas(v); setCobros(c)
    setSyncing(false)
  }, [])

  useEffect(() => {
    load()
    const onOnline = () => { setOnline(true); load() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOnline(navigator.onLine)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [load])

  const addVenta = async v => {
    const nueva = await apiPost('/api/ventas', v, true)
    setVentas(prev => {
      const exists = prev.find(x => x.id === nueva.id)
      return exists ? prev : [...prev, nueva]
    })
    setTab(0)
  }

  const deleteVenta = async id => {
    if (!confirm('¿Borrar esta venta?')) return
    await apiDelete('/api/ventas', id, '/api/ventas')
    setVentas(prev => prev.filter(v => v.id !== id))
  }

  const updateVenta = async (id, changes) => {
    await apiPut('/api/ventas', id, changes, '/api/ventas')
    setVentas(prev => prev.map(v => v.id === id ? { ...v, ...changes } : v))
  }

  const addCobro = async c => {
    const nuevo = await apiPost('/api/cobros', c, true)
    setCobros(prev => {
      const exists = prev.find(x => x.id === nuevo.id)
      return exists ? prev : [...prev, nuevo]
    })
  }

  const deleteCobro = async id => {
    if (!confirm('¿Borrar este cobro?')) return
    await apiDelete('/api/cobros', id, '/api/cobros')
    setCobros(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>ALUCOWORLD</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {syncing && <span style={S.syncBadge}>⟳ sincronizando</span>}
          <span style={{ ...S.statusDot, background: online ? '#4ade80' : '#f87171' }} title={online ? 'Online' : 'Offline'} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{online ? 'online' : 'offline'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ ...S.tab, ...(tab === i ? S.tabActive : {}) }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        {tab === 0 && <TabVentas ventas={ventas} cobros={cobros} onDelete={deleteVenta} />}
        {tab === 1 && <TabNueva onSave={addVenta} onCancel={() => setTab(0)} />}
        {tab === 2 && <TabCobros cobros={cobros} ventas={ventas} onAdd={addCobro} onDelete={deleteCobro} />}
        {tab === 3 && <TabStock ventas={ventas} />}
        {tab === 4 && <TabDespacho ventas={ventas} />}
        {tab === 5 && <TabClientes ventas={ventas} cobros={cobros} />}
        {tab === 6 && <TabSocios ventas={ventas} onUpdate={updateVenta} />}
      </div>
    </div>
  )
}

// ─── VENTAS ───────────────────────────────────────────────────
function TabVentas({ ventas, cobros, onDelete }) {
  const tS = ventas.reduce((s, v) => s + sivaDe(v), 0)
  const tC = ventas.reduce((s, v) => s + civaDe(v), 0)
  const tCob = cobros.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0)
  const tSaldo = tC - tCob
  return (
    <div>
      <div style={S.metrics}>
        {[['Total s/IVA', fmt(tS)], ['Total c/IVA', fmt(tC)], ['Cobrado', fmt(tCob)],
          ['Saldo pendiente', fmt(tSaldo), tSaldo > 0 ? '#A32D2D' : '#3B6D11']
        ].map(([l, v, c]) => (
          <div key={l} style={S.metric}>
            <div style={S.metricLabel}>{l}</div>
            <div style={{ ...S.metricVal, ...(c ? { color: c } : {}) }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            {['N° FAC','FECHA','CLIENTE','MODALIDAD','ESTADO','S/IVA','IVA 21%','C/IVA','COBRADO','SALDO',''].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {!ventas.length && <tr><td colSpan={11} style={S.empty}>Sin ventas. Usá + Nueva.</td></tr>}
            {ventas.map((v, i) => {
              const s = sivaDe(v), c = civaDe(v), cob = cobPara(v.fac, cobros), saldo = c - cob
              return (
                <tr key={v.id} style={i % 2 ? { background: '#fafafa' } : {}}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{v.fac}</td>
                  <td style={S.td}>{v.fecha}</td>
                  <td style={S.td}>{v.cliente}</td>
                  <td style={S.td}><MBadge m={v.modal} /></td>
                  <td style={S.td}><EBadge e={v.estado} /></td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{fmt(s)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#854F0B' }}>{fmt(s * .21)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmt(c)}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{fmt(cob)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: Math.abs(saldo) < 1 ? '#3B6D11' : saldo > 0 ? '#A32D2D' : '#854F0B' }}>{fmt(saldo)}</td>
                  <td style={S.td}><button style={S.btnDanger} onClick={() => onDelete(v.id)}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── NUEVA VENTA ──────────────────────────────────────────────
function TabNueva({ onSave, onCancel }) {
  const [f, sf] = useState({ fac: '', fecha: hoy(), cliente: '', modal: '', estado: 'COBRADO', entrega: '', obs: '' })
  const [lineas, setLineas] = useState([{ combo: '', cant: '', color: '' }])
  const [p, sp] = useState({ uni: '', cos: '', mec: '', alf: '', obra: '', mat: '', mo: '' })
  const set = (k, v) => sf(x => ({ ...x, [k]: v }))
  const setP = (k, v) => sp(x => ({ ...x, [k]: v }))
  const updL = (i, k, v) => setLineas(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l))

  const cant = lineas.reduce((s, l) => s + (parseFloat(l.cant) || 0), 0)
  let base = 0, gan = 0
  if (f.modal === 'PLACAS' || f.modal === 'PLACAS + MECANIZADO') {
    base = (parseFloat(p.uni) || 0) * cant + (parseFloat(p.mec) || 0)
    gan = ((parseFloat(p.uni) || 0) - (parseFloat(p.cos) || 0)) * cant + ((parseFloat(p.mec) || 0) - (parseFloat(p.alf) || 0))
  }
  if (f.modal === 'OBRA ALEJANDRO') { base = parseFloat(p.obra) || 0; gan = base - (parseFloat(p.mat) || 0) - (parseFloat(p.mo) || 0) }
  if (f.modal === 'OBRA AGUSTIN') { base = parseFloat(p.obra) || 0; gan = (base - (parseFloat(p.mat) || 0)) * 0.5 }

  const handleSave = () => {
    if (!f.fac || !f.cliente || !f.modal) return alert('Completá N° factura, cliente y modalidad')
    const ls = lineas.filter(l => l.combo && parseFloat(l.cant) > 0).map(l => ({ ...l, desc: COMBOS.find(c => c[0] === l.combo)?.[1] || '' }))
    let placas = 0, meca = 0, costo = 0, alfredo = 0, moAlej = 0
    if (f.modal === 'PLACAS' || f.modal === 'PLACAS + MECANIZADO') { placas = (parseFloat(p.uni) || 0) * cant; costo = (parseFloat(p.cos) || 0) * cant }
    if (f.modal === 'PLACAS + MECANIZADO') { meca = parseFloat(p.mec) || 0; alfredo = parseFloat(p.alf) || 0 }
    if (f.modal === 'OBRA ALEJANDRO' || f.modal === 'OBRA AGUSTIN') { placas = parseFloat(p.obra) || 0; costo = parseFloat(p.mat) || 0 }
    if (f.modal === 'OBRA ALEJANDRO') moAlej = parseFloat(p.mo) || 0
    onSave({ ...f, placas, meca, costo, alfredo, moAlej, lineas: ls, pagadoSocio: 'PENDIENTE' })
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Datos de la factura</div>
      <div style={S.formRow}>
        <FG l="N° Factura"><input style={S.input} value={f.fac} onChange={e => set('fac', e.target.value)} placeholder="00001-00000123" /></FG>
        <FG l="Fecha"><input type="date" style={S.input} value={f.fecha} onChange={e => set('fecha', e.target.value)} /></FG>
        <FG l="Cliente"><input style={S.input} value={f.cliente} onChange={e => set('cliente', e.target.value)} /></FG>
        <FG l="Modalidad">
          <select style={S.input} value={f.modal} onChange={e => set('modal', e.target.value)}>
            <option value="">— elegir —</option>
            <option value="PLACAS">Placas</option>
            <option value="PLACAS + MECANIZADO">Placas + Mecanizado (Alfredo)</option>
            <option value="OBRA ALEJANDRO">Obra — Alejandro</option>
            <option value="OBRA AGUSTIN">Obra — Agustín</option>
          </select>
        </FG>
        <FG l="Estado">
          <select style={S.input} value={f.estado} onChange={e => set('estado', e.target.value)}>
            <option value="COBRADO">Cobrado</option>
            <option value="ENTREGADO">Entregado</option>
            <option value="COBRADO+ENTREGADO">Cobrado + Entregado</option>
          </select>
        </FG>
        <FG l="Fecha entrega"><input type="date" style={S.input} value={f.entrega} onChange={e => set('entrega', e.target.value)} /></FG>
      </div>

      <div style={S.sep} />
      <div style={S.cardTitle}>Líneas de producto</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr auto', gap: 8, fontSize: 11, color: '#888', marginBottom: 6 }}>
        <span>Combo color</span><span>Cant.</span><span>Color vendido</span><span></span>
      </div>
      {lineas.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr auto', gap: 8, marginBottom: 6 }}>
          <select style={S.input} value={l.combo} onChange={e => updL(i, 'combo', e.target.value)}>
            <option value="">— combo —</option>
            {COMBOS.map(c => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
          </select>
          <input type="number" style={S.input} value={l.cant} onChange={e => updL(i, 'cant', e.target.value)} placeholder="0" />
          <select style={S.input} value={l.color} onChange={e => updL(i, 'color', e.target.value)}>
            <option value="">— color —</option>
            {COLORES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button style={S.btnDanger} onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button style={S.btnSm} onClick={() => setLineas(ls => [...ls, { combo: '', cant: '', color: '' }])}>+ Agregar color</button>

      {f.modal && <>
        <div style={S.sep} />
        <div style={S.cardTitle}>Precios</div>
        {(f.modal === 'PLACAS' || f.modal === 'PLACAS + MECANIZADO') && (
          <div style={S.formRow}>
            <FG l="Precio unitario s/IVA"><input type="number" style={S.input} value={p.uni} onChange={e => setP('uni', e.target.value)} placeholder="0" /></FG>
            <FG l="Costo unitario"><input type="number" style={S.input} value={p.cos} onChange={e => setP('cos', e.target.value)} placeholder="0" /></FG>
          </div>
        )}
        {f.modal === 'PLACAS + MECANIZADO' && (
          <div style={S.formRow}>
            <FG l="$ Mecanizado al cliente"><input type="number" style={S.input} value={p.mec} onChange={e => setP('mec', e.target.value)} placeholder="0" /></FG>
            <FG l="$ Pagado a Alfredo"><input type="number" style={S.input} value={p.alf} onChange={e => setP('alf', e.target.value)} placeholder="0" /></FG>
          </div>
        )}
        {(f.modal === 'OBRA ALEJANDRO' || f.modal === 'OBRA AGUSTIN') && (
          <div style={S.formRow}>
            <FG l="$ Total obra s/IVA"><input type="number" style={S.input} value={p.obra} onChange={e => setP('obra', e.target.value)} placeholder="0" /></FG>
            <FG l="$ Costo materiales"><input type="number" style={S.input} value={p.mat} onChange={e => setP('mat', e.target.value)} placeholder="0" /></FG>
            {f.modal === 'OBRA ALEJANDRO' && <FG l="$ M.O. Alejandro"><input type="number" style={S.input} value={p.mo} onChange={e => setP('mo', e.target.value)} placeholder="0" /></FG>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, background: '#f5f5f5', borderRadius: 8, padding: 12, marginTop: 8 }}>
          {[['Total s/IVA', fmt(base)], ['IVA 21%', fmt(base * .21), '#854F0B'], ['Total c/IVA', fmt(base * 1.21)], ['Ganancia neta', fmt(gan), gan >= 0 ? '#3B6D11' : '#A32D2D']].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888' }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c || 'inherit' }}>{v}</div>
            </div>
          ))}
        </div>
      </>}

      <div style={S.sep} />
      <FG l="Observaciones"><input style={S.input} value={f.obs} onChange={e => set('obs', e.target.value)} placeholder="Opcional" /></FG>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button style={S.btn} onClick={onCancel}>Cancelar</button>
        <button style={S.btnPrimary} onClick={handleSave}>Guardar venta</button>
      </div>
    </div>
  )
}

// ─── COBROS ───────────────────────────────────────────────────
function TabCobros({ cobros, ventas, onAdd, onDelete }) {
  const [f, sf] = useState({ fac: '', fecha: hoy(), monto: '', tipo: 'ADELANTO', medio: 'TRANSFERENCIA' })
  const set = (k, v) => sf(x => ({ ...x, [k]: v }))
  const clienteAuto = ventas.find(v => v.fac === f.fac)?.cliente || ''
  const handleAdd = () => {
    if (!f.fac || !f.monto) return alert('Completá N° factura y monto')
    onAdd({ ...f, cliente: clienteAuto })
    sf({ fac: '', fecha: hoy(), monto: '', tipo: 'ADELANTO', medio: 'TRANSFERENCIA' })
  }
  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>Registrar cobro</div>
        <div style={S.formRow}>
          <FG l="N° Factura"><input style={S.input} value={f.fac} onChange={e => set('fac', e.target.value)} /></FG>
          <FG l="Cliente (auto)"><input style={{ ...S.input, color: '#888' }} value={clienteAuto} readOnly /></FG>
          <FG l="Fecha"><input type="date" style={S.input} value={f.fecha} onChange={e => set('fecha', e.target.value)} /></FG>
          <FG l="Monto"><input type="number" style={S.input} value={f.monto} onChange={e => set('monto', e.target.value)} placeholder="0" /></FG>
          <FG l="Tipo"><select style={S.input} value={f.tipo} onChange={e => set('tipo', e.target.value)}><option>ADELANTO</option><option>PARCIAL</option><option>SALDO FINAL</option></select></FG>
          <FG l="Medio"><select style={S.input} value={f.medio} onChange={e => set('medio', e.target.value)}><option>TRANSFERENCIA</option><option>EFECTIVO</option><option>CHEQUE</option><option>OTRO</option></select></FG>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button style={S.btnPrimary} onClick={handleAdd}>Registrar cobro</button></div>
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>{['FECHA','N° FAC','CLIENTE','MONTO','TIPO','MEDIO',''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {!cobros.length && <tr><td colSpan={7} style={S.empty}>Sin cobros.</td></tr>}
            {cobros.map((c, i) => (
              <tr key={c.id} style={i % 2 ? { background: '#fafafa' } : {}}>
                <td style={S.td}>{c.fecha}</td><td style={S.td}>{c.fac}</td><td style={S.td}>{c.cliente}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmt(c.monto)}</td>
                <td style={S.td}><span style={S.badgeWarn}>{c.tipo}</span></td>
                <td style={S.td}>{c.medio}</td>
                <td style={S.td}><button style={S.btnDanger} onClick={() => onDelete(c.id)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── STOCK ────────────────────────────────────────────────────
function TabStock({ ventas }) {
  const eg = {}
  COMBOS.forEach(c => eg[c[0]] = 0)
  ventas.forEach(v => v.lineas?.forEach(l => { if (l.combo) eg[l.combo] = (eg[l.combo] || 0) + (parseFloat(l.cant) || 0) }))
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{['CÓDIGO','DESCRIPCIÓN','INICIAL','EGRESOS','ACTUAL',''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {COMBOS.map((c, i) => {
            const actual = c[2] - (eg[c[0]] || 0)
            return (
              <tr key={c[0]} style={i % 2 ? { background: '#fafafa' } : {}}>
                <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{c[0]}</td>
                <td style={S.td}>{c[1]}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{c[2]}</td>
                <td style={{ ...S.td, textAlign: 'right', color: '#A32D2D' }}>{eg[c[0]] || 0}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{actual}</td>
                <td style={S.td}>{actual < 20 && <span style={{ color: '#A32D2D', fontWeight: 600 }}>⚠ bajo</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── DESPACHO ─────────────────────────────────────────────────
function TabDespacho({ ventas }) {
  const [fecha, setFecha] = useState(hoy())
  const egTotal = {}; COMBOS.forEach(c => egTotal[c[0]] = 0)
  ventas.forEach(v => v.lineas?.forEach(l => { if (l.combo) egTotal[l.combo] = (egTotal[l.combo] || 0) + (parseFloat(l.cant) || 0) }))
  const egDia = {}; COMBOS.forEach(c => egDia[c[0]] = 0)
  ventas.filter(v => v.entrega === fecha).forEach(v => v.lineas?.forEach(l => { if (l.combo) egDia[l.combo] = (egDia[l.combo] || 0) + (parseFloat(l.cant) || 0) }))
  const totalDia = Object.values(egDia).reduce((s, n) => s + n, 0)
  const totalStock = COMBOS.reduce((s, c) => s + (c[2] - (egTotal[c[0]] || 0)), 0)
  const fechaFmt = fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

  const copiar = () => {
    const salidas = COMBOS.filter(c => egDia[c[0]] > 0)
    if (!salidas.length) return alert('No hay egresos para esta fecha.')
    let txt = `📦 DESPACHO ALUCOWORLD\n${fechaFmt}\n${'─'.repeat(32)}\n`
    salidas.forEach(c => { txt += `• ${c[1]}: -${egDia[c[0]]} placas (stock: ${c[2] - (egTotal[c[0]] || 0)})\n` })
    txt += `${'─'.repeat(32)}\nTotal: ${totalDia} placas`
    navigator.clipboard.writeText(txt).then(() => alert('Copiado. Pegalo en WhatsApp.')).catch(() => alert(txt))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="date" style={{ ...S.input, width: 180 }} value={fecha} onChange={e => setFecha(e.target.value)} />
        <button style={S.btnPrimary} onClick={copiar}>Copiar para WhatsApp</button>
      </div>
      <div style={{ background: '#1F3864', color: '#fff', padding: '12px 16px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>ALUCOWORLD — STOCK Y EGRESO DEL DÍA</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, textTransform: 'capitalize' }}>{fechaFmt}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Despachadas hoy</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: totalDia > 0 ? '#ffcc44' : '#aaa' }}>{totalDia}</div>
        </div>
      </div>
      <div style={S.tableWrap}>
        <table style={{ ...S.table, borderTop: 'none' }}>
          <thead><tr>
            <th style={S.th}>CÓDIGO</th><th style={S.th}>DESCRIPCIÓN</th>
            <th style={{ ...S.th, textAlign: 'center' }}>STOCK ACTUAL</th>
            <th style={{ ...S.th, textAlign: 'center', background: '#C00000', color: '#fff' }}>EGRESO {fecha?.split('-').reverse().join('/')}</th>
          </tr></thead>
          <tbody>
            {COMBOS.map((c, i) => {
              const actual = c[2] - (egTotal[c[0]] || 0), sal = egDia[c[0]] || 0
              return (
                <tr key={c[0]} style={i % 2 ? { background: '#f5f7fa' } : {}}>
                  <td style={{ ...S.td, fontSize: 11, color: '#555' }}>{c[0]}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{c[1]}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#1F3864' }}>{actual}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: sal > 0 ? '#C00000' : '#ccc', background: sal > 0 ? '#fff0f0' : 'inherit' }}>{sal > 0 ? `-${sal}` : '—'}</td>
                </tr>
              )
            })}
            <tr style={{ background: '#1F3864' }}>
              <td colSpan={2} style={{ ...S.td, color: '#fff', fontWeight: 700 }}>STOCK TOTAL</td>
              <td style={{ ...S.td, textAlign: 'center', color: '#fff', fontWeight: 700 }}>{totalStock}</td>
              <td style={{ ...S.td, textAlign: 'center', color: '#fff', fontWeight: 700 }}>{totalDia > 0 ? `-${totalDia}` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── CLIENTES ─────────────────────────────────────────────────
function TabClientes({ ventas, cobros }) {
  const mapa = {}
  ventas.forEach(v => { if (!mapa[v.cliente]) mapa[v.cliente] = { civa: 0, cob: 0 }; mapa[v.cliente].civa += civaDe(v) })
  cobros.forEach(c => { if (c.cliente && mapa[c.cliente]) mapa[c.cliente].cob += parseFloat(c.monto) || 0 })
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{['CLIENTE','S/IVA','C/IVA','COBRADO','SALDO','ESTADO'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {!Object.keys(mapa).length && <tr><td colSpan={6} style={S.empty}>Sin clientes.</td></tr>}
          {Object.entries(mapa).map(([n, d], i) => {
            const saldo = d.civa - d.cob, ok = Math.abs(saldo) < 1
            return (
              <tr key={n} style={i % 2 ? { background: '#fafafa' } : {}}>
                <td style={{ ...S.td, fontWeight: 600 }}>{n}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{fmt(d.civa / 1.21)}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{fmt(d.civa)}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{fmt(d.cob)}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: ok ? '#3B6D11' : saldo > 0 ? '#A32D2D' : '#854F0B' }}>{fmt(saldo)}</td>
                <td style={S.td}>{ok ? <span style={S.badgeOk}>Al día</span> : saldo > 0 ? <span style={S.badgeDanger}>Debe {fmt(saldo)}</span> : <span style={S.badgeWarn}>A favor</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── SOCIOS ───────────────────────────────────────────────────
function TabSocios({ ventas, onUpdate }) {
  const grupos = [
    { modal: 'OBRA ALEJANDRO', titulo: 'Alejandro', color: '#3C3489', gan: v => v.placas - v.costo - v.moAlej },
    { modal: 'OBRA AGUSTIN', titulo: 'Agustín', color: '#3C3489', gan: v => (v.placas - v.costo) * 0.5 },
    { modal: 'PLACAS + MECANIZADO', titulo: 'Alfredo (mecanizado)', color: '#27500A', gan: v => v.meca - v.alfredo },
  ]
  const ciclo = ['PENDIENTE', 'PARCIAL', 'PAGADO']
  return (
    <div>
      {grupos.map(g => {
        const lista = ventas.filter(v => v.modal === g.modal)
        const pend = lista.filter(v => v.pagadoSocio !== 'PAGADO').reduce((s, v) => s + g.gan(v), 0)
        const pag = lista.filter(v => v.pagadoSocio === 'PAGADO').reduce((s, v) => s + g.gan(v), 0)
        return (
          <div key={g.modal} style={S.socioCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: g.color }}>{g.titulo}</div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                <span style={{ color: '#888' }}>Pendiente: <strong style={{ color: '#A32D2D' }}>{fmt(pend)}</strong></span>
                <span style={{ color: '#888' }}>Pagado: <strong style={{ color: '#3B6D11' }}>{fmt(pag)}</strong></span>
              </div>
            </div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead><tr>{['N° FAC','FECHA','CLIENTE','LES CORRESPONDE','ESTADO PAGO',''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {!lista.length && <tr><td colSpan={6} style={S.empty}>Sin trabajos.</td></tr>}
                  {lista.map((v, i) => {
                    const est = v.pagadoSocio || 'PENDIENTE'
                    const badge = est === 'PAGADO' ? S.badgeOk : est === 'PARCIAL' ? S.badgeWarn : S.badgeDanger
                    return (
                      <tr key={v.id} style={i % 2 ? { background: '#fafafa' } : {}}>
                        <td style={{ ...S.td, fontWeight: 600 }}>{v.fac}</td>
                        <td style={S.td}>{v.fecha}</td>
                        <td style={S.td}>{v.cliente}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: g.color }}>{fmt(g.gan(v))}</td>
                        <td style={S.td}><span style={badge}>{est}</span></td>
                        <td style={S.td}><button style={S.btnSm} onClick={() => onUpdate(v.id, { pagadoSocio: ciclo[(ciclo.indexOf(est) + 1) % 3] })}>↻ Cambiar</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────
function FG({ l, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 12, color: '#888' }}>{l}</label>{children}</div>
}
function MBadge({ m }) {
  const map = { 'PLACAS': ['#E6F1FB','#0C447C','Placas'], 'PLACAS + MECANIZADO': ['#EAF3DE','#27500A','Placa+Meca'], 'OBRA ALEJANDRO': ['#EEEDFE','#3C3489','Alejandro'], 'OBRA AGUSTIN': ['#FAECE7','#712B13','Agustín'] }
  const [bg, color, label] = map[m] || ['#eee','#333',m]
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{label}</span>
}
function EBadge({ e }) {
  const map = { 'COBRADO': ['#EAF3DE','#27500A'], 'ENTREGADO': ['#E6F1FB','#0C447C'], 'COBRADO+ENTREGADO': ['#EEEDFE','#3C3489'] }
  const [bg, color] = map[e] || ['#eee','#333']
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{e}</span>
}

// ─── ESTILOS ──────────────────────────────────────────────────
const S = {
  app: { fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 1100, margin: '0 auto', paddingBottom: 40, minHeight: '100vh', background: '#f9fafb' },
  header: { background: '#171D80', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 },
  headerTitle: { fontWeight: 700, fontSize: 16, letterSpacing: 1 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  syncBadge: { fontSize: 11, color: 'rgba(255,255,255,0.7)', animation: 'none' },
  tabs: { display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', background: '#fff', position: 'sticky', top: 48, zIndex: 99 },
  tab: { padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#666', borderBottom: '2px solid transparent', whiteSpace: 'nowrap', flexShrink: 0 },
  tabActive: { color: '#171D80', borderBottom: '2px solid #171D80', fontWeight: 600 },
  content: { padding: 16 },
  card: { background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 600, marginBottom: 12 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
  metric: { background: '#f5f5f5', borderRadius: 8, padding: 12, textAlign: 'center' },
  metricLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  metricVal: { fontSize: 18, fontWeight: 600 },
  tableWrap: { overflowX: 'auto', border: '0.5px solid #e5e7eb', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: '#f5f5f5', padding: '7px 8px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#666', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { padding: '7px 8px', borderBottom: '0.5px solid #f0f0f0', verticalAlign: 'middle' },
  empty: { textAlign: 'center', color: '#888', padding: 24 },
  formRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 12 },
  input: { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 10px', fontSize: 13, width: '100%', background: '#fff', color: '#111' },
  sep: { height: 1, background: '#e5e7eb', margin: '14px 0' },
  btn: { padding: '7px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 },
  btnPrimary: { padding: '7px 14px', border: 'none', borderRadius: 8, background: '#171D80', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSm: { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 },
  btnDanger: { padding: '4px 10px', border: '1px solid #E24B4A', borderRadius: 6, background: '#fff', color: '#E24B4A', cursor: 'pointer', fontSize: 12 },
  badgeOk: { background: '#EAF3DE', color: '#27500A', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 },
  badgeDanger: { background: '#FCEBEB', color: '#791F1F', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 },
  badgeWarn: { background: '#FAEEDA', color: '#633806', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 },
  socioCard: { border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 12 },
}
