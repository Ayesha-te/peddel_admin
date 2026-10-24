import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '@/api/client'
import { Button, Field, Input, Modal, Select, Toggle } from '@/components/ui'
import { useGet, useSave } from '@/hooks/query'
import type { Court, Match, MatchConfig, Paginated, User } from '@/types'
import { fromLocalInput, toLocalInput } from '@/utils/format'
import { emptySide, SideEditor, sideError, sidePayload, type SideValue } from './SideEditor'

const schema = z.object({
  name: z.string().trim().min(2, 'Give the match a name').max(140),
  court: z.string().optional(),
  umpire: z.string().optional(),
  scheduled_at: z.string().optional(),
})
type Form = z.infer<typeof schema>

const DEFAULTS: MatchConfig = {
  bestOf: 3, goldenPoint: false, tiebreakEnabled: true, tiebreakAt: 6, tiebreakPoints: 7,
  superTiebreak: false, superTiebreakPoints: 10, gamesPerSet: 6, firstServer: 0,
}

export function RulesEditor({ value, onChange, disabled }: { value: MatchConfig; onChange: (c: MatchConfig) => void; disabled?: boolean }) {
  const set = (p: Partial<MatchConfig>) => onChange({ ...value, ...p })
  return (
    <fieldset disabled={disabled} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
      <legend className="px-2 text-sm font-bold text-slate-800">Scoring rules</legend>
      <Field label="Format">
        <Select value={value.bestOf} onChange={(e) => set({ bestOf: Number(e.target.value) as 1 | 3, superTiebreak: Number(e.target.value) === 3 && value.superTiebreak })}>
          <option value={3}>Best of 3 sets</option>
          <option value={1}>Best of 1 set</option>
        </Select>
      </Field>
      <Field label="First server">
        <Select value={value.firstServer} onChange={(e) => set({ firstServer: Number(e.target.value) as 0 | 1 })}>
          <option value={0}>Team A</option>
          <option value={1}>Team B</option>
        </Select>
      </Field>
      <Toggle label="Golden point" hint="Sudden-death point at 40–40 instead of advantage" checked={value.goldenPoint} onChange={(v) => set({ goldenPoint: v })} />
      <Toggle label="Tie-break at 6–6" hint="7 points, win by 2" checked={value.tiebreakEnabled} onChange={(v) => set({ tiebreakEnabled: v })} />
      {value.bestOf === 3 && (
        <Toggle label="Deciding-set super tie-break" hint={`First to ${value.superTiebreakPoints}, win by 2, replaces the 3rd set`} checked={value.superTiebreak} onChange={(v) => set({ superTiebreak: v })} />
      )}
    </fieldset>
  )
}

export function MatchFormModal({ open, onClose, match, tournamentId, onSaved }: {
  open: boolean; onClose: () => void; match?: Match; tournamentId?: number; onSaved?: (m: Match) => void
}) {
  const editing = !!match
  const started = !!match && (match.revision > 0 || !['draft', 'scheduled', 'ready'].includes(match.status))
  const fixtureMatch = !!match?.tournament
  const { data: courts } = useGet<Paginated<Court>>('/api/admin/courts/', { page_size: 100 })
  const { data: umpires } = useGet<Paginated<User>>('/api/admin/users/', { role: 'umpire', page_size: 100 })
  const [a, setA] = useState<SideValue>(emptySide())
  const [b, setB] = useState<SideValue>(emptySide())
  const [cfg, setCfg] = useState<MatchConfig>(match?.config ?? DEFAULTS)
  const [isPublic, setIsPublic] = useState(match?.isPublic ?? true)
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: match?.name ?? '', court: match?.court ? String(match.court.id) : '', umpire: match?.umpire ? String(match.umpire.id) : '',
      scheduled_at: toLocalInput(match?.scheduledAt),
    },
  })

  const save = useSave(
    (body: unknown) => (editing ? api.patch<Match>(`/api/admin/matches/${match!.id}/`, body) : api.post<Match>('/api/admin/matches/', body)),
    { invalidate: ['/api/admin/matches', '/api/admin/dashboard', '/api/admin/tournaments'], success: editing ? 'Match updated' : 'Match created', onSuccess: (m) => { onSaved?.(m); onClose() } },
  )

  const submit = () => { setSubmitted(true); void submitForm() }
  const submitForm = handleSubmit((v) => {
    const needTeams = !editing
    const ea = needTeams ? sideError(a) : null
    const eb = needTeams ? sideError(b) : null
    if (ea || eb) return
    const body: Record<string, unknown> = {
      name: v.name,
      court: v.court ? Number(v.court) : null,
      umpire: v.umpire ? Number(v.umpire) : null,
      scheduled_at: fromLocalInput(v.scheduled_at ?? ''),
      is_public: isPublic,
    }
    if (!started) body.config = cfg
    if (!editing) {
      body.team_a = sidePayload(a)
      body.team_b = sidePayload(b)
      if (tournamentId) body.tournament = tournamentId
    }
    save.mutate(body)
  })

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? 'Edit match' : 'New match'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>{editing ? 'Save changes' : 'Create match'}</Button></>}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Match name" error={errors.name?.message} className="sm:col-span-2"><Input {...register('name')} placeholder="e.g. Friday friendly" autoFocus /></Field>
          <Field label="Court"><Select {...register('court')}><option value="">Unassigned</option>{courts?.results.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Umpire"><Select {...register('umpire')}><option value="">Unassigned</option>{umpires?.results.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}</Select></Field>
          <Field label="Date & time" className="sm:col-span-2"><Input type="datetime-local" {...register('scheduled_at')} /></Field>
        </div>
        {!editing && (
          <div className="grid gap-4 md:grid-cols-2">
            <SideEditor label="Team A" value={a} onChange={setA} error={submitted ? sideError(a) : null} />
            <SideEditor label="Team B" value={b} onChange={setB} error={submitted ? sideError(b) : null} />
          </div>
        )}
        {fixtureMatch && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">Teams for tournament matches come from the fixtures. You can still set the court, umpire and time.</p>}
        {!fixtureMatch && <RulesEditor value={cfg} onChange={setCfg} disabled={started} />}
        {started && <p className="text-xs text-slate-500">Rules are locked once play has started.</p>}
        {!match?.tournament && <Toggle label="Shareable by link" hint="Anyone with the link or QR code can watch the live score (read-only)" checked={isPublic} onChange={setIsPublic} />}
      </form>
    </Modal>
  )
}
