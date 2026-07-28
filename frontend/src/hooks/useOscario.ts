import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { apiRenamePin, apiSetPin, apiTogglePin } from '../api'
import { CTRL_TYPES, DEFAULT_VISIBLE, SCENES } from '../constants'
import type { LogEntry, Pin, ToastItem, ToastType, WsStatus } from '../types'

// ─── State shape ──────────────────────────────────────────────────────────────
export interface OscarioState {
  pins:          Record<number, Pin>
  logs:          LogEntry[]
  wsStatus:      WsStatus
  visiblePins:   number[]
  lastWaterTemp: number | null
  lastCpuTemp:   number | null
  activeScene:   string | null
  toasts:        ToastItem[]
  // actions
  togglePin:        (pinNumber: number) => Promise<void>
  setAllPins:       (state: number) => Promise<void>
  renamePin:        (pinNumber: number, name: string) => Promise<void>
  addToPanel:       (pinNumber: number) => void
  removeFromPanel:  (pinNumber: number) => void
  activateScene:    (sceneId: string) => Promise<void>
  addToast:         (type: ToastType, msg: string) => void
  removeToast:      (id: number) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────
export const OscarioCtx = createContext<OscarioState | null>(null)

export function useOsc(): OscarioState {
  const ctx = useContext(OscarioCtx)
  if (!ctx) throw new Error('useOsc must be used inside OscarioCtx.Provider')
  return ctx
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useOscario(): OscarioState {
  const [pins,          setPins]          = useState<Record<number, Pin>>({})
  const [logs,          setLogs]          = useState<LogEntry[]>([])
  const [wsStatus,      setWsStatus]      = useState<WsStatus>('connecting')
  const [lastWaterTemp, setLastWaterTemp] = useState<number | null>(null)
  const [lastCpuTemp,   setLastCpuTemp]   = useState<number | null>(null)
  const [activeScene,   setActiveScene]   = useState<string | null>(null)
  const [toasts,        setToasts]        = useState<ToastItem[]>([])

  const [visiblePins, setVisiblePinsState] = useState<number[]>(() => {
    try {
      const ver    = localStorage.getItem('osc-visible-v')
      const stored = localStorage.getItem('osc-visible')
      if (ver === '3' && stored) return JSON.parse(stored) as number[]
    } catch { /* ignore */ }
    return DEFAULT_VISIBLE
  })

  // Persist visiblePins to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('osc-visible',   JSON.stringify(visiblePins))
    localStorage.setItem('osc-visible-v', '3')
  }, [visiblePins])

  // ── Toast helpers ────────────────────────────────────────────────────────────
  const toastCounter = useRef(0)

