import { useState } from 'react'
import { API_BASE, PUBLIC_SITE } from '@/api/client'
import { CrudPage } from '@/components/CrudPage'
import { Card, EmptyState, PageHeader, Pagination, Tabs, TableSkeleton } from '@/components/ui'
import { useRole } from '@/features/auth/guards'
import { useGet } from '@/hooks/query'
import { useAuth } from '@/store/auth'
import type { AuditEntry, Paginated, User } from '@/types'
import { UserForm } from './UserForm'

function AuditLog() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useGet<Paginated<AuditEntry>>('/api/admin/audit/', { page, page_size: 25 })
  return (
    <Card>
      {isLoading ? <TableSkeleton cols={4} /> : !data?.results.length ? <EmptyState title="No audit entries" /> : (
        <>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Object</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.results.map((a) => (
              <tr key={a.id}><td className="td text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</td><td className="td font-medium">{a.actor_name}</td><td className="td">{a.action}</td><td className="td text-slate-600">{a.object_type} #{a.object_id}</td></tr>
            ))}</tbody>
          </table></div>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      )}
    </Card>
  )
}

export default function SettingsPage() {
  const { isSuper } = useRole()
  const user = useAuth((s) => s.user)
  const [tab, setTab] = useState<'profile' | 'users' | 'audit'>('profile')
  const tabs = [{ id: 'profile' as const, label: 'Profile' }, ...(isSuper ? [{ id: 'users' as const, label: 'Users' }, { id: 'audit' as const, label: 'Audit log' }] : [])]
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'profile' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Your account"><dl className="divide-y divide-slate-100 px-5 text-sm">
            {([['Name', user?.display_name], ['Username', user?.username], ['Email', user?.email], ['Role', user?.role.replace('_', ' ')]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between py-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium capitalize text-slate-900">{v}</dd></div>
            ))}
          </dl></Card>
          <Card title="Connection"><dl className="divide-y divide-slate-100 px-5 text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">API</dt><dd className="break-all text-right font-mono text-xs">{API_BASE || '(same origin)'}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">Public site</dt><dd className="break-all text-right font-mono text-xs">{PUBLIC_SITE || '—'}</dd></div>
          </dl></Card>
        </div>
      )}
      {tab === 'users' && isSuper && (
        <CrudPage<User> title="Users" noun="User" path="/api/admin/users/"
          columns={[
            { header: 'Name', cell: (u) => <span className="font-semibold text-slate-900">{u.display_name}</span> },
            { header: 'Username', cell: (u) => u.username },
            { header: 'Role', cell: (u) => <span className="capitalize">{u.role.replace('_', ' ')}</span> },
            { header: 'Active', cell: (u) => (u.is_active ? 'Yes' : 'No') },
          ]}
          canDelete={(u) => u.id !== user?.id}
          renderForm={(p) => <UserForm {...p} />} />
      )}
      {tab === 'audit' && isSuper && <AuditLog />}
    </>
  )
}
