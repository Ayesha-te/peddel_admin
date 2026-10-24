import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, Maximize2, Minimize2, Flag, Pause, Play, RefreshCw, Undo2, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button, ErrorState, Modal, Skeleton, Spinner, StatusBadge } from '@/components/ui'
import { useGet } from '@/hooks/query'
import type { Match } from '@/types'
import { fmtDuration } from '@/utils/format'
import { useClock, useMatchSocket, useOnline, useScoreSession, toConfirmed } from './hooks'
import { Scoreboard } from './Scoreboard'
import type { ScoreSession, View } from './ScoreSession'
import { setsWon } from './engine'

function SyncBadge({ view, online, onRetry }: { view: View; online: boolean; onRetry: () => void }) {
  if (view.sync === 'offline' || !online)
    return (
      <button onClick={onRetry} className="badge bg-amber-500/20 text-amber-300" title="Retry now">
        <CloudOff className="h-3.5 w-3.5" /> Offline · {view.pending} not saved <RefreshCw className="h-3 w-3" />
      </button>
    )
  if (view.sync === 'error')
    return (
      <button onClick={onRetry} className="badge bg-rose-500/20 text-rose-300">
        <AlertTriangle className="h-3.5 w-3.5" /> Not saved · retry
      </button>
    )
  if (view.sync === 'saving' || view.pending > 0)
    return <span className="badge bg-sky-500/20 text-sky-300"><Spinner className="h-3 w-3" /> Saving {view.pending > 0 ? view.pending : ''}…</span>
  return <span className="badge bg-emerald-500/20 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Saved · r{view.revision}</span>
}

export default function ScoreConsolePage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const path = `/api/admin/matches/${id}/`
  const { data: match, error, isLoading, refetch } = useGet<Match>(path)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const sessionRef = useRef<ScoreSession | null>(null)
  const reconcile = useCallback(async () => {
    try {
      const fresh = await api.get<Match>(path)
      qc.setQueryData([path, null], fresh)
      sessionRef.current?.reset(toConfirmed(fresh))
    } catch { /* still offline: the session keeps its notice; user can retry */ }
  }, [path, qc])
  const { session, view } = useScoreSession(match, () => void reconcile())
  sessionRef.current = session
  const online = useOnline()
  const wsUp = useMatchSocket(match?.publicId, (snap) => session?.adopt({ status: snap.status, revision: snap.revision, state: snap.state, config: snap.config, durationSeconds: snap.durationSeconds }))
  const seconds = useClock(view?.status === 'live', view?.durationSeconds ?? 0, view?.receivedAt ?? 0)

  const toggleFull = async () => {
    try {
      if (!document.fullscreenElement) { await wrapRef.current?.requestFullscreen(); setFull(true) }
      else { await document.exitFullscreen(); setFull(false) }
    } catch { /* fullscreen unsupported (iOS Safari) */ }
  }

  if (error && !match) return <div className="p-6"><ErrorState error={error} retry={() => refetch()} /></div>
  if (isLoading || !match || !view || !session)
    return <div className="mx-auto max-w-3xl space-y-4 p-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>

  const done = view.state.completed
  const paused = view.status === 'paused'
  const [sa, sb] = setsWon(view.state)
  const disabled = !view.canScore
  const teams = match.teams

  return (
    <div ref={wrapRef} className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 bg-ink-950 p-3 sm:p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Link to={`/matches/${match.id}`} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Back to match"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-white sm:text-lg">{match.name}</h1>
            <p className="truncate text-xs text-slate-400">{match.court?.name ?? 'No court'} · {match.tournament?.name ?? 'Friendly'} · {match.config.bestOf === 1 ? 'Best of 1' : 'Best of 3'}{match.config.goldenPoint ? ' · Golden point' : ''}</p>
          </div>
          <button onClick={toggleFull} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label={full ? 'Exit full screen' : 'Full screen'}>
            {full ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <StatusBadge status={view.status} />
          <span className="font-mono text-sm tabular-nums text-slate-300" aria-label="Match duration">{fmtDuration(seconds)}</span>
          <span className={clsx('badge', online ? 'bg-white/10 text-slate-300' : 'bg-amber-500/20 text-amber-300')} title={wsUp ? 'Live feed connected' : 'Live feed not connected'}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{online ? 'Online' : 'No connection'}
          </span>
          <SyncBadge view={view} online={online} onRetry={() => session.retryNow()} />
        </div>
      </header>

      {view.notice && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span>{view.notice}</span>
          <button className="font-semibold underline" onClick={() => session.clearNotice()}>Dismiss</button>
        </div>
      )}

      <Scoreboard teams={teams} state={view.state} display={view.display} large={full} />

      {done ? (
        <div className="rounded-2xl border border-ball-400/40 bg-ball-400/10 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-ball-300">Match completed</p>
          <p className="mt-1 text-2xl font-bold text-white">{view.state.winner != null ? teams[view.state.winner].name : '—'} wins</p>
          <p className="text-slate-300">Sets {sa}–{sb}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to={`/matches/${match.id}`} className="btn-brand">Open match page</Link>
            <Button variant="secondary" onClick={() => session.undo()} disabled={!view.canUndo}><Undo2 className="h-4 w-4" /> Undo last point</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4">
            {([0, 1] as const).map((t) => (
              <button
                key={t}
                disabled={disabled}
                onClick={() => session.tap(t)}
                className={clsx(
                  'flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center font-extrabold shadow-lg transition active:scale-[0.97] disabled:opacity-40 sm:min-h-[260px]',
                  t === 0 ? 'bg-court-500 text-ink-950 hover:bg-court-400' : 'bg-ball-400 text-ink-950 hover:bg-ball-300',
                )}
                aria-label={`Point for ${teams[t].name}`}
              >
                <span className="score-num text-5xl sm:text-7xl">+1</span>
                <span className="line-clamp-2 text-base sm:text-xl">{teams[t].name}</span>
              </button>
            ))}
          </div>
          {paused && <p className="text-center text-sm font-semibold text-amber-300">Match paused — resume to continue scoring</p>}
        </>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Button variant="secondary" className="min-h-[56px] !border-white/15 !bg-white/5 !text-white hover:!bg-white/10" disabled={!view.canUndo} onClick={() => session.undo()}>
          <Undo2 className="h-5 w-5" /> Undo
        </Button>
        {paused ? (
          <Button variant="brand" className="min-h-[56px]" onClick={() => session.resume()}><Play className="h-5 w-5" /> Resume</Button>
        ) : (
          <Button variant="secondary" className="min-h-[56px] !border-white/15 !bg-white/5 !text-white hover:!bg-white/10" disabled={done || view.status !== 'live'} onClick={() => session.pause()}>
            <Pause className="h-5 w-5" /> Pause
          </Button>
        )}
        <Button variant="danger" className="min-h-[56px]" disabled={done || !['live', 'paused'].includes(view.status)} onClick={() => setEndOpen(true)}>
          <Flag className="h-5 w-5" /> End match
        </Button>
      </div>

      <Modal open={endOpen} onClose={() => setEndOpen(false)} title="End match now?" footer={<Button variant="secondary" onClick={() => setEndOpen(false)}>Keep playing</Button>}>
        <p className="mb-4 text-sm text-slate-600">This finishes the match immediately (for example a retirement). Choose the winner. This cannot be undone here — use the result correction on the match page if needed.</p>
        <div className="grid gap-2">
          {([0, 1] as const).map((t) => (
            <Button key={t} variant={t === 0 ? 'brand' : 'primary'} onClick={() => { session.end(t); setEndOpen(false) }}>{teams[t].name} wins</Button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

