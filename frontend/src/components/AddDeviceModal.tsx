import { useState } from 'react'
import { PM, faFor } from '../constants'
import type { Pin } from '../types'

interface Props {
  availablePins: Pin[]
  onClose:  () => void
  onAdd:    (pinNumber: number, name: string) => Promise<void>
}

export default function AddDeviceModal({ availablePins, onClose, onAdd }: Props) {
  const [step,     setStep]     = useState<1 | 2>(1)
  const [selected, setSelected] = useState<Pin | null>(null)
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)

  function selectPin(pin: Pin) {
    setSelected(pin)
    setName(pin.name)
    setStep(2)
  }

  async function handleConfirm() {
    if (!selected || !name.trim()) return
    setLoading(true)
    try {
      await onAdd(selected.pin_number, name.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {step === 1 ? 'Seleccionar dispositivo' : 'Nombrar dispositivo'}
        </div>
        <div className="modal-sub">
          {step === 1
            ? 'Pines controlables disponibles'
            : `PIN ${selected?.pin_number} · BCM ${selected?.bcm_number}`}
        </div>

        <div className="adm-steps">
          <div className={`adm-step${step === 1 ? ' active' : ''}`}>1 · Seleccionar</div>
          <div className={`adm-step${step === 2 ? ' active' : ''}`}>2 · Nombrar</div>
        </div>

        {step === 1 && (
          <div className="adm-pin-list">
            {availablePins.length === 0 && (
              <p style={{ color: 'var(--t2)', textAlign: 'center', padding: '20px 0', fontSize: '.85rem' }}>
                Todos los pines controlables ya están en el panel.
              </p>
            )}
            {availablePins.map(pin => {
              const meta  = PM[pin.pin_type]
              const icon  = faFor(pin.name)
              return (
                <div
                  key={pin.pin_number}
                  className="adm-pin-item"
                  onClick={() => selectPin(pin)}
                >
                  <div className="adm-pin-icon" style={{ color: meta?.c ?? 'var(--t2)' }}>
                    <i className={`fa-solid ${icon}`} />
                  </div>
                  <div className="adm-pin-info">
                    <div className="adm-pin-name">{pin.name}</div>
                    <div className="adm-pin-meta">{meta?.label ?? pin.pin_type} · PIN {pin.pin_number} · BCM {pin.bcm_number}</div>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--t3)', fontSize: 11 }} />
                </div>
              )
            })}
          </div>
        )}

        {step === 2 && selected && (
          <div>
            <div className="adm-label">Nombre del dispositivo</div>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              autoFocus
              maxLength={64}
              placeholder="Ej. Calentador, Filtro, Luz blanca…"
            />
          </div>
        )}

        <div className="modal-actions">
          {step === 2 && (
            <button className="modal-btn secondary" onClick={() => setStep(1)} disabled={loading}>
              Atrás
            </button>
          )}
          <button className="modal-btn secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          {step === 2 && (
            <button className="modal-btn primary" onClick={handleConfirm} disabled={loading || !name.trim()}>
              {loading ? 'Añadiendo…' : 'Añadir al panel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
