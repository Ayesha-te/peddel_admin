import { Download } from 'lucide-react'
import { useState } from 'react'
import { downloadFile } from '@/api/client'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui'
import type { Tournament } from '@/types'

/** Administrative PDF downloads. Rendered only inside authenticated admin screens. */
export function TournamentReportButtons({ t }: { t: Tournament }) {
  const [busy, setBusy] = useState<string | null>(null)
  const final = t.status === 'completed' && !!t.champion
  const go = async (kind: 'full' | 'standings' | 'fixtures') => {
    setBusy(kind)
    const path = kind === 'full' ? 'pdf' : `${kind}/pdf`
    try {
      await downloadFile(`/api/admin/reports/tournaments/${t.id}/${path}/`, `${kind}-${t.slug}.pdf`)
    } catch (e) { toast.fromError(e) } finally { setBusy(null) }
  }
  return (
    <div className="space-y-3">
      <Button variant="primary" className="w-full sm:w-auto" loading={busy === 'full'} onClick={() => go('full')}>
        <Download className="h-4 w-4" /> {final ? 'Download Tournament Results PDF' : 'Download Tournament Progress PDF'}
      </Button>
      {!final && <p className="text-xs text-amber-700">The tournament is not finished: this report is clearly labelled as a provisional progress report.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={busy === 'standings'} onClick={() => go('standings')}><Download className="h-3.5 w-3.5" /> Group standings PDF</Button>
        <Button variant="secondary" size="sm" loading={busy === 'fixtures'} onClick={() => go('fixtures')}><Download className="h-3.5 w-3.5" /> Fixtures &amp; schedule PDF</Button>
      </div>
    </div>
  )
}
