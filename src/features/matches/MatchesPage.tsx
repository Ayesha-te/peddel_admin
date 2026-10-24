import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, StatusBadge, TableSkeleton } from '@/components/ui'
import { useRole } from '@/features/auth/guards'
import { useGet } from '@/hooks/query'
import type { Match, Paginated } from '@/types'
import { fmtDateTime, scoreline } from '@/utils/format'
import { MatchFormModal } from './MatchFormModal'

const STATUSES = ['draft', 'scheduled', 'ready', 'live', 'paused', 'completed', 'cancelled']

export default function MatchesPage() {
  const nav = useNavigate()
  const { isAdmin } = useRole()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [scope, setScope] = useState('')
  const [open, setOpen] = useState(false)
  const { data, isLoading, error, refetch, isFetching } = useGet<Paginated<Match>>('/api/admin/matches/', {
    page, search, status, friendly: scope === 'friendly' ? 1 : undefined, ordering: '-scheduled_at',
  })

  return (
    <>
      <PageHeader title="Matches" subtitle="Friendly and tournament matches" actions={isAdmin && <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New match</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search match or team…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} aria-label="Search matches" />
          </div>
          <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </Select>
          <Select className="w-44" value={scope} onChange={(e) => { setScope(e.target.value); setPage(1) }} aria-label="Filter by type">
            <option value="">All matches</option>
            <option value="friendly">Friendlies only</option>
          </Select>
        </div>
        {isLoading ? <TableSkeleton cols={6} /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !data?.results.length ? (
          <EmptyState title="No matches found" text="Adjust the filters or create a new match." action={isAdmin ? <Button variant="primary" onClick={() => setOpen(true)}>Create match</Button> : undefined} />
        ) : (
          <div className={isFetching ? 'opacity-70 transition' : ''}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead><tr><th className="th">Match</th><th className="th">Teams</th><th className="th">When / where</th><th className="th">Score</th><th className="th">Status</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results.map((m) => (
                    <tr key={m.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/matches/${m.id}`)}>
                      <td className="td"><Link to={`/matches/${m.id}`} className="font-semibold text-slate-900 hover:text-court-700" onClick={(e) => e.stopPropagation()}>{m.name}</Link><div className="text-xs text-slate-500">{m.tournament?.name ?? 'Friendly'} · {m.reference}</div></td>
                      <td className="td text-slate-700">{m.teams[0].name}<span className="mx-1.5 text-slate-400">vs</span>{m.teams[1].name}</td>
                      <td className="td text-slate-600">{fmtDateTime(m.scheduledAt)}<div className="text-xs text-slate-500">{m.court?.name ?? 'No court'}</div></td>
                      <td className="td tabular-nums text-slate-700">{scoreline(m.state)}</td>
                      <td className="td"><StatusBadge status={m.status} /></td>
                      <td className="td text-right">
                        {['scheduled', 'ready', 'live', 'paused'].includes(m.status) && <Link to={`/score/${m.id}`} onClick={(e) => e.stopPropagation()} className="btn-brand btn-sm">Score</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </div>
        )}
      </Card>
      {open && <MatchFormModal open onClose={() => setOpen(false)} onSaved={(m) => nav(`/matches/${m.id}`)} />}
    </>
  )
}
