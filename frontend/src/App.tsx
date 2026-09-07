import { useEffect, useState } from 'react'
import { OscarioCtx, useOscario } from './hooks/useOscario'
import LoginPage     from './components/LoginPage'
import TopBar        from './components/TopBar'
import ControlTab    from './components/ControlTab'
import GpioMap       from './components/GpioMap'
import LogHistory    from './components/LogHistory'
import SettingsTab   from './components/SettingsTab'
import Toast         from './components/Toast'
import PumpkinModal  from './components/PumpkinModal'
import { apiGetMyUser } from './api'
import { TAB_OPTIONS } from './constants'
import type { AppUser, TabId } from './types'

function AuthenticatedApp() {
  const oscario = useOscario()
  const { pumpkinPressed, clearPumpkin } = oscario

  const [me, setMe] = useState<AppUser | null>(null)
  const [meLoading, setMeLoading] = useState(true)
  useEffect(() => {
    apiGetMyUser().then(setMe).catch(() => setMe(null)).finally(() => setMeLoading(false))
  }, [])

  const allowedTabs = me ? TAB_OPTIONS.filter(t => me.permissions.includes(t.id)) : TAB_OPTIONS

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return (localStorage.getItem('aquapi-tab') as TabId | null) ?? 'ctrl'
  })

  // Si el usuario no tiene permiso para la pesta\u00f1a activa, cambiar a la primera permitida
  useEffect(() => {
    if (!meLoading && allowedTabs.length > 0 && !allowedTabs.some(t => t.id === activeTab)) {
      switchTab(allowedTabs[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading, me])

  function switchTab(tab: TabId) {
    setActiveTab(tab)
    localStorage.setItem('aquapi-tab', tab)
  }

  if (meLoading) return null

  return (
    <OscarioCtx.Provider value={oscario}>
      <div className="app">
        <TopBar pumpkinActive={pumpkinPressed} />

        <nav className="tab-bar">
          {allowedTabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => switchTab(t.id)}
            >
              <i className={`fa-solid ${t.icon}`} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <main className="page">
          <div className="page-inner">
            {activeTab === 'ctrl'     && <ControlTab />}
            {activeTab === 'map'      && <GpioMap />}
            {activeTab === 'hist'     && <LogHistory />}
            {activeTab === 'settings' && <SettingsTab me={me} />}
          </div>
        </main>

        <Toast />
        {pumpkinPressed && <PumpkinModal onClose={clearPumpkin} />}
      </div>
    </OscarioCtx.Provider>
  )
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('oscario-token'))
  if (!token) return <LoginPage onLogin={setToken} />
  return <AuthenticatedApp />
}
