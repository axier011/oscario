import { useEffect, useRef, useState } from 'react'
import { useOsc } from '../hooks/useOscario'
import { CTRL_TYPES } from '../constants'
import ConfirmModal from './ConfirmModal'
import { apiRestart } from '../api'

function formatUptime(seconds: number): string {
  if (seconds < 60)   return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export default function HealthCard() {
  const { pins, lastWaterTemp, addToast } = useOsc()

  const [uptime, setUptime]           = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const mountTime = useRef(Date.now())

  useEffect(() => {
    const iv = setInterval(() => {
      setUptime(Math.floor((Date.now() - mountTime.current) / 1000))
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const allPins   = Object.values(pins)
  const ctrlPins  = allPins.filter(p => CTRL_TYPES.has(p.pin_type))
  const activeN   = ctrlPins.filter(p => p.current_state === 1).length

  const filterPin  = allPins.find(p => p.name.toLowerCase().includes('filtro'))
  const lightPin   = allPins.find(p => p.name.toLowerCase().includes('luz'))
  const filterOn   = filterPin ? filterPin.current_state === 1 : false
  const lightOn    = lightPin  ? lightPin.current_state  === 1 : false

  const tempOk = lastWaterTemp !== null && lastWaterTemp >= 23 && lastWaterTemp <= 26.5
  const tempWarn = lastWaterTemp !== null && (lastWaterTemp < 23 || lastWaterTemp > 26.5)

  let score = 100
  if (lastWaterTemp !== null) {
    if (lastWaterTemp < 20 || lastWaterTemp > 30)       score -= 30
    else if (lastWaterTemp < 23 || lastWaterTemp > 26.5) score -= 15
  }
  if (!filterOn && filterPin) score -= 20
  score = Math.max(0, Math.min(100, score))

  async function handleRestart() {
    setShowConfirm(false)
    try {
      await apiRestart()
      addToast('ok', 'Reiniciando servicio…')
    } catch {
      addToast('error', 'Error al reiniciar el servicio')
    }
  }

  return (
    <>
      <div className="health-card">
        <div className="health-label">Salud del acuario</div>

        <div className="health-score-row">
          <span className="health-score">{score}</span>
          <span className="health-score-max">/100</span>
        </div>

        <div className="health-bar">
          <div className="health-bar-fill" style={{ width: `${score}%` }} />
        </div>

        <div className="health-pills">
          {lastWaterTemp !== null && (
            <span className={`health-pill ${tempOk ? 'ok' : tempWarn ? 'warn' : 'dim'}`}>
              <i className={`fa-solid fa-thermometer-half`} />
              Temp. {tempOk ? 'óptima' : 'fuera de rango'}
            </span>
          )}
          <span className={`health-pill ${filterOn ? 'ok' : filterPin ? 'warn' : 'dim'}`}>
            <i className="fa-solid fa-filter" />
            Filtro {filterOn ? 'activo' : filterPin ? 'inactivo' : 'N/D'}
          </span>
          <span className={`health-pill ${lightOn ? 'ok' : 'dim'}`}>
            <i className="fa-solid fa-lightbulb" />
            Luz {lightOn ? 'encendida' : 'apagada'}
          </span>
          <span className="health-pill dim">
            <i className="fa-solid fa-power-off" />
            {activeN}/{ctrlPins.length} activos
          </span>
        </div>

        <div className="health-footer">
          <span>
            <i className="fa-solid fa-clock" style={{ marginRight: 4 }} />
            {formatUptime(uptime)}
          </span>
          <button className="restart-btn" onClick={() => setShowConfirm(true)}>
            <i className="fa-solid fa-rotate-right" /> Reiniciar
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Reiniciar servicio"
          message="Se reiniciará el servicio acuario-api en la Raspberry Pi. La conexión se perderá brevemente. ¿Continuar?"
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleRestart}
          confirmLabel="Reiniciar"
          danger
        />
      )}
    </>
  )
}
