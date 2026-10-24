import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '@/api/client'
import { CrudPage } from '@/components/CrudPage'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { useGet, useSave } from '@/hooks/query'
import type { Paginated, Player, Team } from '@/types'

const schema = z.object({
  name: z.string().trim().min(2, 'Team name is required').max(100),
  p1: z.string().min(1, 'Choose player 1'),
  p2: z.string().min(1, 'Choose player 2'),
}).refine((v) => v.p1 !== v.p2, { path: ['p2'], message: 'Choose two different players' })
type Form = z.infer<typeof schema>

function TeamForm({ item, onClose }: { item?: Team; onClose: () => void }) {
  const { data: players } = useGet<Paginated<Player>>('/api/admin/players/', { page_size: 200, ordering: 'first_name' })
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: item?.name ?? '', p1: item ? String(item.players[0]?.id) : '', p2: item ? String(item.players[1]?.id) : '' },
  })
  const save = useSave(
    (body: unknown) => (item ? api.patch<Team>(`/api/admin/teams/${item.id}/`, body) : api.post<Team>('/api/admin/teams/', body)),
    { invalidate: ['/api/admin/teams'], success: item ? 'Team updated' : 'Team created', onSuccess: onClose },
  )
  const submit = handleSubmit((v) => save.mutate({ name: v.name, player_ids: [Number(v.p1), Number(v.p2)] }))
  const opts = players?.results.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)
  return (
    <Modal open onClose={onClose} title={item ? 'Edit team' : 'New team'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Team name" error={errors.name?.message}><Input {...register('name')} autoFocus /></Field>
        <Field label="Player 1" error={errors.p1?.message}><Select {...register('p1')}><option value="">Select…</option>{opts}</Select></Field>
        <Field label="Player 2" error={errors.p2?.message}><Select {...register('p2')}><option value="">Select…</option>{opts}</Select></Field>
        {players && players.count < 2 && <p className="text-sm text-amber-700">Add at least two players first.</p>}
      </form>
    </Modal>
  )
}

export default function TeamsPage() {
  return (
    <CrudPage<Team> title="Teams" subtitle="Doubles pairings" noun="Team" path="/api/admin/teams/"
      columns={[
        { header: 'Team', cell: (t) => <span className="font-semibold text-slate-900">{t.name}</span> },
        { header: 'Players', cell: (t) => t.players.map((p) => p.full_name).join(' & '), className: 'text-slate-600' },
      ]}
      renderForm={(p) => <TeamForm {...p} />} />
  )
}
