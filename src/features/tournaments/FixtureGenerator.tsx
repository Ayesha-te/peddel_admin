import { useState } from 'react'
import { api } from '@/api/client'
import { Button, Field, Input, Modal, Spinner, Toggle } from '@/components/ui'
import { useSave } from '@/hooks/query'
import type { FixturePlan, Tournament } from '@/types'

/** Preview-then-confirm fixture generation. Nothing is written until the user confirms. */
export function FixtureGenerator({ tournament, existing, onClose }: { tournament: Tournament; existing: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState(tournament.groups_count)
  const [qual, setQual] = useState(tournament.qualifiers_per_group)
  const [shuffle, setShuffle] = useState(false)
  const [replace, setReplace] = useState(false)
  const [plan, setPlan] = useState<FixturePlan | null>(null)
  const opts = (seed?: number) => ({ groups_count: groups, qualifiers_per_group: qual, shuffle, seed, replace })
  const base = `/api/admin/tournaments/${tournament.id}`

  const preview = useSave(() => api.post<FixturePlan>(`${base}/fixtures/preview/`, opts(plan?.seed)), { onSuccess: setPlan })
  const confirm = useSave(() => api.post(`${base}/fixtures/confirm/`, opts(plan?.seed)), {
    invalidate: ['/api/admin/tournaments', '/api/admin/matches', '/api/admin/dashboard'], success: 'Fixtures generated', onSuccess: onClose,
  })
  const blocked = plan?.has_started_matches || (existing && !replace)

  return (
    <Modal open onClose={onClose} wide title="Generate fixtures"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" loading={preview.isPending} onClick={() => preview.mutate(undefined)}>{plan ? 'Refresh preview' : 'Preview'}</Button>
        <Button variant="brand" disabled={!plan || !!blocked} loading={confirm.isPending} onClick={() => confirm.mutate(undefined)}>Confirm &amp; generate</Button>
      </>}>
      <div className="space-y-4">
        {tournament.format === 'groups_knockout' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Number of groups"><Input type="number" min={1} max={8} value={groups} onChange={(e) => { setGroups(Number(e.target.value)); setPlan(null) }} /></Field>
            <Field label="Teams qualifying per group"><Input type="number" min={1} max={8} value={qual} onChange={(e) => { setQual(Number(e.target.value)); setPlan(null) }} /></Field>
          </div>
        )}
        <Toggle label="Shuffle teams into groups" hint="Otherwise teams are distributed by registration seed" checked={shuffle} onChange={(v) => { setShuffle(v); setPlan(null) }} />
        {existing && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <Toggle label="Replace the existing fixtures" hint="Only possible while no match has started. Existing unplayed fixtures are deleted." checked={replace} onChange={setReplace} />
          </div>
        )}
        {preview.isPending && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Building preview…</div>}
        {plan && (
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
              <span>{plan.counts.groups} group(s)</span><span>{plan.counts.group_matches} group matches</span><span>{plan.counts.knockout_matches} knockout matches</span>
            </div>
            {plan.warnings.map((w) => <p key={w} role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{w}</p>)}
            {plan.groups.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {plan.groups.map((g) => (
                  <div key={g.name} className="rounded-lg bg-slate-50 p-3"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{g.name}</p><ul className="text-sm">{g.teams.map((t) => <li key={t}>{t}</li>)}</ul></div>
                ))}
              </div>
            )}
            {plan.knockout.length > 0 && (
              <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Knockout bracket</p>
                <ul className="space-y-1 text-sm">{plan.knockout.filter((k) => k.round === 1).map((k, i) => <li key={i} className="text-slate-700">{k.round_name}: {k.slot_a.label} <span className="text-slate-400">vs</span> {k.slot_b.label}</li>)}</ul></div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
