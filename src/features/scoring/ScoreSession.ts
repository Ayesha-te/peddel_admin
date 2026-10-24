/**
 * Client-side scoring session.
 *
 * - Taps render instantly (optimistic) by replaying the pending queue on top of the last CONFIRMED server state.
 * - Actions are sent strictly one at a time, each with a unique clientActionId and the revision it was based on.
 * - A network failure keeps the action queued and retries with the SAME clientActionId (server idempotency
 *   guarantees a retried request can never award a point twice).
 * - If the server says the revision is stale (another device scored), the queue is discarded and the
 *   authoritative state is adopted - obsolete taps are never replayed over newer scores.
 * - Nothing is ever shown as "saved" until the server confirmed it.
 */
import { ApiError, api, newActionId } from '@/api/client'
import type { Display, EngineState, MatchConfig, MatchStatus, ScoreResponse } from '@/types'
import { applyPoint, describe, setsWon } from './engine'

export type ActionKind = 'point' | 'undo' | 'pause' | 'resume' | 'end'

export interface PendingAction {
  cid: string
  action: ActionKind
  team?: 0 | 1
  winner?: 0 | 1
}

export type SyncState = 'saved' | 'saving' | 'offline' | 'error'

export interface Confirmed {
  status: MatchStatus
  revision: number
  state: EngineState
  config: MatchConfig
  durationSeconds: number
  receivedAt: number
}

export interface View {
  status: MatchStatus
  state: EngineState
  display: Display
  config: MatchConfig
  revision: number
  pending: number
  sync: SyncState
  notice: string | null
  canScore: boolean
  canUndo: boolean
  durationSeconds: number
  receivedAt: number
}

const MAX_QUEUE = 60
const BACKOFF = [800, 1500, 3000, 5000, 8000]

export class ScoreSession {
  private confirmed: Confirmed
  private queue: PendingAction[] = []
  private stack: EngineState[] = []
  private inflight = false
  private sync: SyncState = 'saved'
  private notice: string | null = null
  private retries = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<() => void>()
  private cache: View | null = null
  private lastTap = new Map<string, number>()
  private disposed = false

  constructor(private matchId: number, initial: Omit<Confirmed, 'receivedAt'>, private onReconcile?: () => void) {
    this.confirmed = { ...initial, receivedAt: Date.now() }
    if (typeof window !== 'undefined') window.addEventListener('online', this.handleOnline)
  }

  /** Called when the console unmounts. Unsent actions keep flushing in the background so leaving the page never loses taps. */
  dispose() {
    this.listeners.clear()
    if (this.queue.length === 0) {
      this.disposed = true
      if (this.timer) clearTimeout(this.timer)
      if (typeof window !== 'undefined') window.removeEventListener('online', this.handleOnline)
    }
  }

  get hasUnsaved() {
    return this.queue.length > 0
  }

  // ---- external store plumbing
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = (): View => {
    if (!this.cache) this.cache = this.computeView()
    return this.cache
  }
  private emit() {
    this.cache = null
    this.listeners.forEach((l) => l())
  }

  // ---- view
  private computeView(): View {
    const cfg = this.confirmed.config
    let state = this.confirmed.state
    let status = this.confirmed.status
    const local = [...this.stack]
    for (const a of this.queue) {
      if (a.action === 'point' && !state.completed) {
        local.push(state)
        state = applyPoint(cfg, state, a.team as 0 | 1)
        if (state.completed) status = 'completed'
        else if (status !== 'paused') status = 'live'
      } else if (a.action === 'undo') {
        const prev = local.pop()
        if (prev) {
          state = prev
          if (status === 'completed') status = 'live'
        }
      } else if (a.action === 'pause') status = 'paused'
      else if (a.action === 'resume') status = 'live'
      else if (a.action === 'end') {
        state = { ...state, completed: true, winner: a.winner ?? state.winner }
        status = 'completed'
      }
    }
    const scorable = ['scheduled', 'ready', 'live'].includes(status) && !state.completed
    return {
      status,
      state,
      display: describe(cfg, state),
      config: cfg,
      revision: this.confirmed.revision,
      pending: this.queue.length,
      sync: this.sync,
      notice: this.notice,
      canScore: scorable && this.queue.length < MAX_QUEUE,
      canUndo: this.queue.length < MAX_QUEUE && (local.length > 0 || state.sets.length > 0 || state.games[0] + state.games[1] + state.points[0] + state.points[1] > 0),
      durationSeconds: this.confirmed.durationSeconds,
      receivedAt: this.confirmed.receivedAt,
    }
  }

  clearNotice() {
    this.notice = null
    this.emit()
  }

  // ---- user intents
  /** Ignores accidental double-fires of the same control within 120 ms (hardware/touch bounce). */
  private debounced(key: string) {
    const now = performance.now()
    if (now - (this.lastTap.get(key) ?? -1e9) < 120) return true
    this.lastTap.set(key, now)
    return false
  }

