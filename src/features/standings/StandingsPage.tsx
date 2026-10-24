import { EmptyState, PageHeader } from '@/components/ui'
import { useTournamentChoice } from '@/features/tournaments/TournamentSelect'
import { StandingsTables } from './StandingsTables'

export default function StandingsPage() {
  const { selected, select, loaded } = useTournamentChoice()
  return (
    <>
      <PageHeader title="Standings" subtitle="Calculated automatically from confirmed results" actions={select} />
      {loaded && !selected ? <div className="card"><EmptyState title="No tournaments yet" /></div> : selected && (
        <>
          <p className="mb-4 text-sm text-slate-500">Ranking order: {selected.ranking_criteria.map((c) => c.replace('_', ' ')).join(' → ')}. Highlighted rows have qualified for the knockout stage.</p>
          <StandingsTables tournamentId={selected.id} />
        </>
      )}
    </>
  )
}
