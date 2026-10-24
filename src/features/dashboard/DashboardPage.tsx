import { CalendarClock, CheckCircle2, Plus, Radio, Trophy, Users, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatTile, StatusBadge } from '@/components/ui'
import { MatchFormModal } from '@/features/matches/MatchFormModal'
import { useGet } from '@/hooks/query'
import type { DashboardData } from '@/types'
import { fmtDateTime, scoreline } from '@/utils/format'

export default function DashboardPage() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const { data, isLoading, error, refetch } = useGet<DashboardData>('/api/admin/dashboard/', undefined, { refetchInterval: 15000 })

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your tournaments and matches"
        actions={<>
          <Button variant="secondary" onClick={() => nav('/tournaments?new=1')}><Trophy className="h-4 w-4" /> New tournament</Button>
          <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New match</Button>
        </>} />
      {error ? <ErrorState error={error} retry={() => refetch()} /> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {isLoading || !data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />) : (<>
              <StatTile label="Tournaments" value={data.totals.tournaments} tone="court" icon={<Trophy className="h-5 w-5" />} />
              <StatTile label="Upcoming matches" value={data.totals.upcomingMatches} tone="amber" icon={<CalendarClock className="h-5 w-5" />} />
              <StatTile label="Live matches" value={data.totals.liveMatches} tone="rose" icon={<Radio className="h-5 w-5" />} />
              <StatTile label="Completed matches" value={data.totals.completedMatches} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
              <StatTile label="Registered players" value={data.totals.players} icon={<Users className="h-5 w-5" />} />
              <StatTile label="Registered teams" value={data.totals.teams} icon={<UsersRound className="h-5 w-5" />} />
            </>)}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card title="Live now" action={<Link to="/live" className="text-xs font-semibold text-court-700 hover:underline">Open scoring</Link>}>
                {data?.live.length ? (
                  <ul className="divide-y divide-slate-100">{data.live.map((m) => (
                    <li key={m.id}><Link to={`/matches/${m.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{m.teams[0].name} vs {m.teams[1].name}</p><p className="text-xs text-slate-500">{m.court?.name ?? 'No court'} · {scoreline(m.state)}</p></div>
                      <StatusBadge status={m.status} />
                    </Link></li>
                  ))}</ul>
                ) : <EmptyState title="Nothing live right now" />}
              </Card>
              <Card title="Upcoming matches" action={<Link to="/matches" className="text-xs font-semibold text-court-700 hover:underline">All matches</Link>}>
                {data?.upcoming.length ? (
                  <ul className="divide-y divide-slate-100">{data.upcoming.map((m) => (
                    <li key={m.id}><Link to={`/matches/${m.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50">
                      <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{m.name}</p><p className="text-xs text-slate-500">{m.teams[0].name} vs {m.teams[1].name}</p></div>
                      <div className="text-right text-xs text-slate-500">{fmtDateTime(m.scheduledAt)}<br />{m.court?.name ?? 'No court'}</div>
                    </Link></li>
                  ))}</ul>
                ) : <EmptyState title="No upcoming matches" text="Create a match or generate tournament fixtures." action={<Button variant="primary" onClick={() => setOpen(true)}>New match</Button>} />}
              </Card>
            </div>
            <Card title="Recent activity">
              {data?.recentActivity.length ? (
                <ul className="divide-y divide-slate-100">{data.recentActivity.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm"><span className="font-semibold text-slate-900">{a.actor}</span> <span className="text-slate-600">{a.action.replace(/[._]/g, ' ')}</span><div className="text-xs text-slate-400">{new Date(a.at).toLocaleString()}</div></li>
                ))}</ul>
              ) : <EmptyState title="No activity yet" />}
            </Card>
          </div>
        </>
      )}
      {open && <MatchFormModal open onClose={() => setOpen(false)} onSaved={(m) => nav(`/matches/${m.id}`)} />}
    </>
  )
}
