import { useSearchParams } from 'react-router-dom'
import { Select } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Paginated, Tournament } from '@/types'

/** Tournament picker that keeps the selection in the URL (?t=ID) so pages are linkable. */
export function useTournamentChoice() {
  const [sp, setSp] = useSearchParams()
  const { data } = useGet<Paginated<Tournament>>('/api/admin/tournaments/', { page_size: 100 })
  const list = data?.results ?? []
  const selected = list.find((t) => String(t.id) === sp.get('t')) ?? list[0]
  const select = (
    <Select className="w-72" value={selected?.id ?? ''} onChange={(e) => setSp({ t: e.target.value })} aria-label="Tournament">
      {!list.length && <option value="">No tournaments</option>}
      {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </Select>
  )
  return { selected, select, loaded: !!data }
}
