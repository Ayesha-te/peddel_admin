import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: { ...actual.api, post: vi.fn() } }
})

import { api } from '@/api/client'
import { applyPoint, describe as describeState, initialState, normalizeConfig } from '@/features/scoring/engine'
import { useScoreSession } from '@/features/scoring/hooks'
import type { Match } from '@/types'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const cfg = normalizeConfig({ bestOf: 5 })
const match = {
  id: 5, publicId: 'ABC', status: 'scheduled', revision: 0, config: cfg, state: initialState(cfg), display: describeState(cfg, initialState(cfg)),
  durationSeconds: 0, teams: [],
} as unknown as Match

describe('useScoreSession', () => {
  beforeEach(() => { post.mockReset() })

  it('still sends taps when React StrictMode mounts, tears down and mounts again (data already cached)', async () => {
    post.mockImplementation(async (_p: string, b: { team: 0 | 1 }) => ({
      revision: 1, eventId: 1, replayed: false,
      snapshot: { status: 'live', revision: 1, state: applyPoint(cfg, initialState(cfg), b.team), config: cfg, durationSeconds: 0, publicId: 'ABC', winnerIndex: null, display: null },
    }))
    // `match` is available on the very first render, exactly like arriving from the match page with a warm cache
    const { result } = renderHook(() => useScoreSession(match, () => undefined), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.session).not.toBeNull())
    act(() => result.current.session!.tap(0))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.view?.sync).toBe('saved'))
    expect(post.mock.calls[0][1]).toMatchObject({ action: 'point', team: 0, expectedRevision: 0 })
    expect(result.current.view?.revision).toBe(1)
  })

  it('creates a new session when the match id changes and disposes the old one', async () => {
    const { result, rerender } = renderHook(({ m }) => useScoreSession(m, () => undefined), { initialProps: { m: match } })
    await waitFor(() => expect(result.current.session).not.toBeNull())
    const first = result.current.session
    rerender({ m: { ...match, id: 6 } as Match })
    await waitFor(() => expect(result.current.session).not.toBe(first))
    expect(first!.hasUnsaved).toBe(false)
  })
})
