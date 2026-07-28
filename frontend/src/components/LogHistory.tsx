import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchLogs } from '../api'
import type { LogEntry } from '../types'

const SOURCE_COLORS: Record<string, string> = {
  WEB_APP:          'web_app',
  PHYSICAL_BUTTON:  'physical_button',
}

function sourceClass(src: string): string {
  return SOURCE_COLORS[src.toUpperCase()] ?? 'other'
}

function relTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)   return `hace ${Math.floor(diff)}s`
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  return `hace ${Math.floor(diff / 3600)}h`
}

export default function LogHistory() {
  const [allLogs,    setAllLogs]    = useState<LogEntry[]>([])
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [filter,     setFilter]     = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Initial load / filter change
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await apiFetchLogs(1, filter || undefined)
        if (!cancelled) {
          setAllLogs(data.logs)
          setPage(1)
          setTotalPages(data.pages)
        }
      } catch { /* noop */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filter])

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return
    const nextPage = page + 1
    setLoading(true)
    try {
      const data = await apiFetchLogs(nextPage, filter || undefined)
      setAllLogs(prev => [...prev, ...data.logs])
      setPage(nextPage)
    } catch { /* noop */ }
    finally { setLoading(false) }
  }, [loading, page, totalPages, filter])

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

  const sources = useMemo(() => {
    const set = new Set(allLogs.map(l => l.source))
    return Array.from(set).sort()
  }, [allLogs])

  return (
    <div>
      <div className="log-header">
        <span className="log-title">Historial de eventos</span>
        <select
          className="log-filter"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="">Todas las fuentes</option>
          {sources.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
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
              <div
                className="log-dot"
                style={{ background: isOn ? 'var(--green)' : 'var(--red)' }}
              />
              <div className="log-body">
                <div className="log-meta" style={{ marginBottom: 2 }}>
                  <span className={`log-badge ${isOn ? 'on' : 'off'}`}>
                    {isOn ? 'ON' : 'OFF'}
                  </span>
                  <span className={`log-source ${sourceClass(log.source)}`}>
                    {log.source.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="log-name">{log.name}</div>
                <div className="log-meta">
                  <span>PIN {log.pin_number}</span>
                  <span>{log.old_state} → {log.new_state}</span>
                  <span>{relTime(log.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="log-sentinel" ref={sentinelRef}>
        {loading && <span className="log-loading"><i className="fa-solid fa-spinner fa-spin" /> Cargando…</span>}
        {!loading && page >= totalPages && allLogs.length > 0 && (
          <span className="log-loading">Fin del historial</span>
        )}
      </div>
    </div>
  )
}
