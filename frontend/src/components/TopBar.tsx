import { useEffect, useState } from 'react'
import { useOsc } from '../hooks/useOscario'
import type { Theme } from '../types'

function applyTheme(theme: Theme) {
  let resolved: 'light' | 'dark'
  if (theme === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } else {
    resolved = theme
  }
  document.documentElement.setAttribute('data-theme', resolved)
}

export default function TopBar() {
  const { wsStatus } = useOsc()

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('aquapi-theme') as Theme | null) ?? 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('aquapi-theme', theme)

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('auto')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const wsLabel = wsStatus === 'connected'
    ? 'WS conectado'
    : wsStatus === 'connecting'
    ? 'Conectando…'
    : 'Desconectado'

  return (
    <header className="topbar">
      <div className="topbar-logo">🐠</div>

      <div className="topbar-titles">
        <div className="topbar-name">Oscario</div>
        <div className="topbar-sub">Acuario automatizado · Raspberry Pi 4B</div>
      </div>

      <div className="theme-switcher">
        {(['light', 'dark', 'auto'] as Theme[]).map(t => (
          <button
            key={t}
            className={`theme-btn${theme === t ? ' active' : ''}`}
            onClick={() => setTheme(t)}
          >
            {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Auto'}
          </button>
        ))}
      </div>

      <span className={`ws-pill ${wsStatus}`}>
        {wsLabel}
      </span>
    </header>
  )
}
