# Admin panel + scoring console

React 19 + TypeScript + Vite + Tailwind 3 + React Router + TanStack Query + Zustand + React Hook Form + Zod.

```bash
npm install
cp .env.example .env        # VITE_API_BASE_URL=http://127.0.0.1:8000
npm run dev                 # http://localhost:5174
npm run build               # type-check + production build -> dist/
npm test                    # vitest (engine contract, optimistic scoring session, role-gated UI)
npm run test:e2e            # Playwright full journey (needs backend + admin + public site running)
```

Environment (build time): `VITE_API_BASE_URL` (required), `VITE_PUBLIC_SITE_URL` (links/QR targets), `VITE_WS_BASE_URL` (optional).

## Structure

```
src/api/            fetch client (JWT refresh, timeouts, authenticated downloads)
src/features/       auth, dashboard, matches, scoring, players, teams, tournaments, fixtures, standings, reports, settings
src/features/scoring/engine.ts        pure TS rules engine (optimistic UI only; backend is authoritative)
src/features/scoring/ScoreSession.ts  optimistic queue, idempotent retries, stale-revision reconciliation
src/components/     UI primitives, generic CRUD page, toasts
src/layouts/        AdminLayout (sidebar) and ScoringLayout (chrome-free console)
```

Roles in the UI: Super Admin / Tournament Admin see everything they manage; Umpires only see **Live Scoring**, their matches and settings.
UI hiding is cosmetic - the API enforces permissions.

Deploy on Vercel: root directory `admin`, framework Vite; `vercel.json` already contains the SPA rewrite so deep links work on refresh.
