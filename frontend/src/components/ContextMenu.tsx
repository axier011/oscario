import { useEffect, useRef } from 'react'
import { PM } from '../constants'
import type { Pin } from '../types'

interface Props {
  x:               number
  y:               number
  pin:             Pin
  onClose:         () => void
  onToggle:        () => void
  onRename:        () => void
  onRemoveFromPanel: () => void
}

export default function ContextMenu({ x, y, pin, onClose, onToggle, onRename, onRemoveFromPanel }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Clamp position to viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  const menuW = 190
  const menuH = 170
  const left = Math.min(x, vw - menuW - 8)
  const top  = Math.min(y, vh - menuH - 8)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  const isOn = pin.current_state === 1
  const meta = PM[pin.pin_type]

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left, top }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="ctx-info">{pin.name}</div>
      <div className="ctx-info" style={{ marginTop: 0 }}>{meta?.label ?? pin.pin_type} · PIN {pin.pin_number}</div>
      <div className="ctx-sep" />

      <div className={`ctx-item ${isOn ? 'danger' : 'success'}`} onClick={onToggle}>
        <i className={`fa-solid ${isOn ? 'fa-power-off' : 'fa-power-off'}`} />
        {isOn ? 'Apagar' : 'Encender'}
      </div>

      <div className="ctx-item" onClick={onRename}>
        <i className="fa-solid fa-pencil" />
        Renombrar
      </div>

      <div className="ctx-sep" />

      <div className="ctx-item danger" onClick={onRemoveFromPanel}>
        <i className="fa-solid fa-eye-slash" />
        Quitar del panel
      </div>
    </div>
  )
}
