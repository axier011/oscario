import type { LogsResponse } from './types'

const BASE = '/api/v1'

export function getToken(): string | null {
  return localStorage.getItem('oscario-token')
}

export function clearToken(): void {
  localStorage.removeItem('oscario-token')
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error('No autenticado')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || res.statusText)
  }
  return res.json()
}

export async function apiTogglePin(pinNumber: number): Promise<void> {
  await request(`/gpio/toggle/${pinNumber}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'WEB_APP' }),
  })
}

export async function apiSetPin(pinNumber: number, state: number): Promise<void> {
  await request(`/gpio/set/${pinNumber}?state=${state}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'WEB_APP' }),
  })
}

export async function apiRenamePin(pinNumber: number, name: string): Promise<void> {
  await request(`/gpio/pin/${pinNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function apiSimulatePress(pinNumber: number): Promise<void> {
  await request(`/gpio/simulate-press/${pinNumber}`, { method: 'POST' })
}

export async function apiFetchLogs(
  page = 1,
  source?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<LogsResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: '50' })
  if (source)   params.set('source',    source)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo)   params.set('date_to',   dateTo)
  return request(`/logs?${params}`) as Promise<LogsResponse>
}

export async function apiRestart(): Promise<void> {
  await request('/system/restart', { method: 'POST' })
}

export async function apiLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Usuario o contraseña incorrectos')
  const data = await res.json() as { token: string }
  return data.token
}
