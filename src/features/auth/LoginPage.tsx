import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '@/api/client'
import { Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/store/auth'
import type { User } from '@/types'
import { errorMessage } from '@/utils/format'

const schema = z.object({ username: z.string().min(1, 'Enter your username'), password: z.string().min(1, 'Enter your password') })
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const { access, setTokens, setUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })
  if (access) return <Navigate to="/" replace />

  const submit = handleSubmit(async (v) => {
    setError(null)
    try {
      const t = await api.post<{ access: string; refresh: string }>('/api/auth/login/', v)
      setTokens(t.access, t.refresh)
      const me = await api.get<User>('/api/auth/me/')
      setUser(me)
      nav(loc.state?.from ?? (me.role === 'umpire' ? '/live' : '/dashboard'), { replace: true })
    } catch (e) {
      setError((e as { status?: number }).status === 401 ? 'Incorrect username or password.' : errorMessage(e))
    }
  })

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-ball-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-10 h-96 w-96 rounded-full bg-court-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3 text-lg font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ball-400 text-ink-900">P</span> Padel Control
        </div>
        <div className="relative">
          <p className="score-num text-8xl font-extrabold text-ball-400">40<span className="text-white/30">–</span>30</p>
          <h1 className="mt-6 max-w-md text-3xl font-bold leading-tight">Score every point. Run every tournament.</h1>
          <p className="mt-3 max-w-md text-slate-400">Live court-side scoring, fixtures, standings and reports in one place.</p>
        </div>
        <p className="relative text-xs text-slate-500">Authorised staff only.</p>
      </div>
      <div className="flex items-center justify-center bg-white p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use your administrator or umpire account.</p>
          </div>
          {error && <div role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
          <Field label="Username" error={errors.username?.message}>
            <Input autoComplete="username" autoFocus {...register('username')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>Sign in</Button>
        </form>
      </div>
    </div>
  )
}
