import { expect, request as pwRequest, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const API = (process.env.E2E_API ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const ADMIN = (process.env.E2E_ADMIN_URL ?? 'http://localhost:5174').replace(/\/$/, '')
const PUBLIC = (process.env.E2E_PUBLIC_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin'
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? 'Padel#2026demo'

const run = Date.now().toString(36)
const ADMIN_STATE = 'test-results/admin-state.json'
const state: { api?: APIRequestContext; token?: string; tournamentId?: number; slug?: string; umpire?: string; matchId?: number; publicId?: string; teamIds: number[] } = { teamIds: [] }
const UMPIRE_PASS = 'Umpire#Pass2026'

async function loginApi(username: string, password: string) {
  const ctx = await pwRequest.newContext({ baseURL: API })
  const r = await ctx.post('/api/auth/login/', { data: { username, password } })
  expect(r.ok(), `login ${username}`).toBeTruthy()
  return { ctx, token: (await r.json()).access as string }
}
const auth = () => ({ Authorization: `Bearer ${state.token}` })

async function uiLogin(page: Page, username: string, password: string) {
  await page.goto(`${ADMIN}/login`)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}


/** The umpire decides the format at match time: pick best-of-N on the setup card and start. */
async function startMatch(page: Page, bestOf: 1 | 3 | 5) {
  await expect(page.getByRole('radiogroup', { name: /match format/i })).toBeVisible()
  await page.getByRole('radio', { name: new RegExp(`best of ${bestOf}`, 'i') }).click()
  await page.getByRole('button', { name: /start match/i }).click()
  await expect(page.getByRole('button', { name: /Point for/ }).first()).toBeVisible()
}

async function newContext(browser: Browser, admin = false): Promise<BrowserContext> {
  return browser.newContext({ acceptDownloads: true, storageState: admin ? ADMIN_STATE : undefined })
}

test.describe.serial('padel end-to-end journey', () => {
  test.use({ storageState: ADMIN_STATE })

  test.beforeAll(async ({ browser }) => {
    // one real UI login, reused by every admin test (also keeps us under the login rate limit)
    const bootstrap = await browser.newContext({ storageState: undefined })
    const bp = await bootstrap.newPage()
    await uiLogin(bp, ADMIN_USER, ADMIN_PASS)
    await expect(bp).toHaveURL(/dashboard/)
    await bootstrap.storageState({ path: ADMIN_STATE })
    await bootstrap.close()

    const { ctx, token } = await loginApi(ADMIN_USER, ADMIN_PASS)
    state.api = ctx
    state.token = token
    const post = async (path: string, data: unknown) => {
      const r = await ctx.post(path, { data, headers: auth() })
      expect(r.ok(), `${path}: ${await r.text()}`).toBeTruthy()
      return r.json()
    }
    state.umpire = `ump_${run}`
    await post('/api/admin/users/', { username: state.umpire, email: `${state.umpire}@e2e.test`, password: UMPIRE_PASS, role: 'umpire', first_name: 'E2E', last_name: 'Umpire' })
    await post('/api/admin/courts/', { name: `E2E Court ${run}`, venue: 'E2E' })
    for (let i = 1; i <= 4; i++) {
      const ids: number[] = []
      for (const k of [1, 2]) ids.push((await post('/api/admin/players/', { first_name: `E${run}T${i}P${k}`, last_name: 'Tester' })).id)
      state.teamIds.push((await post('/api/admin/teams/', { name: `E2E ${run} Team ${i}`, player_ids: ids })).id)
    }
  })

  test('1. admin creates a tournament in the UI', async ({ page }) => {
    await page.goto(`${ADMIN}/tournaments?new=1`)
    await page.getByLabel('Tournament name').fill(`E2E Open ${run}`)
    await page.getByLabel('Venue').fill('E2E Club')
    await page.locator('select[name="format"]').selectOption('groups_knockout')
    await page.locator('input[name="groups_count"]').fill('2')
    await page.locator('input[name="qualifiers_per_group"]').fill('1')
    await page.getByRole('radio', { name: /^Best of 1/ }).click() // the tournament decides the format of all its matches
    await page.getByRole('radio', { name: /^Golden point/ }).click()
    await page.getByRole('button', { name: 'Create tournament' }).click()
    await expect(page).toHaveURL(/\/tournaments\/\d+$/)
    state.tournamentId = Number(page.url().split('/').pop())
    await expect(page.getByRole('heading', { name: `E2E Open ${run}` })).toBeVisible()
  })

  test('2. admin registers teams and generates fixtures (preview then confirm)', async ({ page }) => {
    await page.goto(`${ADMIN}/tournaments/${state.tournamentId}`)
    await page.getByRole('tab', { name: /^Teams/ }).click()
    for (let i = 1; i <= 4; i++) {
      await page.getByLabel('Team to register').selectOption({ label: `E2E ${run} Team ${i}` })
      await page.getByRole('button', { name: 'Register', exact: true }).click()
      await expect(page.getByText(`E2E ${run} Team ${i}`).first()).toBeVisible()
    }
    // duplicate registration is impossible through the UI (team disappears from picker)
    await expect(page.getByLabel('Team to register').locator('option', { hasText: `E2E ${run} Team 1` })).toHaveCount(0)

    await page.getByRole('tab', { name: 'Fixtures' }).click()
    await page.getByRole('button', { name: 'Generate fixtures' }).click()
    await page.getByLabel('Number of groups').fill('2')
    await page.getByLabel('Teams qualifying per group').fill('1')
    await expect(page.getByRole('button', { name: /Confirm & generate/ })).toBeDisabled() // must preview first
    await page.getByRole('button', { name: /^(Preview|Refresh preview)$/ }).click()
    await expect(page.getByText('2 group(s)')).toBeVisible()
    await expect(page.getByText('2 group matches')).toBeVisible()
    await page.getByRole('button', { name: /Confirm & generate/ }).click()
    await expect(page.getByText('Group A - Round 1').first()).toBeVisible()
    // regenerate needs explicit replace confirmation
    await page.getByRole('button', { name: 'Regenerate fixtures' }).click()
    await page.getByRole('button', { name: /^(Preview|Refresh preview)$/ }).click()
    await expect(page.getByRole('button', { name: /Confirm & generate/ })).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('3. admin schedules a match, assigns umpire + court, and publishes', async ({ page }) => {
    const fx = await (await state.api!.get(`/api/admin/tournaments/${state.tournamentId}/fixtures/`, { headers: auth() })).json()
    const first = fx.find((f: any) => f.stage === 'group' && f.match)
    state.matchId = first.match.id
    const courts = await (await state.api!.get('/api/admin/courts/?page_size=100', { headers: auth() })).json()
    const court = courts.results.find((c: any) => c.name === `E2E Court ${run}`)
    const users = await (await state.api!.get(`/api/admin/users/?role=umpire&search=${state.umpire}`, { headers: auth() })).json()
    const patch = await state.api!.patch(`/api/admin/matches/${state.matchId}/`, { data: { court: court.id, umpire: users.results[0].id, scheduled_at: '2031-05-01T10:00:00Z' }, headers: auth() })
    expect(patch.ok(), await patch.text()).toBeTruthy()
    // double booking the same court at the same time is refused
    const second = fx.filter((f: any) => f.stage === 'group' && f.match)[1]
    const clash = await state.api!.patch(`/api/admin/matches/${second.match.id}/`, { data: { court: court.id, scheduled_at: '2031-05-01T10:30:00Z' }, headers: auth() })
    expect(clash.status()).toBe(409)

    await page.goto(`${ADMIN}/tournaments/${state.tournamentId}`)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByText('Live on the public website')).toBeVisible()
    state.slug = (await (await state.api!.get(`/api/admin/tournaments/${state.tournamentId}/`, { headers: auth() })).json()).slug
    state.publicId = (await (await state.api!.get(`/api/admin/matches/${state.matchId}/`, { headers: auth() })).json()).publicId
  })

  test('4-6. umpire scores live, spectator sees updates, match ends', async ({ browser }) => {
    const spectatorCtx = await newContext(browser)
    const spectator = await spectatorCtx.newPage()
    await spectator.goto(`${PUBLIC}/matches/${state.publicId}`)
    await expect(spectator.getByLabel('Scoreboard')).toBeVisible()

    const umpCtx = await newContext(browser)
    const ump = await umpCtx.newPage()
    await uiLogin(ump, state.umpire!, UMPIRE_PASS)
    await expect(ump).toHaveURL(/\/live/)
    // an umpire cannot reach admin pages
    await ump.goto(`${ADMIN}/players`)
    await expect(ump).toHaveURL(/\/live/)
    await ump.getByRole('link', { name: /Start scoring/ }).first().click()
    await startMatch(ump, 1) // umpire decides: best of 1 set for this one

    const teamA = ump.getByRole('button', { name: /Point for/ }).first()
    const tap = async (n: number) => { for (let i = 0; i < n; i++) { await teamA.click(); await ump.waitForTimeout(160) } }

    await tap(2)
    await expect(ump.getByText(/Saved · r2/)).toBeVisible()
    // spectator receives the score through the WebSocket without reloading
    await expect(spectator.getByText('30', { exact: true }).first()).toBeVisible()
    await expect(spectator.getByText('Live updates on')).toBeVisible()

    // undo
    await ump.getByRole('button', { name: 'Undo' }).click()
    await expect(ump.getByText(/Saved · r3/)).toBeVisible()
    await expect(spectator.getByText('15', { exact: true }).first()).toBeVisible()

    // double-click protection: a double click yields exactly one point
    await teamA.dblclick({ delay: 10 })
    await expect(ump.getByText(/Saved · r4/)).toBeVisible()
    await ump.reload() // refresh keeps the committed score
    await expect(ump.getByText(/Saved · r4/)).toBeVisible()
    await expect(ump.getByText('30', { exact: true }).first()).toBeVisible()

    // pause blocks scoring, resume restores
    await ump.getByRole('button', { name: 'Pause' }).click()
    await expect(ump.getByText(/Match paused/)).toBeVisible()
    await ump.getByRole('button', { name: 'Resume' }).click()
    await expect(ump.getByText(/Match paused/)).toHaveCount(0)

    // finish the set 6-0 (best of 1): 24 points total, 2 already won in game 1 -> 22 more
    await expect(teamA).toBeEnabled()
    await tap(22)
    await expect(ump.getByText('Match completed')).toBeVisible({ timeout: 30_000 })
    await expect(ump.getByRole('button', { name: /Point for/ })).toHaveCount(0)
    await expect(spectator.getByText(/win$/)).toBeVisible()
    await spectatorCtx.close()
    await umpCtx.close()
  })

  test('7. standings update and admin downloads the match + tournament PDFs', async ({ browser }) => {
    const ctx = await newContext(browser, true)
    const page = await ctx.newPage()
    await page.goto(`${ADMIN}/tournaments/${state.tournamentId}`)
    await page.getByRole('tab', { name: 'Standings' }).click()
    await expect(page.getByText('Group A').first()).toBeVisible()
    await expect(page.locator('td', { hasText: /^3$/ }).first()).toBeVisible() // winner has 3 points

    await page.goto(`${ADMIN}/matches/${state.matchId}`)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Match Result PDF' }).click()])
    expect(dl.suggestedFilename()).toMatch(/^match-result-MATCH\d+\.pdf$/)
    expect(readFileSync(await dl.path()!).subarray(0, 5).toString()).toBe('%PDF-')

    await page.goto(`${ADMIN}/tournaments/${state.tournamentId}`)
    await page.getByRole('tab', { name: 'Reports' }).click()
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download Tournament Progress PDF/ }).click()])
    expect(dl2.suggestedFilename()).toBe(`tournament-progress-${state.slug}.pdf`)
    expect(readFileSync(await dl2.path()!).subarray(0, 5).toString()).toBe('%PDF-')
    await ctx.close()
  })

  test('8. public visitor sees the tournament but cannot get any PDF', async ({ browser }) => {
    const ctx = await newContext(browser)
    const page = await ctx.newPage()
    await page.goto(`${PUBLIC}/public-tournaments`)
    await expect(page.getByRole('link', { name: new RegExp(`E2E Open ${run}`) })).toBeVisible()
    await page.getByRole('link', { name: new RegExp(`E2E Open ${run}`) }).click()
    await expect(page.getByRole('heading', { name: `E2E Open ${run}` })).toBeVisible()
    for (const tab of ['Matches', 'Standings', 'Bracket', 'Teams']) {
      await page.getByRole('tab', { name: new RegExp(tab) }).click()
      expect((await page.content()).toLowerCase()).not.toContain('pdf')
    }
    await expect(page.getByRole('link', { name: /pdf|download|export/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /pdf|download|export/i })).toHaveCount(0)
    await page.goto(`${PUBLIC}/matches/${state.publicId}`)
    expect((await page.content()).toLowerCase()).not.toContain('pdf')

    // hand-built URLs: anonymous access to any report endpoint is refused
    const anon = await pwRequest.newContext({ baseURL: API })
    for (const path of [`/api/admin/reports/matches/${state.matchId}/pdf/`, `/api/admin/reports/tournaments/${state.tournamentId}/pdf/`,
      `/api/public/matches/${state.publicId}/pdf/`, `/api/public/tournaments/${state.slug}/pdf/`, `/api/public/reports/tournaments/${state.slug}/pdf/`]) {
      const r = await anon.get(path)
      expect([401, 404], path).toContain(r.status())
      expect(r.headers()['content-type'] ?? '').not.toContain('application/pdf')
    }
    // an umpire token must not unlock reports either
    const ump = await loginApi(state.umpire!, UMPIRE_PASS)
    const r = await ump.ctx.get(`/api/admin/reports/matches/${state.matchId}/pdf/`, { headers: { Authorization: `Bearer ${ump.token}` } })
    expect(r.status()).toBe(403)
    await ctx.close()
  })

  test('10. flaky network: offline taps are queued, never lost, never duplicated; slow API does not slow the UI', async ({ browser }) => {
    const mk = await state.api!.post('/api/admin/matches/', {
      headers: auth(),
      data: {
        name: `E2E flaky ${run}`, config: { bestOf: 1 },
        team_a: { players: [{ first_name: 'Net' }, { first_name: 'Work' }] }, team_b: { players: [{ first_name: 'Slow' }, { first_name: 'Wifi' }] },
        umpire: (await (await state.api!.get(`/api/admin/users/?role=umpire&search=${state.umpire}`, { headers: auth() })).json()).results[0].id,
      },
    })
    const match = await mk.json()
    const ctx = await newContext(browser)
    const page = await ctx.newPage()
    await uiLogin(page, state.umpire!, UMPIRE_PASS)
    await page.goto(`${ADMIN}/score/${match.id}`)
    await startMatch(page, 1)
    const teamA = page.getByRole('button', { name: /Point for/ }).first()
    const tap = async (n: number) => { for (let i = 0; i < n; i++) { await teamA.click(); await page.waitForTimeout(160) } }

    await tap(1)
    await expect(page.getByText(/Saved · r1/)).toBeVisible()

    // --- offline: the score still moves instantly, but nothing claims to be saved
    await ctx.setOffline(true)
    await tap(3)
    await expect(page.getByText('Offline · 3 not saved')).toBeVisible()
    await expect(page.getByText(/Saved · r/)).toHaveCount(0)
    // --- back online: the queue drains with the same ids; exactly 4 points exist on the server
    await ctx.setOffline(false)
    await expect(page.getByText(/Saved · r4/)).toBeVisible({ timeout: 30_000 })
    const server = await (await state.api!.get(`/api/admin/matches/${match.id}/`, { headers: auth() })).json()
    expect(server.revision).toBe(4)
    expect(server.state.games).toEqual([1, 0]) // 4 points = one game, not 5+ (no duplicates)

    // --- slow API (2 s per scoring request): the UI must still react immediately
    await page.route('**/score/', async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue() })
    const before = Date.now()
    await teamA.click()
    await expect(page.getByText('15', { exact: true }).first()).toBeVisible({ timeout: 500 })
    expect(Date.now() - before).toBeLessThan(800)
    await expect(page.getByText(/Saving/)).toBeVisible()
    await expect(page.getByText(/Saved · r5/)).toBeVisible({ timeout: 15_000 })
    await ctx.close()
  })

  test('11. umpire chooses best of 5 at match time; system plays best of 5 and the choice is saved', async ({ browser }) => {
    const users = await (await state.api!.get(`/api/admin/users/?role=umpire&search=${state.umpire}`, { headers: auth() })).json()
    const mk = await state.api!.post('/api/admin/matches/', {
      headers: auth(),
      data: { name: `E2E bo5 ${run}`, umpire: users.results[0].id, // created with the default best of 3...
        team_a: { players: [{ first_name: 'Five' }, { first_name: 'Sets' }] }, team_b: { players: [{ first_name: 'Long' }, { first_name: 'Match' }] } },
    })
    const match = await mk.json()
    expect(match.config.bestOf).toBe(3)
    const ctx = await newContext(browser)
    const page = await ctx.newPage()
    await uiLogin(page, state.umpire!, UMPIRE_PASS)
    await page.goto(`${ADMIN}/score/${match.id}`)
    await expect(page.getByRole('radio', { name: /best of 3/i })).toHaveAttribute('aria-checked', 'true') // default shown
    await startMatch(page, 5) // ...but the umpire decides best of 5
    await expect(page.getByText(/Best of 5/).first()).toBeVisible()
    const a = page.getByRole('button', { name: /Point for/ }).first()
    for (let i = 0; i < 4; i++) { await a.click(); await page.waitForTimeout(160) } // team A wins the first game
    await expect(page.getByText(/Saved · r4/)).toBeVisible({ timeout: 15000 })
    // saved in the database
    const saved = await (await state.api!.get(`/api/admin/matches/${match.id}/`, { headers: auth() })).json()
    expect(saved.config.bestOf).toBe(5)
    expect(saved.state.games).toEqual([1, 0])
    // after a reload the setup card is gone (rules are locked once play started) and the format is still best of 5
    await page.reload()
    await expect(page.getByRole('radiogroup', { name: /match format/i })).toHaveCount(0)
    await expect(page.getByText(/Best of 5/).first()).toBeVisible()
    // and the server refuses to change it now
    const late = await state.api!.post(`/api/admin/matches/${match.id}/rules/`, { headers: auth(), data: { bestOf: 1 } })
    expect(late.status()).toBe(409)
    // the public spectator page shows best of 5
    const pub = await (await state.api!.get(`/api/public/matches/${saved.publicId}/`)).json()
    expect(pub.config.bestOf).toBe(5)
    await ctx.close()
  })

  test('12. tournament defines best of 5 + golden point at creation; matches inherit it; umpire can override; public sees it', async ({ page, browser }) => {
    // --- admin creates the tournament in the UI, choosing the match format for ALL its matches
    await page.goto(`${ADMIN}/tournaments?new=1`)
    await page.getByLabel('Tournament name').fill(`E2E Format Cup ${run}`)
    await page.locator('select[name="format"]').selectOption('round_robin')
    await page.getByRole('radio', { name: /^Best of 5/ }).click()
    await page.getByRole('radio', { name: /^Golden point/ }).click()
    await page.getByRole('button', { name: 'Create tournament' }).click()
    await expect(page).toHaveURL(/\/tournaments\/\d+$/)
    const tid = Number(page.url().split('/').pop())
    await expect(page.getByText('Best of 5 sets · Golden point').first()).toBeVisible() // shown on the tournament page
    // --- teams, fixtures
    for (const team of state.teamIds.slice(0, 3)) {
      const r = await state.api!.post(`/api/admin/tournaments/${tid}/registrations/`, { data: { team_id: team }, headers: auth() })
      expect(r.ok()).toBeTruthy()
    }
    const conf = await state.api!.post(`/api/admin/tournaments/${tid}/fixtures/confirm/`, { data: { seed: 1 }, headers: auth() })
    expect(conf.status()).toBe(201)
    const ms = await (await state.api!.get(`/api/admin/matches/?tournament=${tid}&page_size=50`, { headers: auth() })).json()
    expect(ms.count).toBe(3)
    for (const m of ms.results) {
      expect(m.config.bestOf).toBe(5) // every match inherited the tournament's format
      expect(m.config.goldenPoint).toBe(true)
    }
    // --- publish: the public tournament page shows the format
    await state.api!.post(`/api/admin/tournaments/${tid}/set-status/`, { data: { status: 'published' }, headers: auth() })
    const slug = (await (await state.api!.get(`/api/admin/tournaments/${tid}/`, { headers: auth() })).json()).slug
    const pub = await browser.newContext()
    const pp = await pub.newPage()
    await pp.goto(`${PUBLIC}/public-tournaments/${slug}`)
    await expect(pp.getByText('Best of 5 sets · Golden point')).toBeVisible()
    await pub.close()
    // --- the umpire sees the tournament's choice as the default on the setup card and can change it
    const users = await (await state.api!.get(`/api/admin/users/?role=umpire&search=${state.umpire}`, { headers: auth() })).json()
    const matchId = ms.results[0].id
    await state.api!.patch(`/api/admin/matches/${matchId}/`, { data: { umpire: users.results[0].id }, headers: auth() })
    const ctx = await newContext(browser)
    const ump = await ctx.newPage()
    await uiLogin(ump, state.umpire!, UMPIRE_PASS)
    await ump.goto(`${ADMIN}/score/${matchId}`)
    await expect(ump.getByRole('radio', { name: /best of 5/i })).toHaveAttribute('aria-checked', 'true')
    await expect(ump.getByRole('radio', { name: /golden point/i })).toHaveAttribute('aria-checked', 'true')
    await ump.getByRole('radio', { name: /^deuce/i }).click() // umpire decides: this match uses deuce
    await ump.getByRole('button', { name: /start match.*deuce/i }).click()
    const a = ump.getByRole('button', { name: /Point for/ }).first()
    const b = ump.getByRole('button', { name: /Point for/ }).nth(1)
    for (const btn of [a, a, a, b, b, b]) { await btn.click(); await ump.waitForTimeout(170) } // 40-40
    await expect(ump.getByText('Deuce', { exact: true })).toBeVisible()
    await a.click()
    await expect(ump.getByText('Advantage')).toBeVisible() // deuce rules: one point is not enough
    await expect(ump.getByText(/Saved · r7/)).toBeVisible({ timeout: 15000 })
    const saved = await (await state.api!.get(`/api/admin/matches/${matchId}/`, { headers: auth() })).json()
    expect(saved.config.goldenPoint).toBe(false) // saved to the database
    expect(saved.config.bestOf).toBe(5)
    // another match of the same tournament keeps golden point (override is per match)
    const other = await (await state.api!.get(`/api/admin/matches/${ms.results[1].id}/`, { headers: auth() })).json()
    expect(other.config.goldenPoint).toBe(true)
    await ctx.close()
  })

  test('9. a private tournament never appears publicly', async () => {
    const r = await state.api!.post('/api/admin/tournaments/', { data: { name: `Private ${run}`, visibility: 'private' }, headers: auth() })
    const t = await r.json()
    const anon = await pwRequest.newContext({ baseURL: API })
    expect((await anon.get(`/api/public/tournaments/${t.slug}/`)).status()).toBe(404)
    const list = await (await anon.get('/api/public/tournaments/')).json()
    expect(list.results.map((x: any) => x.slug)).not.toContain(t.slug)
  })
})
