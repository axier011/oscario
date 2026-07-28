import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchLogs } from '../api'
import type { LogEntry } from '../types'

const SOURCE_COLORS: Record<string, string> = {
  WEB_APP:          'web_app',
  PHYSICAL_BUTTON:  'physical_button',
  TELEGRAM:         'telegram',
}

const SOURCE_ICONS: Record<string, string> = {
  WEB_APP:          'fa-globe',
  PHYSICAL_BUTTON:  'fa-hand-pointer',
  TELEGRAM:         'fa-paper-plane',
}

function sourceClass(src: string): string {
  return SOURCE_COLORS[src.toUpperCase()] ?? 'other'
}

function sourceIcon(src: string): string {
  return SOURCE_ICONS[src.toUpperCase()] ?? 'fa-circle-question'
}

function relTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return `hace ${Math.floor(diff)}s`
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function exportCsv(logs: LogEntry[]): void {
  const header = 'Fecha,Pin,Nombre,Estado_anterior,Estado_nuevo,Fuente'
  const rows = logs.map(l =>
    [l.created_at, l.pin_number, `"${l.name}"`, l.old_state, l.new_state, l.source].join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `oscario_logs_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function LogHistory() {
  const [allLogs,    setAllLogs]    = useState<LogEntry[]>([])
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [source,     setSource]     = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const sources = useMemo(() => Array.from(new Set(allLogs.map(l => l.source))).sort(), [allLogs])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await apiFetchLogs(1, source || undefined, dateFrom || undefined, dateTo || undefined)
        if (!cancelled) { setAllLogs(data.logs); setPage(1); setTotalPages(data.pages) }
      } catch { /* noop */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [source, dateFrom, dateTo])

  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return
    const nextPage = page + 1
    setLoading(true)
    try {
      const data = await apiFetchLogs(nextPage, source || undefined, dateFrom || undefined, dateTo || undefined)
      setAllLogs(prev => [...prev, ...data.logs])
      setPage(nextPage)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [loading, page, totalPages, source, dateFrom, dateTo])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      <div className="log-header">
        <span className="log-title">Historial de eventos</span>
        <button
          className="log-export"
          onClick={() => exportCsv(allLogs)}
          disabled={allLogs.length === 0}
          title="Exportar a CSV"
        >
          <i className="fa-solid fa-download" /> CSV
        </button>
      </div>

      <div className="log-controls">
        <input
          type="date" className="log-filter log-date"
          value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          title="Desde"
        />
        <input
          type="date" className="log-filter log-date"
          value={dateTo} onChange={e => setDateTo(e.target.value)}
          title="Hasta"
        />
        <select className="log-filter" value={source} onChange={e => setSource(e.target.value)}>
          <option value="">Todas las fuentes</option>
          {sources.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {allLogs.length === 0 && !loading && (
        <div className="log-empty">
          <i className="fa-solid fa-history" style={{ fontSize: 32, marginBottom: 8, display: 'block', color: 'var(--t3)' }} />
          Sin eventos registrados
        </div>
      )}

      <div className="log-list">
        {allLogs.map((log, i) => {
          const isOn = log.new_state === 1
          return (
            <div key={`${log.created_at}-${i}`} className="log-item">
              <div className="log-dot" style={{ background: isOn ? 'var(--green)' : 'var(--red)' }} />
              <div className="log-body">
                <div className="log-name">{log.name}</div>
                <div className="log-meta">
                  <span className={`log-badge ${isOn ? 'on' : 'off'}`}>{isOn ? 'ON' : 'OFF'}</span>
                  <span className={`log-source ${sourceClass(log.source)}`}>
                    <i className={`fa-solid ${sourceIcon(log.source)}`} />{' '}
                    {log.source.replace(/_/g, ' ')}
                  </span>
                  <span>PIN {log.pin_number}</span>
                  <span
                    style={{ marginLeft: 'auto' }}
                    title={new Date(log.created_at).toLocaleString('es-ES')}
                  >
                    {relTime(log.created_at)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="log-sentinel" ref={sentinelRef}>
        {loading && <span className="log-loading"><i className="fa-solid fa-spinner fa-spin" /> Cargando…</span>}
        {!loading && page >= totalPages && allLogs.length > 0 && (
          <span className="log-loading">— {allLogs.length} eventos —</span>
        )}
      </div>
    </div>
  )
}
