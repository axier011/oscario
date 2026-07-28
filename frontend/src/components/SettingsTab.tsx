import { useState, useEffect } from 'react'
import { useOsc } from '../hooks/useOscario'

interface ActionState {
  loading: boolean
  result:  string | null
  error:   boolean
}

const IDLE: ActionState = { loading: false, result: null, error: false }

export default function SettingsTab() {
  const { addToast, wsStatus } = useOsc()
  const [restart,  setRestart]  = useState<ActionState>(IDLE)
  const [pull,     setPull]     = useState<ActionState>(IDLE)
  const [push,     setPush]     = useState<ActionState>(IDLE)
  const [build,    setBuild]    = useState<ActionState>(IDLE)

  // Cuando el WS se reconecta tras un reinicio, limpiar el mensaje
  useEffect(() => {
    if (wsStatus === 'connected' && restart.result !== null) {
      setRestart(IDLE)
      addToast('ok', 'Servicio reiniciado correctamente')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus])

  async function runAction(
    endpoint: string,
    setState: (s: ActionState) => void,
    label: string
  ) {
    setState({ loading: true, result: null, error: false })
    try {
      const res  = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setState({ loading: false, result: data.detail ?? 'Error desconocido', error: true })
        addToast('off', `${label}: ${data.detail ?? 'Error'}`)
      } else {
        const msg = data.message ?? data.output ?? 'OK'
        setState({ loading: false, result: msg, error: false })
        addToast('ok', `${label}: ${msg.split('\n')[0]}`)
      }
    } catch {
      setState({ loading: false, result: 'No se pudo conectar con el servidor', error: true })
      addToast('off', 'No se pudo conectar con el servidor')
    } finally {
      // Borrar el mensaje automáticamente tras 2 s
      setTimeout(() => setState(IDLE), 2_000)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-title">
        <i className="fa-solid fa-gear" />
        Ajustes del sistema
      </div>

      <div className="settings-grid">

        {/* Reiniciar servicio */}
        <div className="settings-card">
          <div className="settings-card-icon restart">
            <i className="fa-solid fa-rotate" />
          </div>
          <div className="settings-card-body">
            <div className="settings-card-name">Reiniciar servicio</div>
            <div className="settings-card-desc">
              Ejecuta <code>systemctl restart acuario-api</code> en el Pi.
              La conexión se recupera sola en unos segundos.
            </div>
            {restart.result && (
              <div className={`settings-output${restart.error ? ' err' : ''}`}>
                {restart.result}
              </div>
            )}
          </div>
          <button
            className={`settings-btn restart${restart.loading ? ' loading' : ''}`}
            disabled={restart.loading}
            onClick={() => runAction('/api/v1/system/restart', setRestart, 'Reinicio')}
          >
            {restart.loading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Reiniciando…</>
              : <><i className="fa-solid fa-rotate" /> Reiniciar</>}
          </button>
        </div>

        {/* Git pull */}
        <div className="settings-card">
          <div className="settings-card-icon pull">
            <i className="fa-solid fa-cloud-arrow-down" />
          </div>
          <div className="settings-card-body">
            <div className="settings-card-name">Git Pull</div>
            <div className="settings-card-desc">
              Descarga los últimos cambios del repositorio remoto al Pi.
            </div>
            {pull.result && (
              <div className={`settings-output${pull.error ? ' err' : ''}`}>
                {pull.result}
              </div>
            )}
          </div>
          <button
            className={`settings-btn pull${pull.loading ? ' loading' : ''}`}
            disabled={pull.loading}
            onClick={() => runAction('/api/v1/system/git-pull', setPull, 'Git Pull')}
          >
            {pull.loading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Descargando…</>
              : <><i className="fa-solid fa-cloud-arrow-down" /> Git Pull</>}
          </button>
        </div>

        {/* Git push */}
        <div className="settings-card">
          <div className="settings-card-icon push">
            <i className="fa-solid fa-cloud-arrow-up" />
          </div>
          <div className="settings-card-body">
            <div className="settings-card-name">Git Push</div>
            <div className="settings-card-desc">
              Sube los cambios locales del Pi al repositorio remoto.
            </div>
            {push.result && (
              <div className={`settings-output${push.error ? ' err' : ''}`}>
                {push.result}
              </div>
            )}
          </div>
          <button
            className={`settings-btn push${push.loading ? ' loading' : ''}`}
            disabled={push.loading}
            onClick={() => runAction('/api/v1/system/git-push', setPush, 'Git Push')}
          >
            {push.loading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Subiendo…</>
              : <><i className="fa-solid fa-cloud-arrow-up" /> Git Push</>}
          </button>
        </div>

        {/* npm run build */}
        <div className="settings-card">
          <div className="settings-card-icon build">
            <i className="fa-solid fa-hammer" />
          </div>
          <div className="settings-card-body">
            <div className="settings-card-name">npm run build</div>
            <div className="settings-card-desc">
              Compila el frontend React en <code>frontend/</code> y genera el
              directorio <code>dist/</code>. Puede tardar ~30 segundos.
            </div>
            {build.result && (
              <div className={`settings-output${build.error ? ' err' : ''}`}>
                {build.result}
              </div>
            )}
          </div>
          <button
            className={`settings-btn build${build.loading ? ' loading' : ''}`}
            disabled={build.loading}
            onClick={() => runAction('/api/v1/system/npm-build', setBuild, 'Build')}
          >
            {build.loading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Compilando…</>
              : <><i className="fa-solid fa-hammer" /> Build</>}
          </button>
        </div>

      </div>
    </div>
  )
}
