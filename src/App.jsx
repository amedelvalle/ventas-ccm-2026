import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import {
  Upload, FileSpreadsheet, TrendingUp, Activity, Calendar, ChevronDown,
  Check, X, AlertCircle, Database, ArrowUpRight, ArrowDownRight, Layers,
  Clock, BarChart3, Users, Pill, Menu
} from 'lucide-react'
import {
  getUltimaCarga, getCargas, uploadData, getResumen,
  getIngresoPorArea, getIngresoPorDia, getDetalleArticulo,
  getComparativaAnios, getConsultasSubgrupo
} from './db'
import { parseExcel } from './parseExcel'

// ============================================================
// CONSTANTS
// ============================================================
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1']
const AREA_COLORS = {
  'LABORATORIO CLINICO': '#3b82f6',
  'LABORATORIO CARDIOVASCULAR': '#ef4444',
  'SERVICIOS MÉDICOS ': '#10b981',
  'BOTIQUIN': '#f59e0b',
  'LABORATORIO DE IMAGENES': '#8b5cf6',
}

// ============================================================
// HELPERS
// ============================================================
const fmt = (n) => n == null ? '-' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = (n) => {
  if (n == null) return '-'
  if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return fmt(n)
}
const fmtN = (n) => n == null ? '-' : Number(n).toLocaleString('en-US')
const pctChange = (cur, prev) => prev ? ((cur - prev) / Math.abs(prev) * 100) : null

// ============================================================
// REUSABLE COMPONENTS
// ============================================================
function KPICard({ label, value, sub, trend, icon: Icon, delay = 0 }) {
  const isPos = trend > 0
  return (
    <div className="animate-in" style={{
      background: 'var(--card)', borderRadius: 14, padding: '22px 24px',
      border: '1px solid var(--border)', animationDelay: `${delay}ms`,
      transition: 'border-color 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {Icon && <div style={{ padding: 6, borderRadius: 8, background: 'var(--accent-dim)' }}><Icon size={14} style={{ color: 'var(--accent)' }} /></div>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 8 }}>{value}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {trend != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600,
            color: isPos ? 'var(--success)' : 'var(--danger)',
            background: isPos ? 'var(--success-dim)' : 'var(--danger-dim)',
            padding: '3px 8px', borderRadius: 20,
          }}>
            {isPos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function Select({ value, onChange, options, label, width = 170 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const selected = options.find(o => (typeof o === 'object' ? o.value : o) === value)
  const displayLabel = typeof selected === 'object' ? selected.label : selected
  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      {label && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>}
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '9px 12px', background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 9, cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel || '...'}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--muted)' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.3)', zIndex: 50, maxHeight: 260, overflowY: 'auto',
        }}>
          {options.map((o, i) => {
            const val = typeof o === 'object' ? o.value : o
            const lab = typeof o === 'object' ? o.label : o
            const active = val === value
            return (
              <div key={i} onClick={() => { onChange(val); setOpen(false) }}
                style={{
                  padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                  color: active ? 'var(--accent)' : 'var(--text)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!active) e.target.style.background = 'var(--card-hover)' }}
                onMouseLeave={e => { if (!active) e.target.style.background = active ? 'var(--accent-dim)' : 'transparent' }}
              >
                <span>{lab}</span>{active && <Check size={13} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, subtitle, children, delay = 0 }) {
  return (
    <div className="animate-in" style={{
      background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)',
      padding: 24, animationDelay: `${delay}ms`,
    }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  },
}

// ============================================================
// UPLOAD COMPONENTS
// ============================================================
function UploadZone({ onUpload, isLoading }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-light)'}`,
        borderRadius: 16, padding: '56px 32px', textAlign: 'center',
        cursor: isLoading ? 'wait' : 'pointer',
        background: dragOver ? 'var(--accent-dim)' : 'transparent',
        transition: 'all 0.25s',
      }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
        onChange={e => onUpload(e.target.files[0])} />
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Procesando y subiendo a Supabase...</span>
        </div>
      ) : (
        <>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Upload size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Arrastrá tu archivo Excel acá</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>o hacé clic para seleccionar · .xlsx, .xls, .csv</div>
        </>
      )}
    </div>
  )
}

function UploadResult({ result, onClose }) {
  if (!result) return null
  const isError = result.error
  return (
    <div style={{
      background: isError ? 'var(--danger-dim)' : 'var(--success-dim)',
      border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
      borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16,
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        {isError ? <AlertCircle size={20} color="var(--danger)" /> : <Check size={20} color="var(--success)" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: isError ? 'var(--danger)' : 'var(--success)', marginBottom: 4 }}>
          {isError ? 'Error al procesar' : 'Carga exitosa'}
        </div>
        {isError ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.error}</div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>{fmtN(result.totalRows)}</strong> filas en archivo · <strong style={{ color: 'var(--success)' }}>{fmtN(result.newRows)}</strong> nuevas · <strong>{fmtN(result.dupRows)}</strong> duplicadas (ignoradas)
            <br />Rango: {result.fechaInicio} → {result.fechaFin}
          </div>
        )}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
        <X size={16} color="var(--muted)" />
      </button>
    </div>
  )
}

