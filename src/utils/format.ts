import type { EngineState, SetScore } from '@/types'

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

export function fmtDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export function setText(s: SetScore) {
  if (s.super) return `[${s.tiebreak?.[0]}-${s.tiebreak?.[1]}]`
  return `${s.games[0]}-${s.games[1]}${s.tiebreak ? `(${Math.min(...s.tiebreak)})` : ''}`
}

export const scoreline = (state: EngineState) => (state.sets.length ? state.sets.map(setText).join('  ') : '-')

/** Value for <input type="datetime-local"> from an ISO string (local time). */
export function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

export function errorMessage(e: unknown): string {
  if (!(e instanceof Error)) return 'Something went wrong'
  const d = (e as { details?: unknown }).details
  if (d && typeof d === 'object') {
    const first = Object.entries(d as Record<string, unknown>)[0]
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : JSON.stringify(first[1])}`
  }
  return e.message
}
