/**
 * Pure TypeScript twin of backend/apps/scoring/engine.py.
 * It is used ONLY for optimistic rendering; the backend is the source of truth.
 * tests/engine.contract.test.ts replays backend/tests/fixtures/scoring_contract.json against this file.
 */
import type { Display, EngineState, MatchConfig } from '@/types'

export const DEFAULT_CONFIG: MatchConfig = {
  bestOf: 3,
  goldenPoint: false,
  tiebreakEnabled: true,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  superTiebreak: false,
  superTiebreakPoints: 10,
  gamesPerSet: 6,
  firstServer: 0,
}

const LABELS = ['0', '15', '30', '40']

export class EngineError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export function normalizeConfig(cfg: Partial<MatchConfig> = {}): MatchConfig {
  const c = { ...DEFAULT_CONFIG, ...cfg }
  if (typeof c.bestOf !== 'number' || !Number.isInteger(c.bestOf) || c.bestOf < 1 || c.bestOf > 21) throw new EngineError('invalid_config', 'bestOf must be a whole number between 1 and 21')
  c.goldenPoint = !!c.goldenPoint
  c.tiebreakEnabled = !!c.tiebreakEnabled
  c.superTiebreak = !!c.superTiebreak && c.bestOf > 1
  return c
}

export function initialState(cfg: MatchConfig): EngineState {
  return {
    sets: [],
    games: [0, 0],
    points: [0, 0],
    inTiebreak: false,
    isSuper: false,
    tiebreakTarget: 0,
    tbFirstServer: null,
    server: cfg.firstServer,
    winner: null,
    completed: false,
  }
}

export function setsWon(state: EngineState): [number, number] {
  const w: [number, number] = [0, 0]
  for (const s of state.sets) {
    if (s.games[0] > s.games[1]) w[0]++
    else if (s.games[1] > s.games[0]) w[1]++
  }
  return w
}

const setsToWin = (cfg: MatchConfig) => Math.floor(cfg.bestOf / 2) + 1

function gameWon(cfg: MatchConfig, points: [number, number], team: 0 | 1) {
  const o = 1 - team
  if (points[team] < 4) return false
  return cfg.goldenPoint || points[team] - points[o] >= 2
}

function finishSet(cfg: MatchConfig, s: EngineState, team: 0 | 1, tiebreak: [number, number] | null, addGame: boolean) {
  let games: [number, number] = [s.games[0], s.games[1]]
  if (addGame) games[team] += 1
  if (s.isSuper) {
    games = [0, 0]
    games[team] = 1
  }
  s.sets.push({ games, tiebreak, super: s.isSuper })
  const wasTb = s.inTiebreak
  const tbFirst = s.tbFirstServer
  s.games = [0, 0]
  s.points = [0, 0]
  s.inTiebreak = false
  s.isSuper = false
  s.tiebreakTarget = 0
  s.tbFirstServer = null
  const won = setsWon(s)
  if (won[team] >= setsToWin(cfg)) {
    s.winner = team
    s.completed = true
    return
  }
  if (wasTb) s.server = (1 - (tbFirst as number)) as 0 | 1
  if (cfg.superTiebreak && won[0] === won[1] && won[0] === setsToWin(cfg) - 1) {
    s.inTiebreak = true
    s.isSuper = true
    s.tiebreakTarget = cfg.superTiebreakPoints
    s.tbFirstServer = s.server
  }
}

export function applyPoint(cfg: MatchConfig, state: EngineState, team: 0 | 1): EngineState {
  if (state.completed) throw new EngineError('match_completed', 'The match is already completed')
  const s: EngineState = structuredClone(state)
  const o = (1 - team) as 0 | 1
  s.points[team] += 1

  if (s.inTiebreak) {
    const total = s.points[0] + s.points[1]
    const first = s.tbFirstServer as 0 | 1
    s.server = Math.floor((total + 1) / 2) % 2 === 0 ? first : ((1 - first) as 0 | 1)
    if (s.points[team] >= s.tiebreakTarget && s.points[team] - s.points[o] >= 2) {
      finishSet(cfg, s, team, [s.points[0], s.points[1]], true)
    }
    return s
  }

  if (!gameWon(cfg, s.points, team)) return s

  s.games[team] += 1
  s.points = [0, 0]
  s.server = (1 - s.server) as 0 | 1
  const g = s.games
  if (g[team] >= cfg.gamesPerSet && g[team] - g[o] >= 2) {
    finishSet(cfg, s, team, null, false)
  } else if (cfg.tiebreakEnabled && g[0] === cfg.tiebreakAt && g[1] === cfg.tiebreakAt) {
    s.inTiebreak = true
    s.tiebreakTarget = cfg.tiebreakPoints
    s.tbFirstServer = s.server
  }
  return s
}

export function pointLabels(cfg: MatchConfig, state: EngineState): { labels: [string, string]; kind: Display['pointKind'] } {
  const [a, b] = state.points
  if (state.inTiebreak) return { labels: [String(a), String(b)], kind: state.isSuper ? 'super' : 'tiebreak' }
  if (a < 3 || b < 3) return { labels: [LABELS[Math.min(a, 3)], LABELS[Math.min(b, 3)]], kind: 'normal' }
  if (cfg.goldenPoint) return { labels: ['40', '40'], kind: 'golden' }
  if (a === b) return { labels: ['40', '40'], kind: 'deuce' }
  return { labels: a > b ? ['AD', '40'] : ['40', 'AD'], kind: 'advantage' }
}

function teamsWhere(state: EngineState, f: (next: EngineState) => boolean, cfg: MatchConfig): (0 | 1)[] {
  if (state.completed) return []
  return ([0, 1] as const).filter((t) => f(applyPoint(cfg, state, t)))
}

export function describe(cfg: MatchConfig, state: EngineState): Display {
  const { labels, kind } = pointLabels(cfg, state)
  const n = state.sets.length
  return {
    pointLabels: labels,
    pointKind: kind,
    matchPointFor: teamsWhere(state, (x) => x.completed, cfg),
    setPointFor: teamsWhere(state, (x) => x.sets.length > n, cfg),
    setsWon: setsWon(state),
  }
}
