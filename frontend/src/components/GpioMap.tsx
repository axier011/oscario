import { useOsc } from '../hooks/useOscario'
import { CTRL_TYPES, GPIO_PINS, PM } from '../constants'
import type { Pin } from '../types'

export default function GpioMap() {
  const { pins, togglePin, addToast } = useOsc()

  // Build 20 rows of [oddPin, evenPin]
  const rows: [typeof GPIO_PINS[0], typeof GPIO_PINS[0]][] = []
  for (let i = 0; i < 20; i++) {
    rows.push([GPIO_PINS[i * 2], GPIO_PINS[i * 2 + 1]])
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

  async function handlePinClick(physPin: number, staticType: string) {
    if (!isCtrl(physPin, staticType)) return
    const dbPin = getDbPin(physPin)
    await togglePin(physPin)
    if (dbPin) {
      addToast(dbPin.current_state === 1 ? 'off' : 'on',
        `${dbPin.name} ${dbPin.current_state === 1 ? 'apagado' : 'encendido'}`)
    }
  }

  return (
    <div className="gpio-map">
      <div className="gpio-map-title">Raspberry Pi 4B — Conector J8 (40 pines)</div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="gpio-connector">
          {rows.map(([odd, even]) => {
            const oddCtrl  = isCtrl(odd.pin, odd.type)
            const evenCtrl = isCtrl(even.pin, even.type)
            const oddOn    = isOn(odd.pin)
            const evenOn   = isOn(even.pin)

            return (
              <div key={odd.pin} className="gpio-row">
                {/* Left label (odd pin) */}
                <div
                  className="gpio-row-label left"
                  style={{ color: oddCtrl ? 'var(--t1)' : 'var(--t2)' }}
                  title={`PIN ${odd.pin} — ${getLabel(odd.pin, odd.label)}`}
                >
                  {getLabel(odd.pin, odd.label)}
                </div>

                {/* Odd pin dot */}
                <div
                  className={`gpio-pin-dot${oddCtrl ? ' ctrl' : ''}${oddCtrl && oddOn ? ' ctrl-on' : ''}`}
                  style={{ background: getPinColor(odd.pin, odd.type) }}
                  onClick={() => handlePinClick(odd.pin, odd.type)}
                  title={`PIN ${odd.pin}`}
                >
                  <span className="gpio-pin-num">{odd.pin}</span>
                </div>

                {/* Even pin dot */}
                <div
                  className={`gpio-pin-dot${evenCtrl ? ' ctrl' : ''}${evenCtrl && evenOn ? ' ctrl-on' : ''}`}
                  style={{ background: getPinColor(even.pin, even.type) }}
                  onClick={() => handlePinClick(even.pin, even.type)}
                  title={`PIN ${even.pin}`}
                >
                  <span className="gpio-pin-num">{even.pin}</span>
                </div>

                {/* Right label (even pin) */}
                <div
                  className="gpio-row-label right"
                  style={{ color: evenCtrl ? 'var(--t1)' : 'var(--t2)' }}
                  title={`PIN ${even.pin} — ${getLabel(even.pin, even.label)}`}
                >
                  {getLabel(even.pin, even.label)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, justifyContent: 'center', fontSize: '.68rem', color: 'var(--t2)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--green)',  marginRight: 4, verticalAlign: 'middle' }} />GPIO ON</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#8a3040',       marginRight: 4, verticalAlign: 'middle' }} />GPIO OFF</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--c5v)',    marginRight: 4, verticalAlign: 'middle' }} />5V</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--c33v)',   marginRight: 4, verticalAlign: 'middle' }} />3.3V</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#4a5568',       marginRight: 4, verticalAlign: 'middle' }} />GND</span>
      </div>
    </div>
  )
}
