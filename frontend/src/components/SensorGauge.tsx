// SVG semicircular gauge
// Arc path: M 10 60 A 50 50 0 0 1 110 60  (semicircle, radius=50)
// Arc length: π × 50 ≈ 157.08
import { useEffect, useState } from 'react'

const ARC_PATH  = 'M 10 60 A 50 50 0 0 1 110 60'
const ARC_LEN   = Math.PI * 50   // ≈ 157.08

interface Props {
  title:     string
  value:     number | null
  unit:      string
  min:       number
  max:       number
  color:     string
  okRange:   [number, number]   // [min, max] for "OK" badge
  updatedAt?: string | null     // ISO timestamp of the last reading (para mostrar "hace Xs")
}

function relativeTime(iso: string, now: number): string {
  const then = new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()
  const secs = Math.max(0, Math.round((now - then) / 1000))
  if (secs < 5)   return 'ahora mismo'
  if (secs < 60)  return `hace ${secs}s`
  const mins = Math.round(secs / 60)
  if (mins < 60)  return `hace ${mins} min`
  return `hace ${Math.round(mins / 60)} h`
}

export default function SensorGauge({ title, value, unit, min, max, color, okRange, updatedAt }: Props) {
  const pct    = value !== null
    ? Math.max(0, Math.min(1, (value - min) / (max - min)))
    : 0
  const filled  = pct * ARC_LEN
  const isOk    = value !== null && value >= okRange[0] && value <= okRange[1]
  const hasValue = value !== null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!updatedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [updatedAt])

  return (
    <div className="gauge-card">
      <div className="gauge-header" style={{ width: '100%' }}>
        <span className="gauge-title">{title}</span>
        {hasValue && (
          <span className={`gauge-badge ${isOk ? 'ok' : 'warn'}`}>
            {isOk ? 'OK' : '⚠'}
          </span>
        )}
      </div>

      <svg viewBox="0 5 120 62" className="gauge-svg" aria-hidden="true">
        {/* Background arc */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="rgba(0,0,0,.07)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={hasValue ? color : 'transparent'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${ARC_LEN}`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>

      {hasValue ? (
        <div className="gauge-value">
          {value!.toFixed(1)}
          <span className="gauge-unit">{unit}</span>
        </div>
      ) : (
        <div className="gauge-null">—</div>
      )}

      {hasValue && updatedAt && (
        <div className="gauge-updated">
          <i className="fa-solid fa-rotate" /> {relativeTime(updatedAt, now)}
        </div>
      )}
    </div>
  )
}
