import { create } from 'zustand'
import type { User } from '@/types'

const KEY = 'padel-admin-auth'

interface Persisted {
  access: string | null
  refresh: string | null
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    /* storage may be unavailable */
  }
  return { access: null, refresh: null }
}

function save(p: Persisted) {
  try {
    if (p.access || p.refresh) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

interface AuthState extends Persisted {
  user: User | null
  setTokens: (access: string, refresh?: string) => void
  setUser: (u: User | null) => void
  logout: () => void
}

/** Tokens only (never application data) are persisted so a refresh keeps the session. */
export const useAuth = create<AuthState>((set, get) => ({
  ...load(),
  user: null,
  setTokens: (access, refresh) => {
    const next = { access, refresh: refresh ?? get().refresh }
    save(next)
    set(next)
  },
  setUser: (user) => set({ user }),
  logout: () => {
    save({ access: null, refresh: null })
    set({ access: null, refresh: null, user: null })
  },
}))
