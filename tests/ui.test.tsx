import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const role = { current: 'tournament_admin' as 'super_admin' | 'tournament_admin' | 'umpire' }

vi.mock('@/features/auth/guards', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/guards')>('@/features/auth/guards')
  return { ...actual, useRole: () => ({ role: role.current, isSuper: role.current === 'super_admin', isAdmin: role.current !== 'umpire', isUmpire: role.current === 'umpire' }) }
})

import { normalizeConfig, initialState, describe as describeState } from '@/features/scoring/engine'
import { Scoreboard } from '@/features/scoring/Scoreboard'
import { RequireRole } from '@/features/auth/guards'
import { useAuth } from '@/store/auth'
import { TournamentReportButtons } from '@/features/reports/DownloadButtons'
import type { Match, Tournament } from '@/types'

const cfg = normalizeConfig({ bestOf: 3 })
const state = initialState(cfg)
const teams = [
  { id: 1, name: 'Alpha', players: [{ id: 1, name: 'Ann Lee' }, { id: 2, name: 'Bo Kim' }] },
  { id: 2, name: 'Bravo', players: [{ id: 3, name: 'Cy Ray' }, { id: 4, name: 'Di Fox' }] },
] as Match['teams']

const current = { status: 'completed' as Match['status'] }
const match = (over: Partial<Match> = {}): Match => ({
  id: 7, publicId: 'ABCDEFGHIJ', reference: 'MATCH7', name: 'Final', status: 'completed', isPublic: true, tournament: null, teams, court: null, umpire: null,
  scheduledAt: null, config: cfg, revision: 5, state: { ...state, completed: true, winner: 0 }, display: describeState(cfg, state), durationSeconds: 60,
  winnerIndex: 0, resultVerified: false, startedAt: null, completedAt: null, shareUrl: 'http://x/matches/ABCDEFGHIJ', createdAt: '', ...over,
})

vi.mock('@/hooks/query', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/query')>('@/hooks/query')
  return {
    ...actual,
    useGet: (path: string) => ({ data: path?.includes('history') ? { events: [] } : match({ status: current.status }), isLoading: false, error: null, refetch: vi.fn() }),
    useSave: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

import MatchDetailPage from '@/features/matches/MatchDetailPage'

const renderDetail = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/matches/7']}><Routes><Route path="/matches/:id" element={<MatchDetailPage />} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  )

describe('Scoreboard', () => {
  it('shows team names, four player names and point labels', () => {
    render(<Scoreboard teams={teams} state={state} display={describeState(cfg, state)} />)
    for (const n of ['Alpha', 'Bravo']) expect(screen.getByText(n)).toBeInTheDocument()
    expect(screen.getByText(/Ann Lee/)).toBeInTheDocument()
    expect(screen.getByText(/Di Fox/)).toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2)
  })
  it('shows the serving indicator for exactly one team', () => {
    render(<Scoreboard teams={teams} state={state} display={describeState(cfg, state)} />)
    expect(screen.getAllByLabelText('Serving')).toHaveLength(1)
  })
})

describe('PDF controls are administrator-only', () => {
  beforeEach(() => { role.current = 'tournament_admin'; current.status = 'completed' })

  it('admins see the Match Result PDF button on the match page', () => {
    renderDetail()
    expect(screen.getByRole('button', { name: /download match result pdf/i })).toBeEnabled()
  })
  it('the button is disabled until the match is completed', () => {
    role.current = 'super_admin'
    current.status = 'live'
    renderDetail()
    expect(screen.getByRole('button', { name: /download match result pdf/i })).toBeDisabled()
  })
  it('umpires never get a PDF button or admin panel', () => {
    role.current = 'umpire'
    renderDetail()
    expect(screen.queryByRole('button', { name: /pdf/i })).toBeNull()
    expect(screen.queryByText('Administration')).toBeNull()
  })
  it('tournament report button is labelled as progress until the tournament is complete', () => {
    const t = { id: 1, slug: 'cup', status: 'published', champion: null } as unknown as Tournament
    const { rerender } = render(<TournamentReportButtons t={t} />)
    expect(screen.getByRole('button', { name: /progress pdf/i })).toBeInTheDocument()
    expect(screen.getByText(/provisional progress report/i)).toBeInTheDocument()
    rerender(<TournamentReportButtons t={{ ...t, status: 'completed', champion: 3 } as unknown as Tournament} />)
    expect(screen.getByRole('button', { name: /tournament results pdf/i })).toBeInTheDocument()
  })
})

describe('role guard', () => {
  it('redirects umpires away from admin-only pages', () => {
    role.current = 'umpire'
    useAuth.setState({ user: { id: 1, role: 'umpire' } as any })
    render(
      <MemoryRouter initialEntries={['/players']}>
        <Routes>
          <Route path="/players" element={<RequireRole roles={['super_admin', 'tournament_admin']}><p>secret admin page</p></RequireRole>} />
          <Route path="/live" element={<p>live page</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByText('secret admin page')).toBeNull()
    expect(screen.getByText('live page')).toBeInTheDocument()
  })
})
