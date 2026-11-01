export type Role = 'super_admin' | 'tournament_admin' | 'umpire'

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  display_name: string
  role: Role
  phone: string
  is_active: boolean
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Player {
  id: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  photo_url: string | null
  show_photo_publicly: boolean
  created_at: string
}

export interface Team {
  id: number
  name: string
  players: { id: number; full_name: string }[]
  created_at: string
}

export interface Court {
  id: number
  name: string
  venue: string
  is_active: boolean
}

export type MatchStatus = 'draft' | 'scheduled' | 'ready' | 'live' | 'paused' | 'completed' | 'cancelled'

export interface SetScore {
  games: [number, number]
  tiebreak: [number, number] | null
  super: boolean
}

export interface MatchConfig {
  bestOf: 1 | 3 | 5
  goldenPoint: boolean
  tiebreakEnabled: boolean
  tiebreakAt: number
  tiebreakPoints: number
  superTiebreak: boolean
  superTiebreakPoints: number
  gamesPerSet: number
  firstServer: 0 | 1
}

export interface EngineState {
  sets: SetScore[]
  games: [number, number]
  points: [number, number]
  inTiebreak: boolean
  isSuper: boolean
  tiebreakTarget: number
  tbFirstServer: 0 | 1 | null
  server: 0 | 1
  winner: 0 | 1 | null
  completed: boolean
}

export interface Display {
  pointLabels: [string, string]
  pointKind: 'normal' | 'deuce' | 'advantage' | 'golden' | 'tiebreak' | 'super'
  matchPointFor: (0 | 1)[]
  setPointFor: (0 | 1)[]
  setsWon: [number, number]
}

export interface MatchTeam {
  id: number | null
  name: string
  players: { id: number; name: string }[]
}

export interface Match {
  id: number
  publicId: string
  reference: string
  name: string
  status: MatchStatus
  isPublic: boolean
  tournament: { id: number; name: string; slug: string } | null
  teams: [MatchTeam, MatchTeam]
  court: { id: number; name: string } | null
  umpire: { id: number; name: string } | null
  scheduledAt: string | null
  config: MatchConfig
  revision: number
  state: EngineState
  display: Display
  durationSeconds: number
  winnerIndex: 0 | 1 | null
  resultVerified: boolean
  startedAt: string | null
  completedAt: string | null
  shareUrl: string
  createdAt: string
}

/** Server response to a scoring action. */
export interface ScoreResponse {
  revision: number
  eventId: number
  replayed: boolean
  snapshot: {
    publicId: string
    status: MatchStatus
    revision: number
    state: EngineState
    config: MatchConfig
    durationSeconds: number
    winnerIndex: 0 | 1 | null
    display: Display
  }
}

export type TournamentFormat = 'round_robin' | 'groups_knockout' | 'single_elimination'
export type TournamentStatus = 'draft' | 'published' | 'completed' | 'archived' | 'cancelled'

export interface Tournament {
  id: number
  name: string
  slug: string
  logo_url: string | null
  cover_url: string | null
  description: string
  venue: string
  start_date: string | null
  end_date: string | null
  registration_deadline: string | null
  organizer: string
  rules: string
  format: TournamentFormat
  status: TournamentStatus
  visibility: 'public' | 'private'
  match_format: Partial<MatchConfig>
  ranking_criteria: string[]
  points_win: number
  points_loss: number
  groups_count: number
  qualifiers_per_group: number
  champion: number | null
  champion_name: string | null
  teams_count: number
  matches_total: number
  matches_completed: number
  fixtures_confirmed_at: string | null
}

export interface Registration {
  id: number
  team: Team
  group_name: string | null
  seed: number
  withdrawn: boolean
}

export interface Fixture {
  id: number
  stage: 'group' | 'knockout'
  group_name: string | null
  round_number: number
  round_name: string
  position: number
  is_bye: boolean
  team_a_name: string
  team_b_name: string
  match: null | {
    id: number
    status: MatchStatus
    scheduledAt: string | null
    court: string | null
    umpire: string | null
    sets: SetScore[]
    winnerIndex: 0 | 1 | null
  }
}

export interface Standing {
  group_name: string
  rank: number
  team_id: number
  team_name: string
  played: number
  wins: number
  losses: number
  points: number
  sets_for: number
  sets_against: number
  games_for: number
  games_against: number
  set_difference: number
  game_difference: number
  qualified: boolean
}

export interface FixturePlan {
  seed: number
  format: TournamentFormat
  groups: { name: string; teams: string[] }[]
  group_fixtures: { group: string; round: number; team_a_name: string; team_b_name: string }[]
  knockout: { round: number; round_name: string; slot_a: { label: string }; slot_b: { label: string }; is_bye: boolean }[]
  warnings: string[]
  counts: { groups: number; group_matches: number; knockout_matches: number }
  existing_fixtures: number
  has_started_matches: boolean
}

export interface DashboardData {
  totals: { tournaments: number; upcomingMatches: number; liveMatches: number; completedMatches: number; players: number; teams: number }
  upcoming: Match[]
  live: Match[]
  recentActivity: { id: number; actor: string; action: string; objectType: string; objectId: string; at: string }[]
}

export interface AuditEntry {
  id: number
  actor_name: string
  action: string
  object_type: string
  object_id: string
  details: Record<string, unknown>
  created_at: string
}
