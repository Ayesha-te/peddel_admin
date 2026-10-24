import { useState } from 'react'
import { api } from '@/api/client'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { useGet, useSave } from '@/hooks/query'
import type { Court, Fixture, Paginated, User } from '@/types'
import { fromLocalInput, toLocalInput } from '@/utils/format'

/** Assign court, umpire and time to a fixture's match (backend rejects double-booking). */
export function ScheduleModal({ fixture, onClose }: { fixture: Fixture; onClose: () => void }) {
  const { data: courts } = useGet<Paginated<Court>>('/api/admin/courts/', { page_size: 100 })
  const { data: umpires } = useGet<Paginated<User>>('/api/admin/users/', { role: 'umpire', page_size: 100 })
  const [court, setCourt] = useState('')
  const [umpire, setUmpire] = useState('')
  const [when, setWhen] = useState(toLocalInput(fixture.match?.scheduledAt))
  const save = useSave(
    (body: unknown) => api.patch(`/api/admin/matches/${fixture.match!.id}/`, body),
    { invalidate: ['/api/admin/tournaments', '/api/admin/matches', '/api/admin/dashboard'], success: 'Match scheduled', onSuccess: onClose },
  )
  return (
    <Modal open onClose={onClose} title={`Schedule: ${fixture.team_a_name} vs ${fixture.team_b_name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={save.isPending} onClick={() => {
          const body: Record<string, unknown> = { scheduled_at: fromLocalInput(when) }
          if (court) body.court = Number(court)
          if (umpire) body.umpire = Number(umpire)
          save.mutate(body)
        }}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Date & time"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Court" hint={fixture.match?.court ? `Currently ${fixture.match.court}` : undefined}>
          <Select value={court} onChange={(e) => setCourt(e.target.value)}><option value="">Keep current</option>{courts?.results.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label="Umpire" hint={fixture.match?.umpire ? `Currently ${fixture.match.umpire}` : undefined}>
          <Select value={umpire} onChange={(e) => setUmpire(e.target.value)}><option value="">Keep current</option>{umpires?.results.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}</Select>
        </Field>
      </div>
    </Modal>
  )
}
