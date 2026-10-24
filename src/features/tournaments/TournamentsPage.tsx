import { CalendarDays, MapPin, Plus, Search, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { mediaUrl } from '@/api/client'
import { Button, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Skeleton, StatusBadge } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Paginated, Tournament } from '@/types'
import { fmtDate } from '@/utils/format'
import { TournamentFormModal } from './TournamentFormModal'

const FORMAT_LABEL = { round_robin: 'Round robin', groups_knockout: 'Groups + knockout', single_elimination: 'Single elimination' }

export default function TournamentsPage() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const creating = sp.get('new') === '1'
  const { data, isLoading, error, refetch } = useGet<Paginated<Tournament>>('/api/admin/tournaments/', { page, search, status, page_size: 12 })

  return (
    <>
      <PageHeader title="Tournaments" subtitle="Create, publish and run tournaments" actions={<Button variant="primary" onClick={() => setSp({ new: '1' })}><Plus className="h-4 w-4" /> New tournament</Button>} />
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search tournaments…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} aria-label="Search tournaments" />
        </div>
        <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filter by status">
          <option value="">All statuses</option>{['draft', 'published', 'completed', 'archived', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        : error ? <ErrorState error={error} retry={() => refetch()} />
        : !data?.results.length ? <div className="card"><EmptyState title="No tournaments" text="Create your first tournament to register teams and generate fixtures." action={<Button variant="primary" onClick={() => setSp({ new: '1' })}>New tournament</Button>} /></div>
        : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.results.map((t) => (
                <Link key={t.id} to={`/tournaments/${t.id}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
                  <div className="relative h-28 bg-gradient-to-br from-ink-800 to-court-800">
                    {t.cover_url && <img src={mediaUrl(t.cover_url) ?? ''} alt="" className="h-full w-full object-cover opacity-70" />}
                    <div className="absolute left-4 top-4"><StatusBadge status={t.status} /></div>
                    <div className="absolute -bottom-6 left-4 grid h-14 w-14 place-items-center overflow-hidden rounded-xl border-4 border-white bg-white shadow-card">
                      {t.logo_url ? <img src={mediaUrl(t.logo_url) ?? ''} alt="" className="h-full w-full object-cover" /> : <Trophy className="h-6 w-6 text-court-600" />}
                    </div>
                  </div>
                  <div className="space-y-2 p-4 pt-9">
                    <h3 className="truncate font-bold text-slate-900 group-hover:text-court-700">{t.name}</h3>
                    <p className="text-xs font-medium text-slate-500">{FORMAT_LABEL[t.format]} · {t.visibility}</p>
                    <div className="space-y-1 text-xs text-slate-500">
                      <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(t.start_date)} – {fmtDate(t.end_date)}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{t.venue || 'No venue'}</p>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600"><span>{t.teams_count} teams</span><span>{t.matches_completed}/{t.matches_total} matches</span></div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 card"><Pagination page={page} count={data.count} pageSize={12} onPage={setPage} /></div>
          </>
        )}
      {creating && <TournamentFormModal onClose={() => setSp({})} onSaved={(t) => nav(`/tournaments/${t.id}`)} />}
    </>
  )
}
