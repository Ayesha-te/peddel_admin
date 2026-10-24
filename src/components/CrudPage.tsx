import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api } from '@/api/client'
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Pagination, TableSkeleton } from '@/components/ui'
import { useGet, useSave } from '@/hooks/query'
import type { Paginated } from '@/types'

export interface Column<T> { header: string; cell: (row: T) => ReactNode; className?: string }

/** Generic searchable, paginated table with create/edit/delete wired to a DRF endpoint. */
export function CrudPage<T extends { id: number }>({
  title, subtitle, path, columns, search = true, renderForm, noun, canDelete = () => true, extraActions, emptyText, params,
}: {
  title: string; subtitle?: string; path: string; columns: Column<T>[]; search?: boolean; noun: string
  renderForm: (props: { item?: T; onClose: () => void }) => ReactNode
  canDelete?: (row: T) => boolean
  extraActions?: (row: T) => ReactNode
  emptyText?: string
  params?: Record<string, string | number>
}) {
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<T | 'new' | null>(null)
  const [deleting, setDeleting] = useState<T | null>(null)
  const { data, isLoading, error, refetch, isFetching } = useGet<Paginated<T>>(path, { page, search: q, ...params })
  const del = useSave((id: number) => api.del(`${path}${id}/`), { invalidate: [path], success: `${noun} deleted`, onSuccess: () => setDeleting(null) })

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<Button variant="primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New {noun.toLowerCase()}</Button>} />
      <Card>
        {search && (
          <div className="border-b border-slate-100 p-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} aria-label={`Search ${title}`} />
            </div>
          </div>
        )}
        {isLoading ? <TableSkeleton cols={columns.length} /> : error ? <ErrorState error={error} retry={() => refetch()} /> : !data?.results.length ? (
          <EmptyState title={q ? 'No results' : `No ${title.toLowerCase()} yet`} text={q ? 'Try a different search.' : emptyText} action={!q ? <Button variant="primary" onClick={() => setEditing('new')}>Add {noun.toLowerCase()}</Button> : undefined} />
        ) : (
          <div className={isFetching ? 'opacity-70 transition' : ''}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr>{columns.map((c) => <th key={c.header} className="th">{c.header}</th>)}<th className="th w-28" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      {columns.map((c) => <td key={c.header} className={`td ${c.className ?? ''}`}>{c.cell(row)}</td>)}
                      <td className="td"><div className="flex justify-end gap-1">
                        {extraActions?.(row)}
                        <Button variant="ghost" size="sm" aria-label={`Edit ${noun}`} onClick={() => setEditing(row)}><Pencil className="h-4 w-4" /></Button>
                        {canDelete(row) && <Button variant="ghost" size="sm" aria-label={`Delete ${noun}`} onClick={() => setDeleting(row)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} count={data.count} onPage={setPage} />
          </div>
        )}
      </Card>
      {editing && renderForm({ item: editing === 'new' ? undefined : editing, onClose: () => setEditing(null) })}
      <ConfirmDialog open={!!deleting} danger title={`Delete ${noun.toLowerCase()}?`} text="This cannot be undone. Records that are in use cannot be deleted." confirmLabel="Delete" loading={del.isPending}
        onClose={() => setDeleting(null)} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  )
}
