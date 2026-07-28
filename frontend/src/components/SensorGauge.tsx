// SVG semicircular gauge
// Arc path: M 10 60 A 50 50 0 0 1 110 60  (semicircle, radius=50)
// Arc length: π × 50 ≈ 157.08

const ARC_PATH  = 'M 10 60 A 50 50 0 0 1 110 60'
const ARC_LEN   = Math.PI * 50   // ≈ 157.08

interface Props {
  title:   string
  value:   number | null
  unit:    string
  min:     number
  max:     number
  color:   string
  okRange: [number, number]   // [min, max] for "OK" badge
}

export default function SensorGauge({ title, value, unit, min, max, color, okRange }: Props) {
  const pct    = value !== null
    ? Math.max(0, Math.min(1, (value - min) / (max - min)))
    : 0
  const filled  = pct * ARC_LEN
  const isOk    = value !== null && value >= okRange[0] && value <= okRange[1]
  const hasValue = value !== null

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
    </div>
  )
}
