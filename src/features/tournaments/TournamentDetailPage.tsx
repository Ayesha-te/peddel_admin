import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Archive, Ban, Eye, EyeOff, Globe, Pencil, Plus, Trash2, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PUBLIC_SITE, api, mediaUrl } from '@/api/client'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Select, Skeleton, StatTile, StatusBadge, Tabs } from '@/components/ui'
import { Bracket, FixtureTable, FixturesLoading, useFixtures } from '@/features/fixtures/FixtureViews'
import { ScheduleModal } from '@/features/fixtures/ScheduleModal'
import { TournamentReportButtons } from '@/features/reports/DownloadButtons'
import { StandingsTables } from '@/features/standings/StandingsTables'
import { useGet, useSave } from '@/hooks/query'
import type { Fixture, Paginated, Registration, Team, Tournament } from '@/types'
import { fmtDate } from '@/utils/format'
import { FixtureGenerator } from './FixtureGenerator'
import { TournamentFormModal } from './TournamentFormModal'

type Tab = 'overview' | 'teams' | 'fixtures' | 'standings' | 'bracket' | 'reports'

export default function TournamentDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const path = `/api/admin/tournaments/${id}/`
  const [tab, setTab] = useState<Tab>('overview')
  const { data: t, isLoading, error, refetch } = useGet<Tournament>(path)
  const { data: regs } = useGet<Registration[]>(`${path}registrations/`)
  const { data: teams } = useGet<Paginated<Team>>('/api/admin/teams/', { page_size: 200 })
  const { data: fixtures, isLoading: fxLoading } = useFixtures(t?.id)
  const [edit, setEdit] = useState(false)
  const [gen, setGen] = useState(false)
  const [sched, setSched] = useState<Fixture | null>(null)
  const [pick, setPick] = useState('')
  const [confirm, setConfirm] = useState<null | { title: string; text: string; run: () => void; danger?: boolean }>(null)

  const all = ['/api/admin/tournaments', '/api/admin/matches', '/api/admin/dashboard']
  const setStatus = useSave((s: string) => api.post<Tournament>(`${path}set-status/`, { status: s }), { invalidate: all, success: 'Tournament updated' })
  const register = useSave((team_id: number) => api.post(`${path}registrations/`, { team_id }), { invalidate: all, success: 'Team registered', onSuccess: () => setPick('') })
  const unregister = useSave((rid: number) => api.del(`${path}registrations/${rid}/`), { invalidate: all, success: 'Team removed' })
  const remove = useSave(() => api.del(path), { invalidate: all, success: 'Tournament deleted', onSuccess: () => nav('/tournaments') })

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-56" /></div>
  if (error || !t) return <ErrorState error={error} retry={() => refetch()} />

  const registered = new Set(regs?.map((r) => r.team.id))
  const available = teams?.results.filter((x) => !registered.has(x.id)) ?? []
  const hasFixtures = !!t.fixtures_confirmed_at || !!fixtures?.length
  const open = t.status === 'draft' || t.status === 'published'
  const publicUrl = `${PUBLIC_SITE}/public-tournaments/${t.slug}`
  const ask = (title: string, text: string, run: () => void, danger = false) => setConfirm({ title, text, run, danger })

  return (
    <>
      <Link to="/tournaments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Tournaments</Link>
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 to-court-800 text-white">
        {t.cover_url && <img src={mediaUrl(t.cover_url) ?? ''} alt="" className="h-36 w-full object-cover opacity-40" />}
        <div className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            {t.logo_url && <img src={mediaUrl(t.logo_url) ?? ''} alt="" className="h-16 w-16 rounded-xl bg-white object-cover" />}
            <div>
              <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{t.name}</h1><StatusBadge status={t.status} /></div>
              <p className="mt-1 text-sm text-slate-300">{fmtDate(t.start_date)} – {fmtDate(t.end_date)} · {t.venue || 'No venue'} · {t.visibility}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {t.status === 'draft' && <Button variant="brand" loading={setStatus.isPending} onClick={() => setStatus.mutate('published')}><Eye className="h-4 w-4" /> Publish</Button>}
            {t.status === 'published' && <Button variant="secondary" onClick={() => ask('Unpublish tournament?', 'It will disappear from the public website immediately.', () => setStatus.mutate('draft'))}><EyeOff className="h-4 w-4" /> Unpublish</Button>}
            <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          </div>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' }, { id: 'teams', label: `Teams (${regs?.length ?? t.teams_count})` }, { id: 'fixtures', label: 'Fixtures' },
        { id: 'standings', label: 'Standings' }, { id: 'bracket', label: 'Bracket' }, { id: 'reports', label: 'Reports' },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Teams" value={t.teams_count} tone="court" /><StatTile label="Matches" value={t.matches_total} /><StatTile label="Completed" value={t.matches_completed} tone="emerald" />
            </div>
            <Card title="About"><div className="space-y-3 p-5 text-sm text-slate-700"><p>{t.description || 'No description.'}</p>{t.rules && <><h4 className="font-bold text-slate-900">Rules</h4><p className="whitespace-pre-line">{t.rules}</p></>}</div></Card>
            {t.champion_name && <Card className="border-ball-400 bg-ball-300/20 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Champion</p><p className="text-2xl font-bold text-slate-900">🏆 {t.champion_name}</p></Card>}
          </div>
          <div className="space-y-6">
            <Card title="Public page"><div className="space-y-3 p-5 text-sm">
              {t.status === 'published' || t.status === 'completed' ? (t.visibility === 'public' ? <><p className="flex items-center gap-2 font-medium text-emerald-700"><Globe className="h-4 w-4" /> Live on the public website</p><a className="break-all text-court-700 underline" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></> : <p className="text-amber-700">Published but marked private - not shown publicly.</p>) : <p className="text-slate-500">Publish the tournament to make it visible on the public website.</p>}
            </div></Card>
            <Card title="Lifecycle"><div className="space-y-2 p-5">
              {open && <Button variant="secondary" className="w-full" onClick={() => ask('Cancel tournament?', 'Cancelled tournaments are hidden from the public website.', () => setStatus.mutate('cancelled'), true)}><Ban className="h-4 w-4" /> Cancel tournament</Button>}
              {(t.status === 'published' || t.status === 'completed') && <Button variant="secondary" className="w-full" onClick={() => ask('Archive tournament?', 'Archived tournaments are removed from the public website but all data is kept.', () => setStatus.mutate('archived'))}><Archive className="h-4 w-4" /> Archive</Button>}
              {(t.status === 'archived') && <Button variant="secondary" className="w-full" onClick={() => setStatus.mutate('published')}>Restore (publish)</Button>}
              {(t.status === 'cancelled') && <Button variant="secondary" className="w-full" onClick={() => setStatus.mutate('draft')}>Reopen as draft</Button>}
              {!hasFixtures && ['draft', 'cancelled'].includes(t.status) && <Button variant="danger" className="w-full" onClick={() => ask('Delete tournament?', 'This permanently deletes the tournament and its registrations.', () => remove.mutate(undefined), true)}><Trash2 className="h-4 w-4" /> Delete</Button>}
            </div></Card>
          </div>
        </div>
      )}

      {tab === 'teams' && (
        <Card title="Registered teams" action={
          open && !hasFixtures && (
            <div className="flex gap-2">
              <Select className="w-56" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Team to register"><option value="">Select team…</option>{available.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
              <Button variant="primary" disabled={!pick} loading={register.isPending} onClick={() => register.mutate(Number(pick))}><Plus className="h-4 w-4" /> Register</Button>
            </div>
          )}>
          {!regs?.length ? <EmptyState title="No teams registered" text="Register at least two teams to generate fixtures. Create teams on the Teams page." /> : (
            <ul className="divide-y divide-slate-100">{regs.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3"><span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span><div><p className="font-semibold text-slate-900">{r.team.name}</p><p className="text-xs text-slate-500">{r.team.players.map((p) => p.full_name).join(' & ')}{r.group_name ? ` · ${r.group_name}` : ''}</p></div></div>
                {!hasFixtures && <Button variant="ghost" size="sm" aria-label={`Remove ${r.team.name}`} onClick={() => unregister.mutate(r.id)}><UserMinus className="h-4 w-4 text-rose-500" /></Button>}
              </li>
            ))}</ul>
          )}
        </Card>
      )}

      {tab === 'fixtures' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{hasFixtures ? `${fixtures?.filter((f) => !f.is_bye).length ?? 0} fixtures` : 'No fixtures generated yet.'}</p>
            <div className="flex gap-2">
              {open && <Button variant="primary" onClick={() => setGen(true)}>{hasFixtures ? 'Regenerate fixtures' : 'Generate fixtures'}</Button>}
            </div>
          </div>
          {fxLoading || !fixtures ? <FixturesLoading /> : <FixtureTable fixtures={fixtures} onSchedule={setSched} />}
        </div>
      )}
      {tab === 'standings' && <StandingsTables tournamentId={t.id} />}
      {tab === 'bracket' && (fxLoading || !fixtures ? <FixturesLoading /> : <Bracket fixtures={fixtures} />)}
      {tab === 'reports' && <Card title="Administrative reports"><div className="p-5"><TournamentReportButtons t={t} /></div></Card>}

      {edit && <TournamentFormModal item={t} onClose={() => setEdit(false)} onSaved={() => qc.invalidateQueries({ queryKey: [path] })} />}
      {gen && <FixtureGenerator tournament={t} existing={hasFixtures} onClose={() => setGen(false)} />}
      {sched && <ScheduleModal fixture={sched} onClose={() => setSched(null)} />}
      <ConfirmDialog open={!!confirm} title={confirm?.title ?? ''} text={confirm?.text} danger={confirm?.danger} onClose={() => setConfirm(null)} onConfirm={() => { confirm?.run(); setConfirm(null) }} />
    </>
  )
}
