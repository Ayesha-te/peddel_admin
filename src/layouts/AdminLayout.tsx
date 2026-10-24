import clsx from 'clsx'
import {
  BarChart3, CalendarDays, FileText, LayoutDashboard, LogOut, MapPin, Menu, Radio, Settings, Swords, Trophy, UserCog, Users, UsersRound, X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useRole } from '@/features/auth/guards'
import { useAuth } from '@/store/auth'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, admin: true },
  { to: '/matches', label: 'Matches', icon: Swords },
  { to: '/live', label: 'Live Scoring', icon: Radio },
  { to: '/players', label: 'Players', icon: Users, admin: true },
  { to: '/teams', label: 'Teams', icon: UsersRound, admin: true },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy, admin: true },
  { to: '/fixtures', label: 'Fixtures', icon: CalendarDays, admin: true },
  { to: '/standings', label: 'Standings', icon: BarChart3, admin: true },
  { to: '/courts', label: 'Courts', icon: MapPin, admin: true },
  { to: '/umpires', label: 'Umpires', icon: UserCog, admin: true },
  { to: '/reports', label: 'Administrative Reports', icon: FileText, admin: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const { isAdmin } = useRole()
  const items = NAV.filter((n) => isAdmin || !n.admin)

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={() => setOpen(false)}
          className={({ isActive }) => clsx('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
            isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
          {({ isActive }) => (<>
            <Icon className={clsx('h-[18px] w-[18px]', isActive && 'text-ball-400')} />
            {label}
          </>)}
        </NavLink>
      ))}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5 text-white">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ball-400 font-black text-ink-900">P</span>
      <span className="text-base font-bold tracking-tight">Padel Control</span>
    </div>
  )
  const userBlock = (
    <div className="border-t border-white/10 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-court-600 text-sm font-bold text-white">{(user?.display_name ?? '?')[0].toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user?.display_name}</p>
          <p className="truncate text-xs capitalize text-slate-400">{user?.role.replace('_', ' ')}</p>
        </div>
      </div>
      <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-900 lg:flex">{brand}{nav}{userBlock}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-900">
            <button className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {brand}{nav}{userBlock}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
          <span className="font-bold text-slate-900">Padel Control</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  )
}

