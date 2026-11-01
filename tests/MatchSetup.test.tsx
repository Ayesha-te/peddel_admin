import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: { ...actual.api, post: vi.fn() } }
})

import { api } from '@/api/client'
import { applyPoint, describe as describeState, initialState, normalizeConfig } from '@/features/scoring/engine'
import { MatchSetup } from '@/features/scoring/MatchSetup'
import type { Match } from '@/types'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const cfg = normalizeConfig({ bestOf: 3 })
const match = {
  id: 9, name: 'Final', config: cfg, state: initialState(cfg), display: describeState(cfg, initialState(cfg)),
  teams: [{ id: 1, name: 'Alpha', players: [] }, { id: 2, name: 'Bravo', players: [] }],
} as unknown as Match

describe('MatchSetup (umpire decides the format at match time)', () => {
  beforeEach(() => { post.mockReset() })

  it('offers best of 1, 3 and 5 and starts with the default', async () => {
    post.mockResolvedValue({ ...match })
    const onStarted = vi.fn()
    render(<MatchSetup match={match} onStarted={onStarted} />)
    const group = screen.getByRole('radiogroup', { name: /number of sets/i })
    expect(group.querySelectorAll('[role=radio]')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /best of 3/i })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: /start match/i }))
    await waitFor(() => expect(onStarted).toHaveBeenCalled())
    expect(post.mock.calls[0][0]).toBe('/api/admin/matches/9/rules/')
    expect(post.mock.calls[0][1]).toMatchObject({ bestOf: 3 })
  })

  it('sends best of 5 when the umpire chooses it, with the other options', async () => {
    post.mockResolvedValue({ ...match })
    render(<MatchSetup match={match} onStarted={vi.fn()} />)
    await userEvent.click(screen.getByRole('radio', { name: /best of 5/i }))
    expect(screen.getByRole('radio', { name: /best of 5/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: /start match · best of 5 sets/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /golden point/i }))
    await userEvent.click(screen.getByRole('switch', { name: /super tie-break/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Bravo' })) // Bravo serves first
    await userEvent.click(screen.getByRole('button', { name: /start match/i }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toEqual({ bestOf: 5, goldenPoint: true, tiebreakEnabled: true, superTiebreak: true, firstServer: 1 })
  })

  it('offers deuce and golden point as an explicit choice (deuce by default)', async () => {
    post.mockResolvedValue({ ...match })
    render(<MatchSetup match={match} onStarted={vi.fn()} />)
    const group = screen.getByRole('radiogroup', { name: /game format at 40-40/i })
    expect(group.querySelectorAll('[role=radio]')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: /deuce/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /golden point/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: /start match.*deuce/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /golden point/i }))
    expect(screen.getByRole('radio', { name: /golden point/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /deuce/i })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: /start match.*golden point/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^deuce/i }))
    await userEvent.click(screen.getByRole('button', { name: /start match/i }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toMatchObject({ goldenPoint: false })
  })

  it('shows the format the tournament defined as the starting point', () => {
    const golden = { ...match, config: { ...cfg, bestOf: 5, goldenPoint: true } } as Match
    render(<MatchSetup match={golden} onStarted={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /best of 5/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /golden point/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('lets the umpire type any number of sets (e.g. 8) and sends it', async () => {
    post.mockResolvedValue({ ...match })
    render(<MatchSetup match={match} onStarted={vi.fn()} />)
    const box = screen.getByRole('spinbutton', { name: /custom number of sets/i })
    await userEvent.clear(box)
    await userEvent.type(box, '8')
    expect(screen.getByText(/first to win 5 sets/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start match · best of 8 sets/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /start match/i }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toMatchObject({ bestOf: 8 })
  })

  it('best of 1 hides the super tie-break option and never sends it', async () => {
    post.mockResolvedValue({ ...match })
    render(<MatchSetup match={{ ...match, config: { ...cfg, superTiebreak: true } } as Match} onStarted={vi.fn()} />)
    await userEvent.click(screen.getByRole('radio', { name: /best of 1/i }))
    expect(screen.queryByRole('switch', { name: /super tie-break/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /start match/i }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0][1]).toMatchObject({ bestOf: 1, superTiebreak: false })
  })

  it('shows an error and does not start when the server refuses (e.g. first point already played)', async () => {
    post.mockRejectedValue(new Error('The rules are locked once the first point has been played.'))
    const onStarted = vi.fn()
    render(<MatchSetup match={match} onStarted={onStarted} />)
    await userEvent.click(screen.getByRole('button', { name: /start match/i }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(onStarted).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /start match/i })).toBeEnabled() // can retry
  })
})

describe('engine: best of 5', () => {
  const c = normalizeConfig({ bestOf: 5 })
  const winSet = (s: ReturnType<typeof initialState>, team: 0 | 1) => { for (let i = 0; i < 24; i++) s = applyPoint(c, s, team); return s }

  it('needs three sets and is not decided at 2-0 or 2-2', () => {
    let s = initialState(c)
    s = winSet(s, 0); s = winSet(s, 0)
    expect(s.completed).toBe(false)
    s = winSet(s, 1); s = winSet(s, 1)
    expect(s.completed).toBe(false)
    s = winSet(s, 1)
    expect(s.completed && s.winner === 1 && s.sets.length === 5).toBe(true)
  })
  it('accepts any whole number of sets from 1 to 21 only', () => {
    expect(() => normalizeConfig({ bestOf: 22 as never })).toThrow()
    expect(normalizeConfig({ bestOf: 7 }).bestOf).toBe(7)
    expect(normalizeConfig({ bestOf: 5, superTiebreak: true }).superTiebreak).toBe(true)
    expect(normalizeConfig({ bestOf: 1, superTiebreak: true }).superTiebreak).toBe(false)
  })
})
