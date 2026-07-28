interface Props {
  title:        string
  message:      string
  onCancel:     () => void
  onConfirm:    () => void
  confirmLabel?: string
  danger?:      boolean
}

export default function ConfirmModal({ title, message, onCancel, onConfirm, confirmLabel = 'Confirmar', danger = false }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-sub" style={{ marginBottom: 0 }}>{message}</div>

        <div className="modal-actions">
          <button className="modal-btn secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className={`modal-btn ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
