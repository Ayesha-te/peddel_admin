import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '@/api/client'
import { RulesEditor } from '@/features/matches/MatchFormModal'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { useSave } from '@/hooks/query'
import type { MatchConfig, Tournament } from '@/types'

const ALL_CRITERIA: Record<string, string> = {
  points: 'Points', wins: 'Wins', head_to_head: 'Head-to-head', set_difference: 'Set difference',
  game_difference: 'Game difference', sets_won: 'Sets won', games_won: 'Games won',
}

const schema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(140),
  slug: z.string().trim().regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and dashes only').optional().or(z.literal('')),
  format: z.enum(['round_robin', 'groups_knockout', 'single_elimination']),
  visibility: z.enum(['public', 'private']),
  venue: z.string().max(160),
  organizer: z.string().max(140),
  start_date: z.string(),
  end_date: z.string(),
  registration_deadline: z.string(),
  description: z.string(),
  rules: z.string(),
  points_win: z.coerce.number().int().min(0).max(10),
  points_loss: z.coerce.number().int().min(0).max(10),
  groups_count: z.coerce.number().int().min(1).max(8),
  qualifiers_per_group: z.coerce.number().int().min(1).max(8),
}).refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { path: ['end_date'], message: 'End date is before the start date' })
type Form = z.infer<typeof schema>

const DEFAULT_FORMAT: Partial<MatchConfig> = { bestOf: 3, goldenPoint: false, tiebreakEnabled: true, superTiebreak: true }

export function TournamentFormModal({ item, onClose, onSaved }: { item?: Tournament; onClose: () => void; onSaved?: (t: Tournament) => void }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '', slug: item?.slug ?? '', format: item?.format ?? 'groups_knockout', visibility: item?.visibility ?? 'public',
      venue: item?.venue ?? '', organizer: item?.organizer ?? '', start_date: item?.start_date ?? '', end_date: item?.end_date ?? '',
      registration_deadline: item?.registration_deadline ?? '', description: item?.description ?? '', rules: item?.rules ?? '',
      points_win: item?.points_win ?? 3, points_loss: item?.points_loss ?? 0, groups_count: item?.groups_count ?? 2, qualifiers_per_group: item?.qualifiers_per_group ?? 2,
    },
  })
  const [criteria, setCriteria] = useState<string[]>(item?.ranking_criteria ?? ['points', 'wins', 'head_to_head', 'set_difference', 'game_difference'])
  const [fmt, setFmt] = useState<MatchConfig>({ bestOf: 3, goldenPoint: false, tiebreakEnabled: true, tiebreakAt: 6, tiebreakPoints: 7, superTiebreak: true, superTiebreakPoints: 10, gamesPerSet: 6, firstServer: 0, ...(item?.match_format ?? DEFAULT_FORMAT) } as MatchConfig)
  const [logo, setLogo] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const format = watch('format')

  const save = useSave(async (body: Record<string, unknown>) => {
    let t = item ? await api.patch<Tournament>(`/api/admin/tournaments/${item.id}/`, body) : await api.post<Tournament>('/api/admin/tournaments/', body)
    if (logo || cover) {
      const fd = new FormData()
      if (logo) fd.append('logo', logo)
      if (cover) fd.append('cover_image', cover)
      t = await api.patch<Tournament>(`/api/admin/tournaments/${t.id}/`, fd)
    }
    return t
  }, { invalidate: ['/api/admin/tournaments'], success: item ? 'Tournament updated' : 'Tournament created', onSuccess: (t) => { onSaved?.(t); onClose() } })

  const move = (i: number, d: -1 | 1) => setCriteria((c) => { const n = [...c]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n })
  const submit = handleSubmit((v) => {
    const body: Record<string, unknown> = { ...v, match_format: fmt, ranking_criteria: criteria }
    ;['start_date', 'end_date', 'registration_deadline'].forEach((k) => { if (!body[k]) body[k] = null })
    if (!v.slug) delete body.slug
    save.mutate(body)
  })

  return (
    <Modal open onClose={onClose} wide title={item ? 'Edit tournament' : 'New tournament'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={submit}>{item ? 'Save changes' : 'Create tournament'}</Button></>}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tournament name" error={errors.name?.message} className="sm:col-span-2"><Input {...register('name')} autoFocus /></Field>
          {item && <Field label="URL slug" error={errors.slug?.message} hint="Used in the public link"><Input {...register('slug')} /></Field>}
          <Field label="Format"><Select {...register('format')} disabled={!!item?.fixtures_confirmed_at}>
            <option value="groups_knockout">Groups + knockout</option><option value="round_robin">Round robin</option><option value="single_elimination">Single elimination</option>
          </Select></Field>
          <Field label="Visibility"><Select {...register('visibility')}><option value="public">Public (when published)</option><option value="private">Private</option></Select></Field>
          <Field label="Venue"><Input {...register('venue')} /></Field>
          <Field label="Organizer"><Input {...register('organizer')} /></Field>
          <Field label="Start date"><Input type="date" {...register('start_date')} /></Field>
          <Field label="End date" error={errors.end_date?.message}><Input type="date" {...register('end_date')} /></Field>
          <Field label="Registration deadline"><Input type="date" {...register('registration_deadline')} /></Field>
        </div>
        <Field label="Description"><Textarea {...register('description')} /></Field>
        <Field label="Rules"><Textarea {...register('rules')} /></Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo" hint="PNG/JPEG/WebP ≤ 5 MB"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" /></Field>
          <Field label="Cover image"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" /></Field>
        </div>

        {format !== 'single_elimination' && (
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-2 text-sm font-bold text-slate-800">League table</legend>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Points / win" error={errors.points_win?.message}><Input type="number" {...register('points_win')} /></Field>
              <Field label="Points / loss" error={errors.points_loss?.message}><Input type="number" {...register('points_loss')} /></Field>
              {format === 'groups_knockout' && <>
                <Field label="Groups" error={errors.groups_count?.message}><Input type="number" {...register('groups_count')} /></Field>
                <Field label="Qualify / group" error={errors.qualifiers_per_group?.message}><Input type="number" {...register('qualifiers_per_group')} /></Field>
              </>}
            </div>
            <p className="label mt-4">Ranking criteria (in order)</p>
            <ol className="space-y-1.5">
              {criteria.map((c, i) => (
                <li key={c} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span><span className="flex-1 font-medium">{ALL_CRITERIA[c]}</span>
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={i === criteria.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" disabled={criteria.length === 1} onClick={() => setCriteria(criteria.filter((x) => x !== c))} aria-label="Remove" className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ol>
            {Object.keys(ALL_CRITERIA).filter((k) => !criteria.includes(k)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.keys(ALL_CRITERIA).filter((k) => !criteria.includes(k)).map((k) => (
                  <button key={k} type="button" onClick={() => setCriteria([...criteria, k])} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">+ {ALL_CRITERIA[k]}</button>
                ))}
              </div>
            )}
          </fieldset>
        )}
        <RulesEditor value={fmt} onChange={setFmt} title="Match format for every match in this tournament" subtitle="(number of sets and deuce / golden point - the umpire can still confirm or change it for a match before it starts)" />
      </form>
    </Modal>
  )
}
