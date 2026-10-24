import { CheckCircle2, XCircle } from 'lucide-react'
import { create } from 'zustand'

interface Toast { id: number; kind: 'ok' | 'err'; text: string }
interface ToastState {
  toasts: Toast[]
  push: (kind: Toast['kind'], text: string) => void
  dismiss: (id: number) => void
}
let n = 0

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++n
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'err' ? 6000 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  ok: (t: string) => useToasts.getState().push('ok', t),
  err: (t: string) => useToasts.getState().push('err', t),
  fromError: (e: unknown) => useToasts.getState().push('err', e instanceof Error ? e.message : 'Something went wrong'),
}

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)} className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl bg-ink-900 px-4 py-3 text-left text-sm font-medium text-white shadow-pop">
          {t.kind === 'ok' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-ball-400" /> : <XCircle className="h-5 w-5 shrink-0 text-rose-400" />}
          {t.text}
        </button>
      ))}
    </div>
  )
}
