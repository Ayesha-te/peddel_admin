import { useAuth } from '@/store/auth'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
export const PUBLIC_SITE = (import.meta.env.VITE_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  details: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
  /** True when the request never produced a server response (offline, DNS, CORS, timeout). */
  get isNetwork() {
    return this.status === 0
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

export function qs(params?: Query) {
  if (!params) return ''
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

let refreshing: Promise<boolean> | null = null

async function refreshAccess(): Promise<boolean> {
  const { refresh, setTokens, logout } = useAuth.getState()
  if (!refresh) return false
  refreshing ??= (async () => {
    try {
      const r = await fetch(`${API_BASE}/api/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!r.ok) {
        logout()
        return false
      }
      const data = await r.json()
      setTokens(data.access, data.refresh)
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

interface Opts {
  method?: string
  body?: unknown
  query?: Query
  signal?: AbortSignal
  timeoutMs?: number
  raw?: boolean
}

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const e = body?.error
  return new ApiError(res.status, e?.code ?? 'error', e?.message ?? res.statusText ?? 'Request failed', e?.details)
}

export async function request<T>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, query, signal, timeoutMs = 20000, raw } = opts
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const attempt = async (): Promise<Response> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    signal?.addEventListener('abort', () => ctrl.abort())
    try {
      const headers: Record<string, string> = {}
      const token = useAuth.getState().access
      if (token) headers.Authorization = `Bearer ${token}`
      if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
      return await fetch(`${API_BASE}${path}${qs(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
        signal: ctrl.signal,
      })
    } catch {
      throw new ApiError(0, 'network', 'Network error. Check your connection.')
    } finally {
      clearTimeout(timer)
    }
  }

  let res = await attempt()
  if (res.status === 401 && useAuth.getState().refresh && !path.startsWith('/api/auth/')) {
    if (await refreshAccess()) res = await attempt()
  }
  if (!res.ok) {
    if (res.status === 401) useAuth.getState().logout()
    throw await parseError(res)
  }
  if (raw) return res as unknown as T
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, o?: Opts) => request<T>(path, { method: 'POST', body: body ?? {}, ...o }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Authenticated file download (PDF etc). Never exposes the token in a URL. */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await request<Response>(path, { raw: true, timeoutMs: 60000 })
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') ?? ''
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Blob object URL for an authenticated image (QR code). */
export async function fetchBlobUrl(path: string) {
  const res = await request<Response>(path, { raw: true })
  return URL.createObjectURL(await res.blob())
}

/** Media URLs: private images need a short-lived token query param. */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return null
  const t = useAuth.getState().access
  return `${API_BASE}${path}${t ? `?t=${encodeURIComponent(t)}` : ''}`
}

export function newActionId() {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(16).slice(2)}`
  return `a-${rnd}`.slice(0, 40)
}
