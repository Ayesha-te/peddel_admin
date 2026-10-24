import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: { ...actual.api, post: vi.fn() } }
})

import { ApiError, api } from '@/api/client'
import { applyPoint, initialState, normalizeConfig } from '@/features/scoring/engine'
import { ScoreSession } from '@/features/scoring/ScoreSession'
import type { EngineState, MatchConfig } from '@/types'

const cfg: MatchConfig = normalizeConfig({ bestOf: 1 })
const post = api.post as unknown as ReturnType<typeof vi.fn>

/** A tiny fake server that applies the real engine, enforces idempotency and revisions. */
function fakeServer() {
  let state = initialState(cfg)
  let revision = 0
  const seen = new Map<string, unknown>()
  const calls: { cid: string; expectedRevision: number; action: string }[] = []
  const snap = (): any => ({ publicId: 'X', status: state.completed ? 'completed' : 'live', revision, state, config: cfg, durationSeconds: 0, winnerIndex: state.winner, display: null })
  const handler = async (_p: string, body: any) => {
    calls.push({ cid: body.clientActionId, expectedRevision: body.expectedRevision, action: body.action })
    if (seen.has(body.clientActionId)) return seen.get(body.clientActionId)
    if (body.expectedRevision !== revision) throw new ApiError(409, 'stale_revision', 'stale', { currentRevision: revision, snapshot: snap() })
    if (body.action === 'point') state = applyPoint(cfg, state, body.team)
    revision++
    const res = { revision, eventId: revision, replayed: false, snapshot: snap() }
    seen.set(body.clientActionId, { ...res, replayed: true })
    return res
  }
  return { handler, calls, bump: (t: 0 | 1) => { state = applyPoint(cfg, state, t); revision++ }, get revision() { return revision }, get state() { return state } }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
const start = (state: EngineState = initialState(cfg), revision = 0) =>
  new ScoreSession(1, { status: 'live', revision, state, config: cfg, durationSeconds: 0 })

describe('ScoreSession', () => {
  beforeEach(() => { post.mockReset() })
  afterEach(() => vi.useRealTimers())

  it('renders a tap instantly (optimistic) before the server answers', () => {
    post.mockReturnValue(new Promise(() => {})) // never resolves
    const s = start()
    s.tap(0)
    const v = s.getSnapshot()
    expect(v.state.points).toEqual([1, 0])
    expect(v.pending).toBe(1)
    expect(v.sync).toBe('saving')
  })

  it('ignores accidental double-fires of the same button', () => {
    post.mockReturnValue(new Promise(() => {}))
    const s = start()
    s.tap(0)
    s.tap(0)
    expect(s.getSnapshot().pending).toBe(1)
    expect(s.getSnapshot().state.points).toEqual([1, 0])
  })

  it('sends actions one at a time with the confirmed revision, then shows "saved"', async () => {
    const server = fakeServer()
    post.mockImplementation(server.handler)
    const s = start()
    s.tap(0)
    await new Promise((r) => setTimeout(r, 130))
    s.tap(1)
    s.tap(0)
    await flush(); await flush(); await flush(); await flush()
    expect(server.calls.map((c) => c.expectedRevision)).toEqual([0, 1, 2])
    const v = s.getSnapshot()
    expect(v.sync).toBe('saved')
    expect(v.pending).toBe(0)
    expect(v.revision).toBe(3)
    expect(v.state.points).toEqual(server.state.points)
  })

  it('keeps an unconfirmed tap pending when offline and retries with the SAME clientActionId', async () => {
    vi.useFakeTimers()
    const server = fakeServer()
    let fail = true
    post.mockImplementation(async (p: string, b: any) => {
      if (fail) throw new ApiError(0, 'network', 'Network error')
      return server.handler(p, b)
    })
    const s = start()
    s.tap(0)
    await vi.advanceTimersByTimeAsync(10)
    let v = s.getSnapshot()
    expect(v.sync).toBe('offline')
    expect(v.pending).toBe(1) // never claimed as saved
    expect(v.state.points).toEqual([1, 0])
    fail = false
    await vi.advanceTimersByTimeAsync(1000)
    v = s.getSnapshot()
    expect(v.sync).toBe('saved')
    expect(v.revision).toBe(1)
    const ids = new Set(post.mock.calls.map((c) => (c[1] as any).clientActionId))
    expect(ids.size).toBe(1) // retries reuse one id => the server cannot count the point twice
    expect(server.state.points).toEqual([1, 0])
  })

  it('a lost response followed by a retry does not double count', async () => {
    vi.useFakeTimers()
    const server = fakeServer()
    let first = true
    post.mockImplementation(async (p: string, b: any) => {
      const res = await server.handler(p, b)
      if (first) { first = false; throw new ApiError(0, 'network', 'response lost') }
      return res
    })
    const s = start()
    s.tap(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(server.state.points).toEqual([1, 0])
    expect(server.revision).toBe(1)
    expect(s.getSnapshot().state.points).toEqual([1, 0])
    expect(s.getSnapshot().sync).toBe('saved')
  })

  it('discards obsolete queued taps when another device changed the score (stale revision)', async () => {
    const server = fakeServer()
    post.mockImplementation(server.handler)
    const s = start()
    server.bump(1) // someone else scored a point: server revision 1, we think 0
    s.tap(0)
    await new Promise((r) => setTimeout(r, 130))
    await flush(); await flush()
    const v = s.getSnapshot()
    expect(v.pending).toBe(0)
    expect(v.notice).toMatch(/another device/i)
    expect(v.state.points).toEqual([0, 1]) // adopted authoritative state, our tap not replayed
    expect(v.revision).toBe(1)
  })

  it('supports optimistic undo of points it knows about', async () => {
    const server = fakeServer()
    post.mockImplementation(server.handler)
    const s = start()
    s.tap(0)
    await flush(); await flush()
    s.undo()
    expect(s.getSnapshot().state.points).toEqual([0, 0]) // instantly
    await flush(); await flush()
    expect(s.getSnapshot().revision).toBe(2)
  })

  it('disables scoring once the match is completed', () => {
    let st = initialState(cfg)
    for (let i = 0; i < 24; i++) st = applyPoint(cfg, st, 0)
    const s = new ScoreSession(1, { status: 'completed', revision: 24, state: st, config: cfg, durationSeconds: 0 })
    expect(s.getSnapshot().canScore).toBe(false)
    s.tap(1)
    expect(s.getSnapshot().pending).toBe(0)
  })

  it('does not allow scoring while paused', () => {
    const s = new ScoreSession(1, { status: 'paused', revision: 3, state: initialState(cfg), config: cfg, durationSeconds: 0 })
    expect(s.getSnapshot().canScore).toBe(false)
  })

  it('definitive server rejection drops queued actions and asks the page to reconcile', async () => {
    const onReconcile = vi.fn()
    post.mockRejectedValue(new ApiError(409, 'match_paused', 'The match is paused'))
    const s = new ScoreSession(1, { status: 'live', revision: 0, state: initialState(cfg), config: cfg, durationSeconds: 0 }, onReconcile)
    s.tap(0)
    await flush(); await flush()
    expect(s.getSnapshot().pending).toBe(0)
    expect(s.getSnapshot().notice).toMatch(/paused/)
    expect(onReconcile).toHaveBeenCalled()
  })
})
