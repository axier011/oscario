import { Fragment } from 'react'
import { useOsc } from '../hooks/useOscario'
import { CTRL_TYPES, GPIO_PINS, PM, TOGGLEABLE_FE } from '../constants'
import { apiSimulatePress } from '../api'
import type { Pin } from '../types'

export default function GpioMap() {
  const { pins, togglePin, addToast } = useOsc()

  // 20 columnas de [pin impar (fila física superior), pin par (fila física inferior)]
  const cols: [typeof GPIO_PINS[0], typeof GPIO_PINS[0]][] = []
  for (let i = 0; i < 20; i++) {
    cols.push([GPIO_PINS[i * 2], GPIO_PINS[i * 2 + 1]])
  }

  function getDbPin(physPin: number): Pin | undefined {
    return pins[physPin]
  }

  function getPinColor(physPin: number, staticType: string): string {
    const dbPin = getDbPin(physPin)
    const type  = dbPin?.pin_type ?? staticType
    if (CTRL_TYPES.has(type)) {
      return (dbPin?.current_state ?? 0) ? 'var(--green)' : '#8a3040'
    }
    const meta = PM[type]
    return meta?.c ?? '#4a5568'
  }

  function getLabel(physPin: number, staticLabel: string): string {
    return getDbPin(physPin)?.name ?? staticLabel
  }

  function isCtrl(physPin: number, staticType: string): boolean {
    const type = getDbPin(physPin)?.pin_type ?? staticType
    return CTRL_TYPES.has(type)
  }

  function isOn(physPin: number): boolean {
    return (getDbPin(physPin)?.current_state ?? 0) === 1
  }

  function isPhysicalBtn(physPin: number, staticType: string): boolean {
    const type = getDbPin(physPin)?.pin_type ?? staticType
    return type === 'BTN_PHYSICAL' || type === 'BTN_PUMPKIN'
  }

  /** Una sola palabra (Ground, Calentador…) no salta de línea; varias sí (Luz Blanca, Pantalla SCLK…) */
  function wordClass(label: string): string {
    return label.trim().split(/\s+/).length > 1 ? 'wrap' : 'nowrap'
  }

  async function handlePinClick(physPin: number, staticType: string) {
    if (!isCtrl(physPin, staticType)) return
    const dbPin = getDbPin(physPin)
    const type  = dbPin?.pin_type ?? staticType

    if (type === 'BTN_PHYSICAL' || type === 'BTN_PUMPKIN') {
      // Simular pulsación del botón físico
      try {
        await apiSimulatePress(physPin)
        addToast('ok', `⚡ ${dbPin?.name ?? `PIN ${physPin}`}: pulsación simulada`)
      } catch (e: unknown) {
        addToast('error', `Error simulando PIN ${physPin}`)
      }
      return
    }

    await togglePin(physPin)
    if (dbPin) {
      addToast(dbPin.current_state === 1 ? 'off' : 'on',
        `${dbPin.name} ${dbPin.current_state === 1 ? 'apagado' : 'encendido'}`)
    }
  }

  return (
    <div className="gpio-map">
      <div className="gpio-map-title">Raspberry Pi 4B — Conector J8 (40 pines)</div>

      <div className="gpio-map-body">
      <div className="gpio-connector">
        {cols.map(([odd, even]) => {
          const oddCtrl  = isCtrl(odd.pin, odd.type)
          const evenCtrl = isCtrl(even.pin, even.type)
          const oddOn    = isOn(odd.pin)
          const evenOn   = isOn(even.pin)

          return (
            <Fragment key={odd.pin}>
              {/* Top label (odd pin) */}
              <div
                className={`gpio-col-label top ${wordClass(getLabel(odd.pin, odd.label))}${oddCtrl ? ' ctrl' : ''}`}
                title={`PIN ${odd.pin} — ${getLabel(odd.pin, odd.label)}`}
              >
                {getLabel(odd.pin, odd.label)}
              </div>

              {/* Odd pin dot */}
              <div
                className={`gpio-pin-dot${oddCtrl ? ' ctrl' : ''}${oddCtrl && oddOn ? ' ctrl-on' : ''}${isPhysicalBtn(odd.pin, odd.type) ? ' btn-sim' : ''}`}
                style={{ background: getPinColor(odd.pin, odd.type) }}
                onClick={() => handlePinClick(odd.pin, odd.type)}
                title={isPhysicalBtn(odd.pin, odd.type) ? `⚡ Simular pulsación — ${getLabel(odd.pin, odd.label)}` : `PIN ${odd.pin}`}
              >
                <span className="gpio-pin-num">{odd.pin}</span>
              </div>

              {/* Even pin dot */}
              <div
                className={`gpio-pin-dot${evenCtrl ? ' ctrl' : ''}${evenCtrl && evenOn ? ' ctrl-on' : ''}${isPhysicalBtn(even.pin, even.type) ? ' btn-sim' : ''}`}
                style={{ background: getPinColor(even.pin, even.type) }}
                onClick={() => handlePinClick(even.pin, even.type)}
                title={isPhysicalBtn(even.pin, even.type) ? `⚡ Simular pulsación — ${getLabel(even.pin, even.label)}` : `PIN ${even.pin}`}
              >
                <span className="gpio-pin-num">{even.pin}</span>
              </div>

              {/* Bottom label (even pin) */}
              <div
                className={`gpio-col-label bottom ${wordClass(getLabel(even.pin, even.label))}${evenCtrl ? ' ctrl' : ''}`}
                title={`PIN ${even.pin} — ${getLabel(even.pin, even.label)}`}
              >
                {getLabel(even.pin, even.label)}
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Legend */}
      <div className="gpio-legend">
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--green)',  marginRight: 4, verticalAlign: 'middle' }} />GPIO ON</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#8a3040',       marginRight: 4, verticalAlign: 'middle' }} />GPIO OFF</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--c5v)',    marginRight: 4, verticalAlign: 'middle' }} />5V</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--c33v)',   marginRight: 4, verticalAlign: 'middle' }} />3.3V</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#4a5568',       marginRight: 4, verticalAlign: 'middle' }} />GND</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--cin)', outline: '2px dashed var(--amber)', outlineOffset: 1, marginRight: 4, verticalAlign: 'middle' }} />⚡ Clic = simular pulsación</span>
      </div>
      </div>
    </div>
  )
}
