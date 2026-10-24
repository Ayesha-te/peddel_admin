import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, Copy, Download, Edit3, FileText, Pencil, Play, QrCode, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, downloadFile, fetchBlobUrl } from '@/api/client'
import { toast } from '@/components/toast'
import { Button, Card, ConfirmDialog, ErrorState, Skeleton, StatusBadge } from '@/components/ui'
import { useRole } from '@/features/auth/guards'
import { Scoreboard } from '@/features/scoring/Scoreboard'
import { useGet, useSave } from '@/hooks/query'
import type { Match } from '@/types'
import { fmtDateTime, fmtDuration } from '@/utils/format'
import { MatchFormModal } from './MatchFormModal'
import { ResultModal } from './ResultModal'

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{v}</dd></div>
)

export default function MatchDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const { isAdmin } = useRole()
  const path = `/api/admin/matches/${id}/`
  const { data: m, isLoading, error, refetch } = useGet<Match>(path, undefined, { refetchInterval: 15000 })
  const { data: hist } = useGet<{ events: { sequence: number; event_type: string; team_index: number | null; created_at: string; reason: string }[] }>(`${path}history/`, { limit: 15 })
  const [edit, setEdit] = useState(false)
  const [result, setResult] = useState(false)
  const [del, setDel] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => () => { if (qr) URL.revokeObjectURL(qr) }, [qr])

  const refresh = ['/api/admin/matches', '/api/admin/dashboard', '/api/admin/tournaments']
  const status = useSave((s: string) => api.post(`${path}status/`, { status: s }), { invalidate: refresh, success: 'Status updated' })
  const verify = useSave(() => api.post(`${path}verify/`), { invalidate: refresh, success: 'Result verified' })
  const remove = useSave(() => api.del(path), { invalidate: refresh, success: 'Match deleted', onSuccess: () => nav('/matches') })

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-48" /></div>
  if (error || !m) return <ErrorState error={error} retry={() => refetch()} />

  const unstarted = ['draft', 'scheduled', 'ready'].includes(m.status) && m.revision === 0
  const canScore = ['scheduled', 'ready', 'live', 'paused'].includes(m.status)
  const completed = m.status === 'completed'

  const showQr = async () => {
    try { setQr(await fetchBlobUrl(`${path}qr/`)) } catch (e) { toast.fromError(e) }
  }
  const downloadPdf = async () => {
    setPdfBusy(true)
    try { await downloadFile(`/api/admin/reports/matches/${m.id}/pdf/`, `match-result-${m.reference}.pdf`) } catch (e) { toast.fromError(e) } finally { setPdfBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(m.shareUrl); toast.ok('Link copied') } catch { toast.err('Could not copy automatically. Select the link above and copy it.') }
  }

  return (
    <>
      <Link to="/matches" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Matches</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-900">{m.name}</h1><StatusBadge status={m.status} /></div>
          <p className="mt-1 text-sm text-slate-500">{m.reference} · {m.tournament ? <Link className="text-court-700 hover:underline" to={`/tournaments/${m.tournament.id}`}>{m.tournament.name}</Link> : 'Friendly match'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canScore && <Link to={`/score/${m.id}`} className="btn-brand"><Play className="h-4 w-4" /> {m.status === 'live' || m.status === 'paused' ? 'Open scoring' : 'Start scoring'}</Link>}
          {isAdmin && <Button variant="secondary" onClick={() => setEdit(true)}><Edit3 className="h-4 w-4" /> Edit</Button>}
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-ink-900 p-3 sm:p-4">
        <Scoreboard teams={m.teams} state={m.state} display={m.display} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Match information">
            <dl className="px-5 py-2">
              <Row k="Scheduled" v={fmtDateTime(m.scheduledAt)} />
              <Row k="Court" v={m.court?.name ?? '—'} />
              <Row k="Umpire" v={m.umpire?.name ?? '—'} />
              <Row k="Format" v={`Best of ${m.config.bestOf}${m.config.goldenPoint ? ' · golden point' : ' · advantage'}${m.config.superTiebreak ? ' · super tie-break decider' : ''}`} />
              <Row k="Duration" v={m.startedAt ? fmtDuration(m.durationSeconds) : '—'} />
              <Row k="Revision" v={m.revision} />
              {completed && <Row k="Result" v={m.resultVerified ? <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck className="h-4 w-4" /> Verified</span> : 'Awaiting verification'} />}
            </dl>
          </Card>
          <Card title="Players">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {m.teams.map((t, i) => (
                <div key={i}><p className="mb-1 font-semibold text-slate-900">{t.name}</p><ul className="text-sm text-slate-600">{t.players.map((p) => <li key={p.id}>{p.name}</li>)}</ul></div>
              ))}
            </div>
          </Card>
          <Card title="Recent scoring events">
            {hist?.events.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {hist.events.map((e) => (
                  <li key={e.sequence} className="flex items-center justify-between px-5 py-2.5">
                    <span><span className="mr-2 font-mono text-xs text-slate-400">#{e.sequence}</span><span className="capitalize">{e.event_type}</span>{e.team_index != null && ` · ${m.teams[e.team_index].name}`}{e.reason && <span className="text-slate-500"> — {e.reason}</span>}</span>
                    <time className="text-xs text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</time>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-6 text-sm text-slate-500">No scoring events yet.</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Share">
            <div className="space-y-3 p-5">
              <p className="break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{m.shareUrl}</p>
              <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={copy}><Copy className="h-3.5 w-3.5" /> Copy link</Button><Button variant="secondary" size="sm" onClick={showQr}><QrCode className="h-3.5 w-3.5" /> QR code</Button></div>
              {qr && <img src={qr} alt="QR code for the live spectator page" className="mx-auto h-44 w-44 rounded-lg border border-slate-200" />}
              {!m.isPublic && !m.tournament && <p className="text-xs text-amber-700">This friendly is private: the link will not work for spectators.</p>}
            </div>
          </Card>

          {isAdmin && (
            <Card title="Administration">
              <div className="space-y-2 p-5">
                <Button variant="primary" className="w-full" onClick={downloadPdf} loading={pdfBusy} disabled={!completed}><Download className="h-4 w-4" /> Download Match Result PDF</Button>
                {!completed && <p className="text-xs text-slate-500">Available once the match is completed.</p>}
                {completed && !m.resultVerified && <Button variant="brand" className="w-full" loading={verify.isPending} onClick={() => verify.mutate(undefined)}><BadgeCheck className="h-4 w-4" /> Verify result</Button>}
                {m.status !== 'cancelled' && <Button variant="secondary" className="w-full" onClick={() => setResult(true)}><Pencil className="h-4 w-4" /> {completed ? 'Correct result' : 'Enter result manually'}</Button>}
                {unstarted && m.status === 'scheduled' && <Button variant="secondary" className="w-full" onClick={() => status.mutate('ready')}>Mark ready</Button>}
                {unstarted && m.status === 'ready' && <Button variant="secondary" className="w-full" onClick={() => status.mutate('scheduled')}>Back to scheduled</Button>}
                {!completed && m.status !== 'cancelled' && <Button variant="secondary" className="w-full" onClick={() => status.mutate('cancelled')}>Cancel match</Button>}
                {unstarted && !m.tournament && <Button variant="danger" className="w-full" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /> Delete match</Button>}
              </div>
            </Card>
          )}
          <Card className="p-5"><p className="flex items-center gap-2 text-xs text-slate-500"><FileText className="h-4 w-4" /> PDF reports are generated from stored results and are available to administrators only.</p></Card>
        </div>
      </div>

      {edit && <MatchFormModal open match={m} onClose={() => setEdit(false)} onSaved={() => qc.invalidateQueries({ queryKey: [path] })} />}
      {result && <ResultModal match={m} onClose={() => setResult(false)} />}
      <ConfirmDialog open={del} danger title="Delete match?" text="This permanently removes the match. Started matches cannot be deleted." confirmLabel="Delete" loading={remove.isPending} onClose={() => setDel(false)} onConfirm={() => remove.mutate(undefined)} />
    </>
  )
}
