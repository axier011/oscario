import { useOsc } from '../hooks/useOscario'

const ICONS: Record<string, string> = {
  ok:    'fa-circle-check',
  on:    'fa-power-off',
  off:   'fa-power-off',
  error: 'fa-triangle-exclamation',
}

export default function Toast() {
  const { toasts, removeToast } = useOsc()

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast ${t.type}${t.exiting ? ' exiting' : ''}`}
          onClick={() => removeToast(t.id)}
          role="alert"
        >
          <i className={`fa-solid ${ICONS[t.type] ?? 'fa-info-circle'}`} />
          <span style={{ flex: 1 }}>{t.msg}</span>
          <i className="fa-solid fa-xmark" style={{ opacity: .7, cursor: 'pointer' }} />
        </div>
      ))}
    </div>
  )
}
