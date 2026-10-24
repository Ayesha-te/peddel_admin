import { Check } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Standing } from '@/types'
import { Skeleton } from '@/components/ui'

export function StandingsTables({ tournamentId }: { tournamentId: number }) {
  const { data, isLoading } = useGet<Standing[]>(`/api/admin/tournaments/${tournamentId}/standings/`)
  if (isLoading) return <Skeleton className="h-40" />
  if (!data?.length) return <div className="card"><EmptyState title="No standings yet" text="Standings appear after fixtures are generated and group matches are completed." /></div>
  const groups = [...new Set(data.map((s) => s.group_name))]
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {groups.map((g) => (
        <div key={g} className="card overflow-hidden">
          <h3 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900">{g}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr>{['#', 'Team', 'P', 'W', 'L', 'Pts', 'Sets', 'SD', 'GD'].map((h) => <th key={h} className="th px-3 text-center first:text-left [&:nth-child(2)]:text-left">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.filter((s) => s.group_name === g).map((s) => (
                  <tr key={s.team_id} className={s.qualified ? 'bg-emerald-50/60' : ''}>
                    <td className="px-3 py-2.5 font-bold text-slate-500">{s.rank}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900"><span className="inline-flex items-center gap-1.5">{s.team_name}{s.qualified && <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Qualified" />}</span></td>
                    <td className="px-3 text-center tabular-nums">{s.played}</td><td className="px-3 text-center tabular-nums">{s.wins}</td><td className="px-3 text-center tabular-nums">{s.losses}</td>
                    <td className="px-3 text-center font-bold tabular-nums text-slate-900">{s.points}</td>
                    <td className="px-3 text-center tabular-nums">{s.sets_for}-{s.sets_against}</td>
                    <td className="px-3 text-center tabular-nums">{s.set_difference > 0 ? '+' : ''}{s.set_difference}</td>
                    <td className="px-3 text-center tabular-nums">{s.game_difference > 0 ? '+' : ''}{s.game_difference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
