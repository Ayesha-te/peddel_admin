import { Link } from 'react-router-dom'
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { useTournamentChoice } from '@/features/tournaments/TournamentSelect'
import { useGet } from '@/hooks/query'
import type { Match, Paginated } from '@/types'
import { fmtDateTime, scoreline } from '@/utils/format'
import { TournamentReportButtons } from './DownloadButtons'

export default function ReportsPage() {
  const { selected, select, loaded } = useTournamentChoice()
  const { data: matches } = useGet<Paginated<Match>>(selected ? '/api/admin/matches/' : null, { tournament: selected?.id, status: 'completed', page_size: 50, ordering: '-scheduled_at' })
  return (
    <>
      <PageHeader title="Administrative Reports" subtitle="PDF exports are available to administrators only and are generated from stored results" actions={select} />
      {loaded && !selected ? <div className="card"><EmptyState title="No tournaments yet" /></div> : selected && (
        <div className="space-y-6">
          <Card title={`${selected.name} — tournament reports`} action={<StatusBadge status={selected.status} />}>
            <div className="p-5"><TournamentReportButtons t={selected} /></div>
          </Card>
          <Card title="Completed match results">
            {matches?.results.length ? (
              <ul className="divide-y divide-slate-100">
                {matches.results.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div><p className="font-semibold text-slate-900">{m.teams[0].name} vs {m.teams[1].name}</p><p className="text-xs text-slate-500">{fmtDateTime(m.scheduledAt)} · {scoreline(m.state)}</p></div>
                    <Link to={`/matches/${m.id}`} className="btn-secondary btn-sm">Open &amp; download PDF</Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No completed matches yet" text="Match result PDFs appear on each completed match's page." />}
          </Card>
        </div>
      )}
    </>
  )
}
