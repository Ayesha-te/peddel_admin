import { useState } from 'react'
import { api, newActionId } from '@/api/client'
import { Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { useSave } from '@/hooks/query'
import type { Match } from '@/types'

interface Row { a: string; b: string; ta: string; tb: string }
const blank = (): Row => ({ a: '', b: '', ta: '', tb: '' })

/** Manual result entry / audited correction. The backend validates every score again. */
export function ResultModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const maxSets = 2 * (Math.floor(match.config.bestOf / 2) + 1) - 1 // most sets that can be played in a best-of-N
  const [rows, setRows] = useState<Row[]>(() =>
    match.state.completed && match.state.sets.length
      ? match.state.sets.map((s) => ({ a: String(s.games[0]), b: String(s.games[1]), ta: s.tiebreak ? String(s.tiebreak[0]) : '', tb: s.tiebreak ? String(s.tiebreak[1]) : '' }))
      : [blank()],
  )
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const set = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (i === j ? { ...x, ...p } : x)))

  const save = useSave(
    (body: unknown) => api.post(`/api/admin/matches/${match.id}/result/`, body),
    { invalidate: ['/api/admin/matches', '/api/admin/tournaments', '/api/admin/dashboard'], success: 'Result saved and audited', onSuccess: onClose },
  )

  const submit = () => {
    setErr(null)
    if (!reason.trim()) return setErr('A reason is required for the audit log.')
    const sets = []
    for (const [i, r] of rows.entries()) {
      if (r.a === '' || r.b === '') return setErr(`Set ${i + 1}: enter both game scores.`)
      const entry: { games: number[]; tiebreak?: number[] } = { games: [Number(r.a), Number(r.b)] }
      if (r.ta !== '' || r.tb !== '') entry.tiebreak = [Number(r.ta), Number(r.tb)]
      sets.push(entry)
    }
    save.mutate({ clientActionId: newActionId(), sets, reason: reason.trim() })
  }

  return (
    <Modal open onClose={onClose} title={match.state.completed ? 'Correct result' : 'Enter result manually'} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save result</Button></>}>
      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        This replaces the recorded score and is written to the audit log{match.state.completed ? ', and standings and brackets will be recalculated' : ''}.
        For a super tie-break decider enter games as 1–0 / 0–1 and the tie-break points below.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] items-end gap-2 text-xs font-semibold uppercase text-slate-500">
          <span /> <span className="truncate">{match.teams[0].name}</span><span className="truncate">{match.teams[1].name}</span><span>TB {match.teams[0].name.slice(0, 6)}</span><span>TB {match.teams[1].name.slice(0, 6)}</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">Set {i + 1}</span>
            <Input type="number" min={0} max={30} value={r.a} onChange={(e) => set(i, { a: e.target.value })} aria-label={`Set ${i + 1} ${match.teams[0].name} games`} />
            <Input type="number" min={0} max={30} value={r.b} onChange={(e) => set(i, { b: e.target.value })} aria-label={`Set ${i + 1} ${match.teams[1].name} games`} />
            <Input type="number" min={0} value={r.ta} onChange={(e) => set(i, { ta: e.target.value })} placeholder="–" aria-label={`Set ${i + 1} tie-break A`} />
            <Input type="number" min={0} value={r.tb} onChange={(e) => set(i, { tb: e.target.value })} placeholder="–" aria-label={`Set ${i + 1} tie-break B`} />
          </div>
        ))}
        <div className="flex gap-2">
          {rows.length < maxSets && <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, blank()])}>Add set</Button>}
          {rows.length > 1 && <Button variant="ghost" size="sm" onClick={() => setRows((r) => r.slice(0, -1))}>Remove last set</Button>}
        </div>
        <Field label="Reason (audited)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scorer tapped the wrong team in set 2" /></Field>
        {err && <p role="alert" className="text-sm font-medium text-rose-600">{err}</p>}
      </div>
    </Modal>
  )
}
