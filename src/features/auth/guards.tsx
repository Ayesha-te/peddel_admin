import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ApiError, api } from '@/api/client'
import { Button, Spinner } from '@/components/ui'
import { useAuth } from '@/store/auth'
import type { Role, User } from '@/types'

/** Loads the current user once a token exists; redirects to /login otherwise. */
export function RequireAuth() {
  const { access, user, setUser, logout } = useAuth()
  const loc = useLocation()
  const [failed, setFailed] = useState(false)
  const inflight = useRef(false)
  const load = () => {
    if (inflight.current) return
    inflight.current = true
    setFailed(false)
    api.get<User>('/api/auth/me/')
      .then(setUser)
      .catch((e) => {
        // only an authentication failure ends the session; network/server hiccups just show a retry
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) logout()
        else setFailed(true)
      })
      .finally(() => { inflight.current = false })
  }
  useEffect(() => {
    if (access && !user) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, user])
  if (!access) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!user)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-400">
        {failed ? (<><p className="text-sm text-slate-600">Cannot reach the server.</p><Button variant="secondary" onClick={load}>Retry</Button></>) : <Spinner className="h-7 w-7" />}
      </div>
    )
  return <Outlet />
}

/** UX guard only. Every endpoint is independently authorised by the backend. */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = useAuth((s) => s.user)
  if (user && !roles.includes(user.role)) return <Navigate to="/live" replace />
  return <>{children}</>
}

export const useRole = () => {
  const role = useAuth((s) => s.user?.role)
  return { role, isSuper: role === 'super_admin', isAdmin: role === 'super_admin' || role === 'tournament_admin', isUmpire: role === 'umpire' }
}
