import { Clock, MapPin, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Match, Paginated } from '@/types'
import { fmtDateTime, scoreline } from '@/utils/format'

function MatchCard({ m }: { m: Match }) {
  const live = m.status === 'live' || m.status === 'paused'
  return (
    <article className="card flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-900">{m.name}</h3>
          <p className="truncate text-xs text-slate-500">{m.tournament?.name ?? 'Friendly'}</p>
        </div>
        <StatusBadge status={m.status} />
      </div>
      <div className="space-y-1.5 rounded-xl bg-ink-900 p-4 text-white">
        {m.teams.map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold">{t.name}</span>
            <span className="score-num text-2xl font-bold text-ball-400">{live ? m.display.pointLabels[i] : ''}</span>
          </div>
        ))}
        <p className="pt-1 text-xs text-slate-400">{scoreline(m.state)}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDateTime(m.scheduledAt)}</span>
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{m.court?.name ?? 'No court'}</span>
      </div>
      <Link to={`/score/${m.id}`} className={live ? 'btn-brand' : 'btn-primary'}>{live ? 'Continue scoring' : 'Start scoring'}</Link>
    </article>
  )
}

export default function LiveScoringPage() {
  const { data, isLoading, error, refetch } = useGet<Paginated<Match>>('/api/admin/matches/', {
    status: 'live,paused,ready,scheduled', ordering: 'scheduled_at', page_size: 60,
  }, { refetchInterval: 10000 })
  const live = data?.results.filter((m) => m.status === 'live' || m.status === 'paused') ?? []
  const upcoming = data?.results.filter((m) => !['live', 'paused'].includes(m.status)) ?? []

  return (
    <>
      <PageHeader title="Live Scoring" subtitle="Pick a match to open the court-side scoring console" />
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        : error ? <ErrorState error={error} retry={() => refetch()} />
        : !data?.results.length ? <div className="card"><EmptyState title="No matches to score" text="Matches assigned to you that are scheduled, ready or live will appear here." /></div>
        : (
          <div className="space-y-8">
            {live.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-rose-600"><Radio className="h-4 w-4" /> In progress</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{live.map((m) => <MatchCard key={m.id} m={m} />)}</div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Up next</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map((m) => <MatchCard key={m.id} m={m} />)}</div>
              </section>
            )}
          </div>
        )}
    </>
  )
}
