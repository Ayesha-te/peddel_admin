import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '@/api/client'
import { CrudPage } from '@/components/CrudPage'
import { Button, Field, Input, Modal, StatusBadge, Toggle } from '@/components/ui'
import { useSave } from '@/hooks/query'
import type { Court } from '@/types'
import { useState } from 'react'

const schema = z.object({ name: z.string().trim().min(1, 'Name is required').max(60), venue: z.string().trim().max(120) })
type Form = z.infer<typeof schema>

function CourtForm({ item, onClose }: { item?: Court; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: item?.name ?? '', venue: item?.venue ?? '' } })
  const [active, setActive] = useState(item?.is_active ?? true)
  const save = useSave(
    (body: unknown) => (item ? api.patch(`/api/admin/courts/${item.id}/`, body) : api.post('/api/admin/courts/', body)),
    { invalidate: ['/api/admin/courts'], success: 'Court saved', onSuccess: onClose },
  )
  const submit = handleSubmit((v) => save.mutate({ ...v, is_active: active }))
  return (
    <Modal open onClose={onClose} title={item ? 'Edit court' : 'New court'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Court name" error={errors.name?.message}><Input {...register('name')} autoFocus placeholder="Court 1" /></Field>
        <Field label="Venue" error={errors.venue?.message}><Input {...register('venue')} /></Field>
        <Toggle label="Active" hint="Inactive courts cannot be assigned to new matches" checked={active} onChange={setActive} />
      </form>
    </Modal>
  )
}

export default function CourtsPage() {
  return (
    <CrudPage<Court> title="Courts" subtitle="Courts available for scheduling" noun="Court" path="/api/admin/courts/"
      columns={[
        { header: 'Court', cell: (c) => <span className="font-semibold text-slate-900">{c.name}</span> },
        { header: 'Venue', cell: (c) => c.venue || '—', className: 'text-slate-600' },
        { header: 'Status', cell: (c) => <StatusBadge status={c.is_active ? 'published' : 'archived'} /> },
      ]}
      renderForm={(p) => <CourtForm {...p} />} />
  )
}