  tap(team: 0 | 1) {
    if (this.debounced(`p${team}`)) return
    if (!this.getSnapshot().canScore) return
    this.enqueue({ cid: newActionId(), action: 'point', team })
  }
  undo() {
    if (this.debounced('undo') || !this.getSnapshot().canUndo) return
    this.enqueue({ cid: newActionId(), action: 'undo' })
  }
  pause() {
    if (this.debounced('pause')) return
    this.enqueue({ cid: newActionId(), action: 'pause' })
  }
  resume() {
    if (this.debounced('resume')) return
    this.enqueue({ cid: newActionId(), action: 'resume' })
  }
  end(winner?: 0 | 1) {
    if (this.debounced('end')) return
    this.enqueue({ cid: newActionId(), action: 'end', winner })
  }

  /** Adopt a newer authoritative snapshot (WebSocket / refetch) when nothing is in flight. */
  adopt(snap: Omit<Confirmed, 'receivedAt'>) {
    if (this.queue.length || this.inflight || snap.revision <= this.confirmed.revision) return
    this.confirmed = { ...snap, receivedAt: Date.now() }
    this.stack = []
    this.emit()
  }

  /** Force-adopt (explicit reload from server). Pending local actions are discarded. */
  reset(snap: Omit<Confirmed, 'receivedAt'>) {
    this.confirmed = { ...snap, receivedAt: Date.now() }
    this.queue = []
    this.stack = []
    this.sync = 'saved'
    this.retries = 0
    this.emit()
  }

  retryNow() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.retries = 0
    void this.pump()
  }

  // ---- sending
  private enqueue(a: PendingAction) {
    this.notice = null
    this.queue.push(a)
    this.sync = this.sync === 'offline' || this.sync === 'error' ? this.sync : 'saving'
    this.emit()
    void this.pump()
  }

  private handleOnline = () => this.retryNow()

  private async pump() {
    if (this.inflight || this.disposed || this.queue.length === 0) return
    this.inflight = true
    const item = this.queue[0]
    if (this.sync === 'saved') this.sync = 'saving'
    this.emit()
    try {
      const res = await api.post<ScoreResponse>(`/api/admin/matches/${this.matchId}/score/`, {
        action: item.action,
        clientActionId: item.cid,
        team: item.team,
        winner: item.winner,
        expectedRevision: this.confirmed.revision,
      })
      this.onConfirmed(item, res)
    } catch (e) {
      this.onFailure(item, e)
    }
  }

  private onConfirmed(item: PendingAction, res: ScoreResponse) {
    const prevState = this.confirmed.state
    if (item.action === 'point') this.stack.push(prevState)
    else if (item.action === 'undo') this.stack.pop()
    if (res.snapshot.revision >= this.confirmed.revision) {
      this.confirmed = {
        status: res.snapshot.status,
        revision: res.snapshot.revision,
        state: res.snapshot.state,
        config: res.snapshot.config,
        durationSeconds: res.snapshot.durationSeconds,
        receivedAt: Date.now(),
      }
    }
    this.queue.shift()
    this.inflight = false
    this.retries = 0
    this.sync = this.queue.length ? 'saving' : 'saved'
    this.emit()
    if (this.listeners.size === 0 && this.queue.length === 0) this.dispose() // detached session finished flushing
    void this.pump()
  }

  private onFailure(item: PendingAction, e: unknown) {
    this.inflight = false
    const err = e instanceof ApiError ? e : new ApiError(0, 'network', 'Network error')
    const transient = err.isNetwork || err.status >= 500 || err.status === 429 || err.status === 408
    if (transient) {
      this.sync = err.isNetwork ? 'offline' : 'error'
      this.emit()
      const delay = BACKOFF[Math.min(this.retries++, BACKOFF.length - 1)]
      this.timer = setTimeout(() => void this.pump(), delay) // same clientActionId => safe retry
      return
    }
    if (err.code === 'stale_revision') {
      const snap = (err.details as { snapshot?: ScoreResponse['snapshot'] } | null)?.snapshot
      const dropped = this.queue.length
      this.queue = []
      this.stack = []
      if (snap) {
        this.confirmed = {
          status: snap.status, revision: snap.revision, state: snap.state, config: snap.config,
          durationSeconds: snap.durationSeconds, receivedAt: Date.now(),
        }
      }
      this.notice = `The score was changed on another device. Your ${dropped} unsaved ${dropped === 1 ? 'tap was' : 'taps were'} discarded - check the score.`
      this.sync = 'saved'
      this.emit()
      return
    }
    // Definitive rejection: drop this and everything queued after it, then reload truth from the server.
    const dropped = this.queue.length
    this.queue = []
    this.notice = `${err.message}${dropped > 1 ? ` (${dropped} queued actions were not applied)` : ''}`
    this.sync = 'error'
    this.emit()
    this.onReconcile?.()
    void item
  }

  /** Winner shown when ending a level match must be chosen by the operator. */
  levelAfterQueue(): boolean {
    const [a, b] = setsWon(this.getSnapshot().state)
    return a === b
  }
}
