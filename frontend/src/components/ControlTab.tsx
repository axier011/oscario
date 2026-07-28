import { useState } from 'react'
import { useOsc } from '../hooks/useOscario'
import { CTRL_TYPES, PM } from '../constants'
import PinCard        from './PinCard'
import AddDeviceModal from './AddDeviceModal'
import ScenesGrid     from './ScenesGrid'
import HealthCard     from './HealthCard'
import SensorGauge   from './SensorGauge'

export default function ControlTab() {
  const { pins, visiblePins, lastWaterTemp, lastCpuTemp, setAllPins, addToPanel, renamePin, addToast } = useOsc()
  const [showAddModal, setShowAddModal] = useState(false)

  const allPins   = Object.values(pins)
  const ctrlPins  = allPins.filter(p => CTRL_TYPES.has(p.pin_type))
  const visibleCtrlPins = ctrlPins.filter(p => visiblePins.includes(p.pin_number))

  const onCount = visibleCtrlPins.filter(p => p.current_state === 1).length
  const total   = visibleCtrlPins.length

  const availablePins = ctrlPins.filter(p => !visiblePins.includes(p.pin_number))

  async function handleAddDevice(pinNumber: number, name: string) {
    await renamePin(pinNumber, name)
    addToPanel(pinNumber)
    addToast('ok', `${name} añadido al panel`)
    setShowAddModal(false)
  }

  async function handleAllOn() {
    await setAllPins(1)
    addToast('on', 'Todos los dispositivos encendidos')
  }

  async function handleAllOff() {
    await setAllPins(0)
    addToast('off', 'Todos los dispositivos apagados')
  }

  return (
    <div>
      {/* Devices header */}
      <div className="ctrl-header">
        <div>
          <div className="ctrl-title">Dispositivos</div>
          <div className="ctrl-count">{onCount} ON / {total}</div>
        </div>
        <div className="ctrl-actions">
          <button className="ctrl-btn on"  onClick={handleAllOn}>
            <i className="fa-solid fa-power-off" /> Encender todo
          </button>
          <button className="ctrl-btn off" onClick={handleAllOff}>
            <i className="fa-solid fa-power-off" /> Apagar todo
          </button>
        </div>
      </div>

      {/* Pin cards grid */}
      <div className="pin-grid">
        {visibleCtrlPins.map(pin => (
          <PinCard key={pin.pin_number} pinNumber={pin.pin_number} />
        ))}
        <div className="add-dev-card" onClick={() => setShowAddModal(true)}>
          <i className="fa-solid fa-plus" />
          <span>Añadir dispositivo</span>
        </div>
      </div>

      {/* Scenes */}
      <div className="section-header">
        <span className="section-title">Escenas</span>
      </div>
      <ScenesGrid />

      {/* Bottom 3-col */}
      <div className="bottom-grid">
        <HealthCard />
        <SensorGauge
          title="Temperatura agua"
          value={lastWaterTemp}
          unit="°C"
          min={18}
          max={32}
          color="var(--blue)"
          okRange={[23, 26.5]}
        />
        <SensorGauge
          title="Temperatura CPU"
          value={lastCpuTemp}
          unit="°C"
          min={30}
          max={90}
          color="var(--amber)"
          okRange={[30, 70]}
        />
      </div>

      {showAddModal && (
        <AddDeviceModal
          availablePins={availablePins}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddDevice}
        />
      )}
    </div>
  )
}
