import { useState, useCallback } from 'react'
import { useOsc } from '../hooks/useOscario'
import { PM, faFor, TOGGLEABLE_FE } from '../constants'
import { apiSetPin, apiSimulatePress } from '../api'
import ContextMenu  from './ContextMenu'
import RenameModal  from './RenameModal'

interface Props { pinNumber: number }

export default function PinCard({ pinNumber }: Props) {
  const { pins, togglePin, removeFromPanel, renamePin, addToast } = useOsc()
  const pin = pins[pinNumber]

  // Declarado antes de los callbacks para evitar TDZ
  const isFeed    = pin?.name.toLowerCase().includes('comedero') ?? false
  const isPumpkin  = pin?.pin_type === 'BTN_PUMPKIN'

  const [ctxPos,     setCtxPos]     = useState<{ x: number; y: number } | null>(null)
  const [showRename, setShowRename] = useState(false)

  const isToggleable = TOGGLEABLE_FE.has(pin?.pin_type ?? '')

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pin) return

    // Calabaza: simula pulsación → dispara PUMPKIN_PRESS → abre modal agente
    if (isPumpkin) {
      try { await apiSimulatePress(pin.pin_number) } catch { /* ignore */ }
      return
    }

    if (!TOGGLEABLE_FE.has(pin.pin_type)) return   // entradas físicas: solo lectura
    if (isFeed) {
      const luzBlanca = Object.values(pins).find(p => p.name.toLowerCase().includes('blanca'))
      if (luzBlanca) {
        try { await apiSetPin(luzBlanca.pin_number, 1) } catch { /* ignore */ }
        addToast('on', 'Luz Blanca encendida')
      }
      await new Promise<void>(r => setTimeout(r, 400))
      try {
        await apiSetPin(pinNumber, 1)
        addToast('on', `${pin.name}: impulso enviado`)
        await new Promise<void>(r => setTimeout(r, 1000))
        await apiSetPin(pinNumber, 0)
      } catch { /* ignore */ }
      return
    }
    await togglePin(pinNumber)
    addToast(pin.current_state === 1 ? 'off' : 'on',
      `${pin.name} ${pin.current_state === 1 ? 'apagado' : 'encendido'}`)
  }, [pin, pinNumber, isFeed, isPumpkin, togglePin, addToast])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleToggleFromCtx = useCallback(async () => {
    setCtxPos(null)
    if (!pin) return
    if (isFeed) { await handleClick({ stopPropagation: () => {} } as React.MouseEvent); return }
    await togglePin(pinNumber)
    addToast(pin.current_state === 1 ? 'off' : 'on',
      `${pin.name} ${pin.current_state === 1 ? 'apagado' : 'encendido'}`)
  }, [pin, pinNumber, isFeed, handleClick, togglePin, addToast])

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
        className={`pin-card${isOn ? ' state-on' : ''}${(!isToggleable && !isPumpkin) ? ' readonly' : ''}${isPumpkin ? ' pumpkin' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={isPumpkin ? '🎃 Pulsar para abrir asistente' : undefined}
      >
        <div className="pc-row">
          <div className={`pc-icon-circle${isOn ? ' on' : ''}`}>
            <i className={`fa-solid ${isPumpkin ? 'fa-ghost' : icon}`} />
          </div>
          <span className="pc-name" title={pin.name}>{pin.name}</span>
          {isPumpkin
            ? <span style={{ fontSize: '1.3rem', cursor: 'pointer' }} title="Abrir asistente">🎃</span>
            : isToggleable
              ? <div
                  className={`ios-toggle${isOn ? ' on' : ''}`}
                  onClick={handleClick}
                  title={isOn ? 'Apagar' : 'Encender'}
                />
              : <i className="fa-solid fa-lock" style={{ color: 'var(--t3)', fontSize: 13 }} title="Entrada física" />
          }
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

        <div className={`pc-bar${isOn ? ' active' : ''}`}>
          {isOn && [0,1,2,3,4,5,6].map(i => (
            <span
              key={i}
              className={`pc-bubble${isFeed ? ' food' : ''}`}
              style={{
                '--bx': `${5 + i * 13}%`,
                '--bd': `${i * 0.30}s`,
                '--bs': `${0.9 + (i % 3) * 0.35}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
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
