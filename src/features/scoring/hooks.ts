import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { API_BASE } from '@/api/client'
import type { Match } from '@/types'
import { ScoreSession, type Confirmed } from './ScoreSession'

export function toConfirmed(m: Pick<Match, 'status' | 'revision' | 'state' | 'config' | 'durationSeconds'>): Omit<Confirmed, 'receivedAt'> {
  return { status: m.status, revision: m.revision, state: m.state, config: m.config, durationSeconds: m.durationSeconds }
}

export function useScoreSession(match: Match | undefined, onReconcile: () => void) {
  const [session, setSession] = useState<ScoreSession | null>(null)
  const reconcile = useRef(onReconcile)
  reconcile.current = onReconcile
  const id = match?.id
  const seeded = useRef<number | null>(null)

  useEffect(() => {
    if (!match || id === undefined || seeded.current === id) return
    seeded.current = id
    const s = new ScoreSession(id, toConfirmed(match), () => reconcile.current())
    setSession(s)
    return () => s.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!match])

  const view = useSyncExternalStore(
    session ? session.subscribe : () => () => {},
    session ? session.getSnapshot : () => null,
  )
  return { session, view }
}

export function wsBase() {
  const explicit = import.meta.env.VITE_WS_BASE_URL as string | undefined
  if (explicit) return explicit.replace(/\/$/, '')
  return API_BASE.replace(/^http/, 'ws')
}

/** Read-only spectator socket: lets a second scorer/viewer device see changes made elsewhere. */
export function useMatchSocket(publicId: string | undefined, onSnapshot: (s: any) => void) {
  const [connected, setConnected] = useState(false)
  const cb = useRef(onSnapshot)
  cb.current = onSnapshot
  useEffect(() => {
    if (!publicId) return
    let ws: WebSocket | null = null
    let stop = false
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const open = () => {
      try {
        ws = new WebSocket(`${wsBase()}/ws/matches/${publicId}/`)
      } catch {
        return
      }
      ws.onopen = () => { tries = 0; setConnected(true) }
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data)
          if (m.snapshot) cb.current(m.snapshot)
        } catch { /* ignore malformed */ }
      }
      ws.onclose = (ev) => {
        setConnected(false)
        if (stop || ev.code === 4404) return
        timer = setTimeout(open, Math.min(1000 * 2 ** tries++, 15000))
      }
      ws.onerror = () => ws?.close()
    }
    open()
    return () => { stop = true; clearTimeout(timer); ws?.close() }
  }, [publicId])
  return connected
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

/** Ticking match clock derived from the server's duration at receipt time. */
export function useClock(running: boolean, baseSeconds: number, receivedAt: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  return running ? baseSeconds + (now - receivedAt) / 1000 : baseSeconds
}
