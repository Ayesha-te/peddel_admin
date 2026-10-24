import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Skeleton, StatusBadge } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Fixture } from '@/types'
import { fmtDateTime, setText } from '@/utils/format'

export function useFixtures(tournamentId?: number) {
  return useGet<Fixture[]>(tournamentId ? `/api/admin/tournaments/${tournamentId}/fixtures/` : null)
}

function Winner({ f, side }: { f: Fixture; side: 0 | 1 }) {
  const name = side === 0 ? f.team_a_name : f.team_b_name
  const won = f.match?.status === 'completed' && f.match.winnerIndex === side
  return <span className={clsx(won ? 'font-bold text-slate-900' : 'text-slate-600')}>{name}</span>
}

export function FixtureTable({ fixtures, onSchedule }: { fixtures: Fixture[]; onSchedule?: (f: Fixture) => void }) {
  const rows = fixtures.filter((f) => !f.is_bye)
  if (!rows.length) return <div className="card"><EmptyState title="No fixtures" text="Generate fixtures from the tournament page once teams are registered." /></div>
  const rounds = [...new Set(rows.map((f) => `${f.stage}|${f.round_name}`))]
  return (
    <div className="space-y-5">
      {rounds.map((key) => {
        const list = rows.filter((f) => `${f.stage}|${f.round_name}` === key)
        return (
          <div key={key} className="card overflow-hidden">
            <h3 className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">{list[0].round_name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {list.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3"><Winner f={f} side={0} /> <span className="mx-1.5 text-slate-300">vs</span> <Winner f={f} side={1} /></td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">{f.match?.sets.length ? f.match.sets.map(setText).join('  ') : ''}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{fmtDateTime(f.match?.scheduledAt)}<br />{f.match?.court ?? 'No court'}{f.match?.umpire ? ` · ${f.match.umpire}` : ''}</td>
                      <td className="px-3 py-3">{f.match && <StatusBadge status={f.match.status} />}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {onSchedule && f.match && !['completed', 'cancelled'].includes(f.match.status) && <Button size="sm" variant="secondary" onClick={() => onSchedule(f)}>Schedule</Button>}
                          {f.match && <Link to={`/matches/${f.match.id}`} className="btn-ghost btn-sm">Open</Link>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Visual knockout bracket: one column per round. */
export function Bracket({ fixtures }: { fixtures: Fixture[] }) {
  const ko = fixtures.filter((f) => f.stage === 'knockout')
  if (!ko.length) return <div className="card"><EmptyState title="No knockout stage" text="This tournament has no knockout bracket." /></div>
  const rounds = [...new Set(ko.map((f) => f.round_number))].sort((a, b) => a - b)
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-8">
        {rounds.map((r) => {
          const list = ko.filter((f) => f.round_number === r).sort((a, b) => a.position - b.position)
          return (
            <div key={r} className="flex w-64 flex-col">
              <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{list[0].round_name}</h3>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {list.map((f) => (
                  <div key={f.id} className={clsx('card overflow-hidden text-sm', f.is_bye && 'opacity-50')}>
                    {([0, 1] as const).map((s) => {
                      const won = f.match?.status === 'completed' && f.match.winnerIndex === s
                      return (
                        <div key={s} className={clsx('flex items-center justify-between gap-2 px-3 py-2', s === 0 && 'border-b border-slate-100', won && 'bg-emerald-50 font-bold')}>
                          <span className="truncate">{s === 0 ? f.team_a_name : f.team_b_name}</span>
                          <span className="tabular-nums text-xs text-slate-500">{f.match?.sets.map((x) => (x.super ? (x.games[s] ? 1 : 0) : x.games[s])).join(' ')}</span>
                        </div>
                      )
                    })}
                    {f.match && <div className="flex justify-between bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500"><span>{f.match.court ?? 'TBD'}</span><StatusBadge status={f.match.status} /></div>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const FixturesLoading = () => <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
