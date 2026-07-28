import { useState } from 'react'
import { OscarioCtx, useOscario } from './hooks/useOscario'
import TopBar      from './components/TopBar'
import ControlTab  from './components/ControlTab'
import GpioMap     from './components/GpioMap'
import LogHistory  from './components/LogHistory'
import Toast       from './components/Toast'
import type { TabId } from './types'

export default function App() {
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
        </nav>

        <main className="page">
          {activeTab === 'ctrl' && <ControlTab />}
          {activeTab === 'map'  && <GpioMap />}
          {activeTab === 'hist' && <LogHistory />}
        </main>

        <Toast />
      </div>
    </OscarioCtx.Provider>
  )
}
