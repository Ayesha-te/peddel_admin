import { CrudPage } from '@/components/CrudPage'
import type { User } from '@/types'
import { UserForm } from './UserForm'

export default function UmpiresPage() {
  return (
    <CrudPage<User> title="Umpires" subtitle="Match operators who can score their assigned matches" noun="Umpire" path="/api/admin/users/" params={{ role: 'umpire' }}
      columns={[
        { header: 'Name', cell: (u) => <span className="font-semibold text-slate-900">{u.display_name}</span> },
        { header: 'Username', cell: (u) => u.username, className: 'text-slate-600' },
        { header: 'Email', cell: (u) => u.email, className: 'text-slate-600' },
        { header: 'Active', cell: (u) => (u.is_active ? 'Yes' : 'No') },
      ]}
      renderForm={(p) => <UserForm {...p} fixedRole="umpire" />} />
  )
}
