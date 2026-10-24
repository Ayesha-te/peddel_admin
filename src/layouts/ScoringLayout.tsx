import { Outlet } from 'react-router-dom'

/** Chrome-free layout: the scoring console owns the whole viewport. */
export default function ScoringLayout() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <Outlet />
    </div>
  )
}
