import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '@/api/client'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { useRole } from '@/features/auth/guards'
import { useSave } from '@/hooks/query'
import type { User } from '@/types'

const schema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(150),
  email: z.string().trim().email('Enter a valid email'),
  first_name: z.string().trim().max(150),
  last_name: z.string().trim().max(150),
  phone: z.string().trim().max(32),
  role: z.enum(['super_admin', 'tournament_admin', 'umpire']),
  password: z.string(),
})
type Form = z.infer<typeof schema>

export function UserForm({ item, onClose, fixedRole }: { item?: User; onClose: () => void; fixedRole?: User['role'] }) {
  const { isSuper } = useRole()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { username: item?.username ?? '', email: item?.email ?? '', first_name: item?.first_name ?? '', last_name: item?.last_name ?? '', phone: item?.phone ?? '', role: item?.role ?? fixedRole ?? 'umpire', password: '' },
  })
  const save = useSave(
    (body: Record<string, unknown>) => (item ? api.patch(`/api/admin/users/${item.id}/`, body) : api.post('/api/admin/users/', body)),
    { invalidate: ['/api/admin/users'], success: 'User saved', onSuccess: onClose },
  )
  const submit = handleSubmit((v) => {
    if (!item && v.password.length < 8) return setError('password', { message: 'At least 8 characters' })
    const body: Record<string, unknown> = { ...v }
    if (!v.password) delete body.password
    save.mutate(body)
  })
  return (
    <Modal open onClose={onClose} title={item ? 'Edit user' : 'New user'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>Save</Button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Username" error={errors.username?.message}><Input {...register('username')} autoFocus autoComplete="off" /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
        <Field label="First name"><Input {...register('first_name')} /></Field>
        <Field label="Last name"><Input {...register('last_name')} /></Field>
        <Field label="Phone"><Input {...register('phone')} /></Field>
        <Field label="Role">
          <Select {...register('role')} disabled={!isSuper || !!fixedRole}>
            <option value="umpire">Umpire / Match operator</option><option value="tournament_admin">Tournament Admin</option><option value="super_admin">Super Admin</option>
          </Select>
        </Field>
        <Field label={item ? 'New password (optional)' : 'Password'} error={errors.password?.message} className="sm:col-span-2"><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
      </form>
    </Modal>
  )
}
