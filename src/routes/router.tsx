import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import AdminLayout from '@/layouts/AdminLayout'
import ScoringLayout from '@/layouts/ScoringLayout'
import { RequireAuth, RequireRole } from '@/features/auth/guards'

const Login = lazy(() => import('@/features/auth/LoginPage'))
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'))
const Matches = lazy(() => import('@/features/matches/MatchesPage'))
const MatchDetail = lazy(() => import('@/features/matches/MatchDetailPage'))
const LiveList = lazy(() => import('@/features/scoring/LiveScoringPage'))
const ScoreConsole = lazy(() => import('@/features/scoring/ScoreConsolePage'))
const Players = lazy(() => import('@/features/players/PlayersPage'))
const Teams = lazy(() => import('@/features/teams/TeamsPage'))
const Tournaments = lazy(() => import('@/features/tournaments/TournamentsPage'))
const TournamentDetail = lazy(() => import('@/features/tournaments/TournamentDetailPage'))
const Fixtures = lazy(() => import('@/features/fixtures/FixturesPage'))
const Standings = lazy(() => import('@/features/standings/StandingsPage'))
const Courts = lazy(() => import('@/features/settings/CourtsPage'))
const Umpires = lazy(() => import('@/features/settings/UmpiresPage'))
const Reports = lazy(() => import('@/features/reports/ReportsPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))

const Fallback = () => (
  <div className="flex h-64 items-center justify-center text-slate-400"><Spinner className="h-6 w-6" /></div>
)
const S = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<Fallback />}>{children}</Suspense>
const admin = (el: React.ReactNode) => <RequireRole roles={['super_admin', 'tournament_admin']}><S>{el}</S></RequireRole>

export const router = createBrowserRouter([
  { path: '/login', element: <S><Login /></S> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: admin(<Dashboard />) },
          { path: 'matches', element: <S><Matches /></S> },
          { path: 'matches/:id', element: <S><MatchDetail /></S> },
          { path: 'live', element: <S><LiveList /></S> },
          { path: 'players', element: admin(<Players />) },
          { path: 'teams', element: admin(<Teams />) },
          { path: 'tournaments', element: admin(<Tournaments />) },
          { path: 'tournaments/:id', element: admin(<TournamentDetail />) },
          { path: 'fixtures', element: admin(<Fixtures />) },
          { path: 'standings', element: admin(<Standings />) },
          { path: 'courts', element: admin(<Courts />) },
          { path: 'umpires', element: admin(<Umpires />) },
          { path: 'reports', element: admin(<Reports />) },
          { path: 'settings', element: <S><Settings /></S> },
        ],
      },
      { element: <ScoringLayout />, children: [{ path: 'score/:id', element: <S><ScoreConsole /></S> }] },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
