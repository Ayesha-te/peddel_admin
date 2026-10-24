import clsx from 'clsx'
import { useState } from 'react'
import { Field, Input, Select } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Paginated, Player, Team } from '@/types'

export interface SideValue {
  mode: 'team' | 'players'
  teamId: string
  name: string
  players: { id: string; first: string; last: string }[]
}

export const emptySide = (): SideValue => ({ mode: 'players', teamId: '', name: '', players: [{ id: '', first: '', last: '' }, { id: '', first: '', last: '' }] })

/** Converts editor state into the API payload (existing team, or two existing/new players). */
export function sidePayload(v: SideValue) {
  if (v.mode === 'team') return v.teamId ? { id: Number(v.teamId) } : null
  const players = v.players.map((p) => (p.id ? { id: Number(p.id) } : { first_name: p.first.trim(), last_name: p.last.trim() }))
  return { name: v.name.trim() || undefined, players }
}

export function sideError(v: SideValue): string | null {
  if (v.mode === 'team') return v.teamId ? null : 'Choose a team'
  if (v.players.some((p) => !p.id && !p.first.trim())) return 'Pick or name both players'
  const ids = v.players.map((p) => p.id).filter(Boolean)
  if (new Set(ids).size !== ids.length) return 'Choose two different players'
  return null
}

export function SideEditor({ label, value, onChange, error }: { label: string; value: SideValue; onChange: (v: SideValue) => void; error?: string | null }) {
  const { data: teams } = useGet<Paginated<Team>>('/api/admin/teams/', { page_size: 200 })
  const { data: players } = useGet<Paginated<Player>>('/api/admin/players/', { page_size: 200 })
  const [touched, setTouched] = useState(false)
  const set = (patch: Partial<SideValue>) => { setTouched(true); onChange({ ...value, ...patch }) }
  const setPlayer = (i: number, patch: Partial<SideValue['players'][number]>) =>
    set({ players: value.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold text-slate-800">{label}</legend>
      <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
        {(['players', 'team'] as const).map((m) => (
          <button key={m} type="button" onClick={() => set({ mode: m })}
            className={clsx('rounded-md px-3 py-1.5', value.mode === m ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500')}>
            {m === 'players' ? 'Pick players' : 'Existing team'}
          </button>
        ))}
      </div>
      {value.mode === 'team' ? (
        <Field label="Team">
          <Select value={value.teamId} onChange={(e) => set({ teamId: e.target.value })}>
            <option value="">Select a team…</option>
            {teams?.results.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.players.map((p) => p.full_name).join(' & ')}</option>)}
          </Select>
        </Field>
      ) : (
        <div className="space-y-3">
          <Field label="Team name (optional)"><Input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Defaults to player surnames" /></Field>
          {value.players.map((p, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3">
              <Field label={`Player ${i + 1}`}>
                <Select value={p.id} onChange={(e) => setPlayer(i, { id: e.target.value })}>
                  <option value="">＋ New player…</option>
                  {players?.results.map((pl) => <option key={pl.id} value={pl.id}>{pl.full_name}</option>)}
                </Select>
              </Field>
              {!p.id && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input placeholder="First name" value={p.first} onChange={(e) => setPlayer(i, { first: e.target.value })} aria-label={`Player ${i + 1} first name`} />
                  <Input placeholder="Last name" value={p.last} onChange={(e) => setPlayer(i, { last: e.target.value })} aria-label={`Player ${i + 1} last name`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {touched && error && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </fieldset>
  )
}
