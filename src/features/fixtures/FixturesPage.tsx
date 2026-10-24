import { useState } from 'react'
import { EmptyState, PageHeader } from '@/components/ui'
import { useTournamentChoice } from '@/features/tournaments/TournamentSelect'
import type { Fixture } from '@/types'
import { Bracket, FixtureTable, FixturesLoading, useFixtures } from './FixtureViews'
import { ScheduleModal } from './ScheduleModal'

export default function FixturesPage() {
  const { selected, select, loaded } = useTournamentChoice()
  const { data, isLoading } = useFixtures(selected?.id)
  const [sched, setSched] = useState<Fixture | null>(null)

  return (
    <>
      <PageHeader title="Fixtures" subtitle="Schedule matches, assign courts and umpires" actions={select} />
      {loaded && !selected ? <div className="card"><EmptyState title="No tournaments yet" text="Create a tournament first." /></div>
        : isLoading || !data ? <FixturesLoading />
        : (
          <div className="space-y-8">
            <FixtureTable fixtures={data.filter((f) => f.stage === 'group')} onSchedule={setSched} />
            {data.some((f) => f.stage === 'knockout') && (
              <section>
                <h2 className="mb-3 text-lg font-bold text-slate-900">Knockout stage</h2>
                <Bracket fixtures={data} />
                <div className="mt-5"><FixtureTable fixtures={data.filter((f) => f.stage === 'knockout')} onSchedule={setSched} /></div>
              </section>
            )}
          </div>
        )}
      {sched && <ScheduleModal fixture={sched} onClose={() => setSched(null)} />}
    </>
  )
}