// ============================================================
// TABS
// ============================================================
const TABS = [
  { id: 'overview', label: 'Resumen', icon: Activity },
  { id: 'areas', label: 'Por Área', icon: Layers },
  { id: 'daily', label: 'Diario', icon: Calendar },
  { id: 'articles', label: 'Artículos', icon: FileSpreadsheet },
  { id: 'compare', label: 'Comparativo', icon: BarChart3 },
  { id: 'upload', label: 'Cargar Datos', icon: Upload },
]

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [tab, setTab] = useState('overview')
  const [filterYear, setFilterYear] = useState(null)
  const [filterMonth, setFilterMonth] = useState(null)
  const [filterTipo, setFilterTipo] = useState('Todos')
  const [uploadResult, setUploadResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  // Data states
  const [ultimaCarga, setUltimaCarga] = useState(null)
  const [cargasHist, setCargasHist] = useState([])
  const [resumen, setResumen] = useState([])
  const [areaData, setAreaData] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [articlesData, setArticlesData] = useState([])
  const [compareData, setCompareData] = useState([])
  const [loading, setLoading] = useState(true)

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true)
      const uc = await getUltimaCarga()
      setUltimaCarga(uc)
      const res = await getResumen()
      setResumen(res)
      if (res.length > 0) {
        const years = [...new Set(res.map(r => r.anio))].sort()
        setFilterYear(String(years[years.length - 1]))
      } else {
        setTab('upload')
      }
      const c = await getCargas()
      setCargasHist(c)
      setLoading(false)
    })()
  }, [])

  // Reload data when filters change
  useEffect(() => {
    if (!filterYear) return
    const load = async () => {
      const [area, daily, articles, compare] = await Promise.all([
        getIngresoPorArea(Number(filterYear), filterMonth),
        getIngresoPorDia(Number(filterYear), filterMonth),
        getDetalleArticulo(Number(filterYear), filterMonth, filterTipo),
        getComparativaAnios(filterYear, filterTipo),
      ])
      setAreaData(area)
      setDailyData(daily)
      setArticlesData(articles)
      setCompareData(compare)
    }
    load()
  }, [filterYear, filterMonth, filterTipo])

  const years = useMemo(() => {
    const y = [...new Set(resumen.map(r => String(r.anio)))].sort()
    return y
  }, [resumen])

  const tipos = useMemo(() => {
    const t = [...new Set(areaData.map(r => r.tipo_inventario))]
    return ['Todos', ...t]
  }, [areaData])

  const handleUpload = useCallback(async (file) => {
    if (!file) return
    setIsLoading(true)
    setUploadResult(null)
    try {
      const rows = await parseExcel(file)
      if (!rows.length) throw new Error('No se encontraron datos válidos en el archivo')
      const result = await uploadData(rows, file.name)
      setUploadResult(result)
      // Refresh all data
      const [uc, res, c] = await Promise.all([getUltimaCarga(), getResumen(), getCargas()])
      setUltimaCarga(uc)
      setResumen(res)
      setCargasHist(c)
      if (res.length > 0 && !filterYear) {
        const yrs = [...new Set(res.map(r => r.anio))].sort()
        setFilterYear(String(yrs[yrs.length - 1]))
      }
      if (result.newRows > 0) setTab('overview')
    } catch (err) {
      setUploadResult({ error: err.message })
    } finally {
      setIsLoading(false)
    }
  }, [filterYear])

  const hasData = resumen.length > 0

  // ===== OVERVIEW CALCULATIONS =====
  const overviewMetrics = useMemo(() => {
    if (!resumen.length || !filterYear) return null
    let filtered = resumen.filter(r => String(r.anio) === filterYear)
    if (filterMonth != null) filtered = filtered.filter(r => r.mes === filterMonth + 1)

    const totalNeto = filtered.reduce((s, r) => s + Number(r.total_neto), 0)
    const totalBruto = filtered.reduce((s, r) => s + Number(r.total_bruto), 0)
    const totalCant = filtered.reduce((s, r) => s + Number(r.total_cantidad), 0)
    const dias = filtered.reduce((s, r) => s + Number(r.dias_operacion), 0)
    const promDiario = dias ? totalNeto / dias : 0

    // YoY
    const prevYear = String(Number(filterYear) - 1)
    let prev = resumen.filter(r => String(r.anio) === prevYear)
    if (filterMonth != null) prev = prev.filter(r => r.mes === filterMonth + 1)
    const prevNeto = prev.reduce((s, r) => s + Number(r.total_neto), 0)
    const trend = prevNeto ? pctChange(totalNeto, prevNeto) : null

    // Monthly chart
    const monthly = filtered.map(r => ({
      mes: MESES_SHORT[r.mes - 1],
      neto: Number(r.total_neto),
      cantidad: Number(r.total_cantidad),
    }))

    return { totalNeto, totalBruto, totalCant, dias, promDiario, trend, monthly }
  }, [resumen, filterYear, filterMonth])

  // ===== AREA PIE =====
  const areaPie = useMemo(() => {
    const byTipo = {}
    areaData.forEach(r => {
      if (!byTipo[r.tipo_inventario]) byTipo[r.tipo_inventario] = { name: r.tipo_inventario, value: 0 }
      byTipo[r.tipo_inventario].value += Number(r.total_neto)
    })
    return Object.values(byTipo).sort((a, b) => b.value - a.value)
  }, [areaData])

  // ===== AREA BAR CHART =====
  const areaBarChart = useMemo(() => {
    const allTipos = [...new Set(areaData.map(r => r.tipo_inventario))]
    const byMonth = {}
    areaData.forEach(r => {
      if (!byMonth[r.mes]) byMonth[r.mes] = { mes: MESES_SHORT[r.mes - 1] }
      byMonth[r.mes][r.tipo_inventario] = Number(r.total_neto)
    })
    return { data: Object.entries(byMonth).sort(([a], [b]) => a - b).map(([, v]) => v), tipos: allTipos }
  }, [areaData])

  // ===== DAILY CHART =====
  const dailyChart = useMemo(() => {
    return dailyData.map(r => ({
      dia: r.dia,
      neto: Number(r.total_neto),
      cantidad: Number(r.total_cantidad),
    }))
  }, [dailyData])

  // ===== COMPARE CHART =====
  const compareChart = useMemo(() => {
    if (!filterYear) return []
    const curYear = filterYear
    const prevYear = String(Number(filterYear) - 1)
    const byMonth = {}
    compareData.forEach(r => {
      if (!byMonth[r.mes]) byMonth[r.mes] = { mes: MESES_SHORT[r.mes - 1] }
      byMonth[r.mes][String(r.anio)] = (byMonth[r.mes][String(r.anio)] || 0) + Number(r.total_neto)
    })
    return { data: Object.entries(byMonth).sort(([a], [b]) => a - b).map(([, v]) => v), curYear, prevYear }
  }, [compareData, filterYear])

  // ===== ARTICLES TABLE =====
  const articlesTable = useMemo(() => {
    const total = articlesData.reduce((s, r) => s + Number(r.total_neto), 0)
    let acum = 0
    return articlesData.slice(0, 30).map(r => {
      acum += Number(r.total_neto)
      return { ...r, pctAcum: total ? (acum / total * 100) : 0 }
    })
  }, [articlesData])

  // ===== RENDER CONTENT =====
  const renderContent = () => {
    if (tab === 'upload') {
      return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Cargar datos</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Subí tu archivo Excel con el formato estándar de ventas. El sistema detecta y descarta automáticamente filas duplicadas.
            </p>
          </div>
          {ultimaCarga?.ultima_fecha && (
            <div style={{
              background: 'var(--accent-dim)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 12, padding: '14px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Database size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                Datos cargados hasta: <strong>{ultimaCarga.ultima_fecha}</strong> · {fmtN(ultimaCarga.total_registros)} registros
              </span>
            </div>
          )}
          <UploadResult result={uploadResult} onClose={() => setUploadResult(null)} />
          <UploadZone onUpload={handleUpload} isLoading={isLoading} />
          {cargasHist.length > 0 && (
            <div style={{ marginTop: 36 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Clock size={14} /> Historial de cargas
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cargasHist.slice(0, 10).map((c, i) => (
                  <div key={i} style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 18px', fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.nombre_archivo}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {c.fecha_inicio} → {c.fecha_fin} · <span style={{ color: 'var(--success)' }}>{fmtN(c.filas_nuevas)} nuevas</span>, {fmtN(c.filas_duplicadas)} duplicadas
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ width: 44, height: 44, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Cargando datos...</span>
        </div>
      )
    }

    if (!hasData) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <Database size={48} style={{ color: 'var(--border-light)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Sin datos</h3>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>Cargá tu archivo Excel en la pestaña "Cargar Datos" para comenzar.</p>
        </div>
      )
    }

    // OVERVIEW
    if (tab === 'overview' && overviewMetrics) {
      const { totalNeto, totalBruto, totalCant, dias, promDiario, trend, monthly } = overviewMetrics
      const totalArea = areaPie.reduce((s, a) => s + a.value, 0)
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 28 }}>
            <KPICard label="Ingreso Neto" value={fmtK(totalNeto)} trend={trend} sub={trend != null ? 'vs año anterior' : null} icon={TrendingUp} delay={0} />
            <KPICard label="Ingreso Bruto" value={fmtK(totalBruto)} sub={`IVA: ${fmtK(totalBruto - totalNeto)}`} icon={Activity} delay={60} />
            <KPICard label="Total Servicios" value={fmtN(totalCant)} sub={`${dias} días operados`} icon={Users} delay={120} />
            <KPICard label="Promedio/Día" value={fmt(promDiario)} sub="ingreso neto" icon={Calendar} delay={180} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: 20 }}>
            <ChartCard title="Tendencia mensual" subtitle={`Ingreso neto ${filterYear}`} delay={200}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="gNeto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'K'} />
                  <Tooltip formatter={v => fmt(v)} {...tooltipStyle} />
                  <Area type="monotone" dataKey="neto" stroke="var(--accent)" fill="url(#gNeto)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)' }} name="Neto" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Distribución por área" delay={260}>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={areaPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                    {areaPie.map((a, i) => <Cell key={i} fill={AREA_COLORS[a.name] || COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {areaPie.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: AREA_COLORS[a.name] || COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 11 }}>{totalArea ? ((a.value / totalArea) * 100).toFixed(0) + '%' : '-'}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </div>
      )
    }

    // AREAS
    if (tab === 'areas') {
      const { data: barData, tipos: allTipos } = areaBarChart
      return (
        <div>
          <ChartCard title="Ingreso neto por área" subtitle="Desglose mensual" delay={0}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'K'} />
                <Tooltip formatter={v => fmt(v)} {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {allTipos.map((t, i) => <Bar key={t} dataKey={t} fill={AREA_COLORS[t] || COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )
    }

    // DAILY
    if (tab === 'daily') {
      return (
        <ChartCard title="Ingreso neto diario" subtitle={filterMonth != null ? MESES[filterMonth] + ' ' + filterYear : filterYear} delay={0}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(1) + 'K'} />
              <Tooltip formatter={v => fmt(v)} {...tooltipStyle} />
              <Bar dataKey="neto" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Neto" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )
    }

    // ARTICLES
    if (tab === 'articles') {
      return (
        <ChartCard title="Top artículos" subtitle="Ordenados por ingreso neto · análisis Pareto" delay={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['#', 'Artículo', 'Área', 'Neto', 'Cant', 'Prom', '% Acum'].map((h, i) => (
                    <th key={i} style={{
                      textAlign: i > 2 ? 'right' : 'left', padding: '10px 12px',
                      color: 'var(--muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articlesTable.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descripcion}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{a.tipo_inventario}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(a.total_neto)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtN(a.total_cantidad)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(a.precio_promedio)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{
                        background: a.pctAcum <= 80 ? 'var(--accent-dim)' : 'rgba(100,116,139,0.1)',
                        color: a.pctAcum <= 80 ? 'var(--accent)' : 'var(--muted)',
                        padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      }}>{a.pctAcum.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )
    }

    // COMPARE
    if (tab === 'compare') {
      const { data: cData, curYear, prevYear } = compareChart
      return (
        <ChartCard title={`Comparativo ${prevYear} vs ${curYear}`} subtitle="Ingreso neto mensual" delay={0}>
          {cData.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={cData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'K'} />
                <Tooltip formatter={v => fmt(v)} {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey={prevYear} fill="var(--border-light)" radius={[4, 4, 0, 0]} name={prevYear} />
                <Bar dataKey={curYear} fill="var(--accent)" radius={[4, 4, 0, 0]} name={curYear} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 14 }}>No hay datos del año anterior para comparar.</div>
          )}
        </ChartCard>
      )
    }
  }

  return (
    <div>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '0 24px',
        background: 'rgba(11,13,17,0.85)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={14} color="white" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>MedLab Analytics</span>
          </div>
          {ultimaCarga?.ultima_fecha && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
              Hasta {ultimaCarga.ultima_fecha} · {fmtN(ultimaCarga.total_registros)} registros
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 24px', display: 'flex', gap: 24 }}>
        {/* Sidebar */}
        <aside style={{ width: 210, flexShrink: 0 }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  border: 'none', borderRadius: 9, cursor: 'pointer',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
                  textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--card-hover)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? 'var(--accent-dim)' : 'transparent' }}
                >
                  <t.icon size={16} />{t.label}
                </button>
              )
            })}
          </nav>

          {hasData && tab !== 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <Select label="Año" value={filterYear} onChange={v => { setFilterYear(v); setFilterMonth(null) }} options={years} width="100%" />
              <Select label="Mes" value={filterMonth} onChange={setFilterMonth}
                options={[{ value: null, label: 'Todos' }, ...MESES.map((m, i) => ({ value: i, label: m }))]} width="100%" />
              {(tab === 'articles' || tab === 'compare') && (
                <Select label="Área" value={filterTipo} onChange={setFilterTipo} options={tipos} width="100%" />
              )}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
