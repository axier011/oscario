// ─── Pin & log domain types ───────────────────────────────────────────────────
export interface Pin {
  pin_number: number
  bcm_number: number
  name: string
  pin_type: string
  is_active_low: number
  current_state: number
  updated_at: string
  hardware_state?: number
}

export interface LogEntry {
  pin_number: number
  name: string
  old_state: number
  new_state: number
  source: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface LogsResponse {
  logs: LogEntry[]
  page: number
  page_size: number
  total: number
  pages: number
}

// ─── UI enums / unions ────────────────────────────────────────────────────────
export type WsStatus = 'connecting' | 'connected' | 'disconnected'
export type Theme    = 'light' | 'dark' | 'auto'
export type TabId    = 'ctrl' | 'map' | 'hist' | 'settings'
export type ToastType = 'ok' | 'on' | 'off' | 'error'

export interface ToastItem {
  id: number
  type: ToastType
  msg: string
  exiting: boolean
}

// ─── Scene definition ─────────────────────────────────────────────────────────
export interface Scene {
  id: string
  label: string
  icon: string
  color: string
  /** Keywords: pin names containing these strings get turned ON */
  on: string[]
  /** Keywords: pin names containing these strings get turned OFF */
  off: string[]
}
