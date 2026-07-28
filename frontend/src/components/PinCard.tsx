import { useState, useCallback } from 'react'
import { useOsc } from '../hooks/useOscario'
import { PM, faFor } from '../constants'
import ContextMenu  from './ContextMenu'
import RenameModal  from './RenameModal'

interface Props { pinNumber: number }

export default function PinCard({ pinNumber }: Props) {
  const { pins, togglePin, removeFromPanel, renamePin, addToast } = useOsc()
  const pin = pins[pinNumber]

  const [ctxPos,     setCtxPos]     = useState<{ x: number; y: number } | null>(null)
  const [showRename, setShowRename] = useState(false)

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pin) return
    await togglePin(pinNumber)
    addToast(pin.current_state === 1 ? 'off' : 'on',
      `${pin.name} ${pin.current_state === 1 ? 'apagado' : 'encendido'}`)
  }, [pin, pinNumber, togglePin, addToast])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleToggleFromCtx = useCallback(async () => {
    setCtxPos(null)
    if (!pin) return
    await togglePin(pinNumber)
    addToast(pin.current_state === 1 ? 'off' : 'on',
      `${pin.name} ${pin.current_state === 1 ? 'apagado' : 'encendido'}`)
  }, [pin, pinNumber, togglePin, addToast])

  const handleRemove = useCallback(() => {
    setCtxPos(null)
    removeFromPanel(pinNumber)
    addToast('ok', `Pin eliminado del panel`)
  }, [pinNumber, removeFromPanel, addToast])

  const handleRename = useCallback(async (name: string) => {
    await renamePin(pinNumber, name)
    addToast('ok', `Renombrado a "${name}"`)
    setShowRename(false)
  }, [pinNumber, renamePin, addToast])

  if (!pin) return null

  const isOn   = pin.current_state === 1
  const meta   = PM[pin.pin_type]
  const icon   = meta?.ctrl ? faFor(pin.name) : (meta?.icon ?? 'fa-microchip')
  const label  = meta?.label ?? pin.pin_type
  const bcmStr = pin.bcm_number >= 0 ? `BCM ${pin.bcm_number} · ` : ''

  return (
    <>
      <div
        className={`pin-card${isOn ? ' state-on' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="pc-row">
          <div className={`pc-icon-circle${isOn ? ' on' : ''}`}>
            <i className={`fa-solid ${icon}`} />
          </div>
          <span className="pc-name" title={pin.name}>{pin.name}</span>
          <div
            className={`ios-toggle${isOn ? ' on' : ''}`}
            onClick={handleClick}
            title={isOn ? 'Apagar' : 'Encender'}
          />
        </div>

        <div className="pc-row-between">
          <div className="pc-row" style={{ gap: 5 }}>
            <span className={`pc-badge ${isOn ? 'on' : 'off'}`}>
              {isOn ? 'ON' : 'OFF'}
            </span>
            <span className="pc-meta">{label} · PIN {pin.pin_number}</span>
          </div>
          <button
            className="pc-rename-btn"
            onClick={e => { e.stopPropagation(); setShowRename(true) }}
            title="Renombrar"
          >
            <i className="fa-solid fa-pencil" />
          </button>
        </div>

        <div className="pc-meta" style={{ fontSize: '.64rem' }}>
          {bcmStr}PIN {pin.pin_number}
        </div>

        <div className={`pc-bar${isOn ? ' active' : ''}`} />
      </div>

      {ctxPos && (
        <ContextMenu
          x={ctxPos.x}
          y={ctxPos.y}
          pin={pin}
          onClose={() => setCtxPos(null)}
          onToggle={handleToggleFromCtx}
          onRename={() => { setCtxPos(null); setShowRename(true) }}
          onRemoveFromPanel={handleRemove}
        />
      )}

      {showRename && (
        <RenameModal
          currentName={pin.name}
          onClose={() => setShowRename(false)}
          onSave={handleRename}
        />
      )}
    </>
  )
}
