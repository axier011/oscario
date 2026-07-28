import { useRef, useState } from 'react'

interface Props {
  currentName: string
  onClose:     () => void
  onSave:      (name: string) => Promise<void>
}

export default function RenameModal({ currentName, onClose, onSave }: Props) {
  const [name,    setName]    = useState(currentName)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) { onClose(); return }
    setLoading(true)
    try { await onSave(trimmed) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Renombrar dispositivo</div>
        <div className="modal-sub">Nombre actual: <strong>{currentName}</strong></div>

        <input
          ref={inputRef}
          className="modal-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
          autoFocus
          maxLength={64}
          placeholder="Nuevo nombre…"
        />

        <div className="modal-actions">
          <button className="modal-btn secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="modal-btn primary"
            onClick={handleSave}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
