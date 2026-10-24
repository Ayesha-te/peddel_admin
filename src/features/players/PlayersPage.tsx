import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api, mediaUrl } from '@/api/client'
import { CrudPage } from '@/components/CrudPage'
import { Button, Field, Input, Modal, Toggle } from '@/components/ui'
import { useSave } from '@/hooks/query'
import type { Player } from '@/types'
import { useState } from 'react'

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(60),
  last_name: z.string().trim().max(60),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  phone: z.string().trim().max(32),
})
type Form = z.infer<typeof schema>

function PlayerForm({ item, onClose }: { item?: Player; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: item?.first_name ?? '', last_name: item?.last_name ?? '', email: item?.email ?? '', phone: item?.phone ?? '' },
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [pub, setPub] = useState(item?.show_photo_publicly ?? false)
  const save = useSave(
    (fd: FormData) => (item ? api.patch<Player>(`/api/admin/players/${item.id}/`, fd) : api.post<Player>('/api/admin/players/', fd)),
    { invalidate: ['/api/admin/players', '/api/admin/teams'], success: item ? 'Player updated' : 'Player added', onSuccess: onClose },
  )
  const submit = handleSubmit((v) => {
    const fd = new FormData()
    Object.entries(v).forEach(([k, val]) => fd.append(k, val ?? ''))
    fd.append('show_photo_publicly', String(pub))
    if (photo) fd.append('photo', photo)
    save.mutate(fd)
  })
  return (
    <Modal open onClose={onClose} title={item ? 'Edit player' : 'New player'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.first_name?.message}><Input {...register('first_name')} autoFocus /></Field>
          <Field label="Last name" error={errors.last_name?.message}><Input {...register('last_name')} /></Field>
          <Field label="Email (private)" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
          <Field label="Phone (private)" error={errors.phone?.message}><Input {...register('phone')} /></Field>
        </div>
        <Field label="Photo" hint="JPEG, PNG or WebP up to 5 MB"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" /></Field>
        <Toggle label="Show photo on public pages" hint="Email and phone are never shown publicly" checked={pub} onChange={setPub} />
      </form>
    </Modal>
  )
}

export default function PlayersPage() {
  return (
    <CrudPage<Player> title="Players" subtitle="Everyone who can be placed in a team" noun="Player" path="/api/admin/players/"
      columns={[
        { header: 'Player', cell: (p) => (
          <div className="flex items-center gap-3">
            {p.photo_url ? <img src={mediaUrl(p.photo_url) ?? ''} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-court-100 text-sm font-bold text-court-700">{p.first_name[0]}</span>}
            <span className="font-semibold text-slate-900">{p.full_name}</span>
          </div>
        ) },
        { header: 'Email', cell: (p) => p.email || '—', className: 'text-slate-600' },
        { header: 'Phone', cell: (p) => p.phone || '—', className: 'text-slate-600' },
      ]}
      renderForm={(p) => <PlayerForm {...p} />} />
  )
}