  const addToast = useCallback((type: ToastType, msg: string) => {
    const id = ++toastCounter.current
    setToasts(prev => [...prev, { id, type, msg, exiting: false }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 350)
    }, 3000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350)
  }, [])

  // ── WebSocket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let delay      = 1_000
    let timerId:   ReturnType<typeof setTimeout> | null = null
    let ws:        WebSocket | null = null
    let unmounted  = false

    function connect() {
      if (unmounted) return
      const url = `ws://${window.location.host}/ws`
      ws = new WebSocket(url)
      setWsStatus('connecting')

      ws.onopen = () => {
        if (unmounted) { ws?.close(); return }
        setWsStatus('connected')
        delay = 1_000
      }

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (unmounted) return
        let msg: Record<string, unknown>
        try { msg = JSON.parse(ev.data) as Record<string, unknown> }
        catch { return }

        const event = msg['event'] as string | undefined

        if (event === 'INITIAL_STATE') {
          const rawPins = (msg['pins'] ?? []) as Pin[]
          const map: Record<number, Pin> = {}
          rawPins.forEach(p => { map[p.pin_number] = p })
          setPins(map)
          const recentLogs = (msg['recent_logs'] ?? []) as LogEntry[]
          setLogs(recentLogs)

        } else if (event === 'GPIO_TOGGLE') {
          const pinNum  = msg['pin_number'] as number
          const newSt   = msg['new_state']  as number
          const oldSt   = msg['old_state']  as number
          const name    = msg['name']       as string
          const source  = msg['source']     as string
          const ts      = msg['timestamp']  as string
          const meta    = msg['metadata']   as Record<string, unknown> | undefined

          setPins(prev => ({
            ...prev,
            [pinNum]: prev[pinNum]
              ? { ...prev[pinNum], current_state: newSt }
              : prev[pinNum],
          }))
          setLogs(prev => [
            { pin_number: pinNum, name, old_state: oldSt, new_state: newSt, source, metadata: meta, created_at: ts },
            ...prev,
          ].slice(0, 300))

        } else if (event === 'PIN_RENAMED') {
          const pinNum = msg['pin_number'] as number
          const name   = msg['name']       as string
          setPins(prev => ({
            ...prev,
            [pinNum]: prev[pinNum] ? { ...prev[pinNum], name } : prev[pinNum],
          }))

        } else if (event === 'SENSOR_DATA') {
          const sensorName = msg['sensor_name'] as string
          const value      = msg['value']       as number
          if (sensorName === 'DS18B20_Temperatura') setLastWaterTemp(value)
          if (sensorName === 'CPU_Temp')            setLastCpuTemp(value)
        }
      }

      ws.onclose = () => {
        if (unmounted) return
        setWsStatus('disconnected')
        timerId = setTimeout(() => {
          delay = Math.min(delay * 2, 30_000)
          connect()
        }, delay)
      }

      ws.onerror = () => { ws?.close() }
    }

    connect()

    return () => {
      unmounted = true
      if (timerId) clearTimeout(timerId)
      ws?.close()
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const togglePin = useCallback(async (pinNumber: number): Promise<void> => {
    try {
      await apiTogglePin(pinNumber)
    } catch {
      addToast('error', `Error al controlar pin ${pinNumber}`)
    }
  }, [addToast])

  const setAllPins = useCallback(async (state: number): Promise<void> => {
    const targets = Object.values(pins).filter(p =>
      CTRL_TYPES.has(p.pin_type) && visiblePins.includes(p.pin_number) && p.current_state !== state
    )
    for (const p of targets) {
      try { await apiSetPin(p.pin_number, state) }
      catch { /* continue */ }
    }
  }, [pins, visiblePins])

  const renamePin = useCallback(async (pinNumber: number, name: string): Promise<void> => {
    try {
      await apiRenamePin(pinNumber, name)
    } catch {
      addToast('error', `Error al renombrar pin ${pinNumber}`)
    }
  }, [addToast])

  const addToPanel = useCallback((pinNumber: number) => {
    setVisiblePinsState(prev => prev.includes(pinNumber) ? prev : [...prev, pinNumber])
  }, [])

  const removeFromPanel = useCallback((pinNumber: number) => {
    setVisiblePinsState(prev => prev.filter(n => n !== pinNumber))
  }, [])

  const activateScene = useCallback(async (sceneId: string): Promise<void> => {
    const scene = SCENES.find(s => s.id === sceneId)
    if (!scene) return
    setActiveScene(prev => prev === sceneId ? null : sceneId)
    const ctrlPins = Object.values(pins).filter(p => CTRL_TYPES.has(p.pin_type))
    for (const pin of ctrlPins) {
      const nameLow   = pin.name.toLowerCase()
      const shouldOn  = scene.on.some(kw  => nameLow.includes(kw.toLowerCase()))
      const shouldOff = scene.off.some(kw => nameLow.includes(kw.toLowerCase()))
      try {
        if (shouldOn  && pin.current_state === 0) await apiSetPin(pin.pin_number, 1)
        if (shouldOff && pin.current_state === 1) await apiSetPin(pin.pin_number, 0)
      } catch { /* continue */ }
    }
    // Alimentación: enciende luz blanca primero, luego impulso comedero
    if (sceneId === 'feed') {
      const luzBlanca = Object.values(pins).find(p => p.name.toLowerCase().includes('blanca'))
      const comedero  = Object.values(pins).find(p => p.name.toLowerCase().includes('comedero'))
      if (luzBlanca && luzBlanca.current_state === 0) {
        try { await apiSetPin(luzBlanca.pin_number, 1) } catch { /* ignore */ }
      }
      if (comedero) {
        await new Promise<void>(r => setTimeout(r, 500))
        try {
          await apiSetPin(comedero.pin_number, 1)
          await new Promise<void>(r => setTimeout(r, 1000))
          await apiSetPin(comedero.pin_number, 0)
        } catch { /* ignore */ }
      }
    }
  }, [pins])

  return {
    pins, logs, wsStatus, visiblePins, lastWaterTemp, lastCpuTemp, activeScene, toasts,
    togglePin, setAllPins, renamePin, addToPanel, removeFromPanel, activateScene,
    addToast, removeToast,
  }
}
