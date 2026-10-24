import clsx from 'clsx'
import { memo } from 'react'
import type { Display, EngineState, MatchTeam } from '@/types'

interface Props {
  teams: [MatchTeam, MatchTeam]
  state: EngineState
  display: Display
  large?: boolean
}

const SetCell = ({ value, won, tb }: { value: number; won: boolean; tb?: number | null }) => (
  <div className={clsx('relative w-9 text-center sm:w-12', won ? 'text-white' : 'text-slate-500')}>
    <span className="score-num text-3xl font-bold sm:text-4xl">{value}</span>
    {tb != null && <sup className="absolute -right-0.5 top-0 text-[10px] font-semibold text-slate-400">{tb}</sup>}
  </div>
)

function Row({ idx, teams, state, display, large }: Props & { idx: 0 | 1 }) {
  const team = teams[idx]
  const serving = state.server === idx && !state.completed
  const label = display.pointLabels[idx]
  const winner = state.completed && state.winner === idx
  return (
    <div className={clsx('flex items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6', winner && 'bg-ball-400/10')}>
      <span className={clsx('h-3 w-3 shrink-0 rounded-full', serving ? 'bg-ball-400 shadow-[0_0_12px_rgba(212,245,60,.8)]' : 'bg-transparent')} title={serving ? 'Serving' : undefined} aria-label={serving ? 'Serving' : undefined} />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className={clsx('truncate font-bold leading-tight text-white', large ? 'text-2xl sm:text-4xl' : 'text-lg sm:text-2xl')}>{team.name}{winner && ' 🏆'}</p>
        <p className="truncate text-xs text-slate-400 sm:text-sm">{team.players.map((p) => p.name).join('  ·  ') || '—'}</p>
      </div>
      <div className="flex items-center">
        {state.sets.map((s, i) => (
          <SetCell key={i} value={s.super ? (s.games[idx] ? 1 : 0) : s.games[idx]} won={s.games[idx] > s.games[1 - idx]} tb={s.tiebreak && !s.super && s.games[idx] < s.games[1 - idx] ? s.tiebreak[idx] : s.super ? s.tiebreak?.[idx] : null} />
        ))}
        {!state.completed && <SetCell value={state.inTiebreak && state.isSuper ? 0 : state.games[idx]} won />}
      </div>
      {!state.completed && (
        <div key={label} className={clsx('pop grid place-items-center rounded-xl bg-ink-700 text-center', large ? 'h-24 w-24 sm:h-32 sm:w-32' : 'h-16 w-16 sm:h-20 sm:w-20')}>
          <span className={clsx('score-num font-extrabold text-ball-400', large ? 'text-6xl sm:text-8xl' : 'text-4xl sm:text-6xl')}>{label}</span>
        </div>
      )}
    </div>
  )
}

function ScoreboardBase(props: Props) {
  const { display, state } = props
  const chips: { text: string; tone: string }[] = []
  if (!state.completed) {
    if (display.matchPointFor.length) chips.push({ text: `Match point${display.matchPointFor.length === 2 ? ' (both)' : ''}`, tone: 'bg-rose-500/20 text-rose-300' })
    else if (display.setPointFor.length) chips.push({ text: 'Set point', tone: 'bg-amber-500/20 text-amber-300' })
    if (display.pointKind === 'deuce') chips.push({ text: 'Deuce', tone: 'bg-sky-500/20 text-sky-300' })
    if (display.pointKind === 'advantage') chips.push({ text: 'Advantage', tone: 'bg-sky-500/20 text-sky-300' })
    if (display.pointKind === 'golden') chips.push({ text: 'Golden point', tone: 'bg-yellow-500/20 text-yellow-300' })
    if (display.pointKind === 'tiebreak') chips.push({ text: 'Tie-break', tone: 'bg-violet-500/20 text-violet-300' })
    if (display.pointKind === 'super') chips.push({ text: 'Super tie-break', tone: 'bg-violet-500/20 text-violet-300' })
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
      <Row idx={0} {...props} />
      <div className="mx-4 h-px bg-white/10 sm:mx-6" />
      <Row idx={1} {...props} />
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-2.5 sm:px-6">
          {chips.map((c) => <span key={c.text} className={clsx('badge', c.tone)}>{c.text}</span>)}
        </div>
      )}
    </div>
  )
}

export const Scoreboard = memo(ScoreboardBase)
