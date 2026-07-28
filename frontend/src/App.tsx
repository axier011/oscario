import { useState } from 'react'
import { OscarioCtx, useOscario } from './hooks/useOscario'
import LoginPage  from './components/LoginPage'
import TopBar      from './components/TopBar'
import ControlTab  from './components/ControlTab'
import GpioMap     from './components/GpioMap'
import LogHistory  from './components/LogHistory'
import SettingsTab from './components/SettingsTab'
import Toast       from './components/Toast'
import type { TabId } from './types'

function AuthenticatedApp() {
  const oscario = useOscario()

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return (localStorage.getItem('aquapi-tab') as TabId | null) ?? 'ctrl'
  })

  function switchTab(tab: TabId) {
    setActiveTab(tab)
    localStorage.setItem('aquapi-tab', tab)
  }

  return (
    <OscarioCtx.Provider value={oscario}>
      <div className="app">
        <TopBar />

        <nav className="tab-bar">
          <button
            className={`tab-btn${activeTab === 'ctrl' ? ' active' : ''}`}
            onClick={() => switchTab('ctrl')}
          >
            <i className="fa-solid fa-sliders" />
            <span>Control</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'map' ? ' active' : ''}`}
            onClick={() => switchTab('map')}
          >
            <i className="fa-solid fa-microchip" />
            <span>Mapa GPIO</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'hist' ? ' active' : ''}`}
            onClick={() => switchTab('hist')}
          >
            <i className="fa-solid fa-clock-rotate-left" />
            <span>Historial</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'settings' ? ' active' : ''}`}
            onClick={() => switchTab('settings')}
          >
            <i className="fa-solid fa-gear" />
            <span>Ajustes</span>
          </button>
        </nav>

        <main className="page">
          <div className="page-inner">
            {activeTab === 'ctrl'     && <ControlTab />}
            {activeTab === 'map'      && <GpioMap />}
            {activeTab === 'hist'     && <LogHistory />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </main>

        <Toast />
      </div>
    </OscarioCtx.Provider>
  )
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('oscario-token'))
  if (!token) return <LoginPage onLogin={setToken} />
  return <AuthenticatedApp />
}
