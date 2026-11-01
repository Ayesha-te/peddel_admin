import clsx from 'clsx'
import { useEffect, useState } from 'react'

export const MIN_SETS = 1
export const MAX_SETS = 21
export const PRESETS = [1, 3, 5]

/** How many sets win a "best of N" match (best of 5 -> 3, best of 8 -> 5 because 4-4 cannot decide a match). */
export const setsToWin = (bestOf: number) => Math.floor(bestOf / 2) + 1

export function setsExplanation(bestOf: number) {
  const need = setsToWin(bestOf)
  const tail = bestOf % 2 === 0 ? ` (a ${bestOf / 2}-${bestOf / 2} tie cannot decide the match, so play continues)` : ''
  return need === 1 ? 'One set decides the match' : `First to win ${need} sets${tail}`
}

/**
 * "Best of N": quick buttons for the common formats plus a box where any whole number of sets can be typed.
 * `dark` styles it for the court-side scoring console.
 */
export function SetsPicker({ value, onChange, dark }: { value: number; onChange: (n: number) => void; dark?: boolean }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const parsed = Number(text)
  const valid = text.trim() !== '' && Number.isInteger(parsed) && parsed >= MIN_SETS && parsed <= MAX_SETS
  const type = (v: string) => {
    setText(v)
    const n = Number(v)
    if (v.trim() !== '' && Number.isInteger(n) && n >= MIN_SETS && n <= MAX_SETS) onChange(n)
  }

  const btn = (on: boolean) =>
    dark
      ? clsx('flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center transition active:scale-[0.98]',
          on ? 'border-ball-400 bg-ball-400 text-ink-950' : 'border-white/15 bg-white/5 text-white hover:bg-white/10')
      : clsx('flex flex-col rounded-xl border-2 px-3 py-2.5 text-left transition', on ? 'border-court-600 bg-court-50' : 'border-slate-200 bg-white hover:bg-slate-50')

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Number of sets" className="grid grid-cols-3 gap-2 sm:gap-3">
        {PRESETS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => { setText(String(n)); onChange(n) }} className={btn(value === n)}>
            <span className={clsx('font-extrabold', dark ? 'text-lg sm:text-xl' : 'text-sm font-bold text-slate-900')}>Best of {n}</span>
            <span className={clsx('text-xs', dark ? (value === n ? 'text-ink-800' : 'text-slate-400') : 'text-slate-500')}>{n === 1 ? 'one set' : `first to ${setsToWin(n)} sets`}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className={clsx('flex items-center gap-2 text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-700')}>
          Or type your own: best of
          <input
            type="number" inputMode="numeric" min={MIN_SETS} max={MAX_SETS} step={1} value={text} aria-label="Custom number of sets" aria-invalid={!valid}
            onChange={(e) => type(e.target.value)}
            onBlur={() => { if (!valid) setText(String(value)) }}
            className={clsx('w-20 rounded-lg border-2 px-3 py-2 text-center text-base font-bold tabular-nums outline-none focus:ring-2',
              dark ? 'border-white/20 bg-ink-900 text-white focus:ring-ball-400/50' : 'border-slate-300 bg-white text-slate-900 focus:ring-court-500/40',
              !valid && 'border-rose-500')}
          />
          sets
        </label>
        <p aria-live="polite" className={clsx('text-xs', !valid ? 'font-semibold text-rose-500' : dark ? 'text-slate-400' : 'text-slate-500')}>
          {valid ? setsExplanation(parsed) : `Enter a whole number from ${MIN_SETS} to ${MAX_SETS}`}
        </p>
      </div>
    </div>
  )
}
