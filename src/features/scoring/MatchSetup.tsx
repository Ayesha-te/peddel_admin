import clsx from 'clsx'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/api/client'
import { toast } from '@/components/toast'
import { Button, Spinner } from '@/components/ui'
import { SetsPicker } from '@/features/matches/SetsPicker'
import type { Match, MatchConfig } from '@/types'
import { errorMessage } from '@/utils/format'

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={clsx('flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition',
        checked ? 'border-ball-400/60 bg-ball-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={clsx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-ball-400' : 'bg-slate-600')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-ink-900 transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

/**
 * Shown to the umpire before the first point: the umpire decides the format (best of 1 / 3 / 5 sets) and the
 * other rules for THIS match. The choice is saved to the database; it locks as soon as the first point is scored.
 */
export function MatchSetup({ match, onStarted }: { match: Match; onStarted: (m: Match) => void }) {
  const [cfg, setCfg] = useState<MatchConfig>(match.config)
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<MatchConfig>) => setCfg((c) => ({ ...c, ...p }))

  const start = async () => {
    setBusy(true)
    try {
      const fresh = await api.post<Match>(`/api/admin/matches/${match.id}/rules/`, {
        bestOf: cfg.bestOf, goldenPoint: cfg.goldenPoint, tiebreakEnabled: cfg.tiebreakEnabled,
        superTiebreak: cfg.bestOf > 1 && cfg.superTiebreak, firstServer: cfg.firstServer,
      })
      onStarted(fresh)
    } catch (e) {
      toast.err(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Match setup" className="space-y-5 rounded-2xl border border-white/10 bg-ink-800 p-4 sm:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-ball-400">Match setup</p>
        <h2 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">How many sets are we playing?</h2>
        <p className="mt-1 text-sm text-slate-400">You decide the format for this match. It cannot be changed once the first point is played.</p>
      </header>

      <SetsPicker dark value={cfg.bestOf} onChange={(n) => set({ bestOf: n, superTiebreak: n > 1 && cfg.superTiebreak })} />

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">When a game reaches 40–40</p>
        <div role="radiogroup" aria-label="Game format at 40-40" className="grid grid-cols-2 gap-2 sm:gap-3">
          {([['deuce', 'Deuce', 'Advantage: win two points in a row'], ['golden', 'Golden point', 'The next point wins the game']] as const).map(([k, title, text]) => {
            const on = (k === 'golden') === cfg.goldenPoint
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set({ goldenPoint: k === 'golden' })}
                className={clsx('min-h-[72px] rounded-xl border-2 px-3 py-3 text-left transition active:scale-[0.98]', on ? 'border-ball-400 bg-ball-400 text-ink-950' : 'border-white/15 bg-white/5 text-white hover:bg-white/10')}>
                <span className="block text-base font-extrabold">{title}</span>
                <span className={clsx('block text-xs', on ? 'text-ink-800' : 'text-slate-400')}>{text}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Switch label="Tie-break at 6–6" hint="First to 7, win by 2" checked={cfg.tiebreakEnabled} onChange={(v) => set({ tiebreakEnabled: v })} />
        {cfg.bestOf > 1 && (
          <Switch label="Super tie-break decider" hint={`Replaces the last set: first to ${cfg.superTiebreakPoints}, win by 2`} checked={cfg.superTiebreak} onChange={(v) => set({ superTiebreak: v })} />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Who serves first?</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {([0, 1] as const).map((t) => (
            <button key={t} type="button" onClick={() => set({ firstServer: t })} aria-pressed={cfg.firstServer === t}
              className={clsx('truncate rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
                cfg.firstServer === t ? 'border-court-400 bg-court-500/20 text-white' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10')}>
              {match.teams[t].name}
            </button>
          ))}
        </div>
      </div>

      <Button variant="brand" className="min-h-[56px] w-full text-base" onClick={start} disabled={busy}>
        {busy ? <Spinner /> : <Play className="h-5 w-5" />} Start match · {cfg.bestOf === 1 ? 'best of 1 set' : `best of ${cfg.bestOf} sets`} · {cfg.goldenPoint ? 'golden point' : 'deuce'}
      </Button>
    </section>
  )
}
