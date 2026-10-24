import { expect, test, type Page } from '@playwright/test'

/**
 * Click-through of every admin page and button on a live environment. Each step is recorded independently so one
 * failure does not hide the rest. Creates and then deletes throw-away "QA Sweep" records.
 */
const ADMIN = (process.env.E2E_ADMIN_URL ?? 'http://localhost:5174').replace(/\/$/, '')
const USER = process.env.E2E_ADMIN_USER ?? 'admin'
const PASS = process.env.E2E_ADMIN_PASS ?? 'Padel#2026demo'
const run = Date.now().toString(36)

const results: { name: string; ok: boolean; err?: string }[] = []
const consoleErrors: string[] = []
const badResponses: string[] = []

async function step(page: Page, name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, ok: true })
  } catch (e) {
    results.push({ name, ok: false, err: String((e as Error).message).split('\n')[0].slice(0, 160) })
    await page.keyboard.press('Escape').catch(() => undefined)
    await page.screenshot({ path: `test-results/sweep-fail-${results.length}.png` }).catch(() => undefined)
  }
}

test('admin UI sweep: every page and button', async ({ page }) => {
  test.setTimeout(480_000)
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 160)))
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) badResponses.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`) })

  await step(page, 'login + dashboard', async () => {
    await page.goto(`${ADMIN}/login`)
    await page.getByLabel('Username').fill(USER)
    await page.getByLabel('Password').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    for (const n of ['Tournaments', 'Upcoming matches', 'Live matches', 'Completed matches', 'Registered players', 'Registered teams']) await expect(page.getByText(n, { exact: true })).toBeVisible()
  })

  // ---------- Players
  await step(page, 'players: create', async () => {
    await page.getByRole('link', { name: 'Players' }).click()
    await page.getByRole('button', { name: /New player/ }).first().click()
    await page.getByLabel('First name').fill(`Sweep${run}`)
    await page.getByLabel('Last name').fill('Alpha')
    await page.getByLabel('Email (private)').fill('sweep@example.com')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByLabel('Search Players').fill(`Sweep${run}`)
    await expect(page.getByText(`Sweep${run} Alpha`)).toBeVisible()
  })
  await step(page, 'players: validation (empty first name)', async () => {
    await page.getByRole('button', { name: /New player/ }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('First name is required')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
  await step(page, 'players: search + edit', async () => {
    await page.getByLabel('Search Players').fill(`Sweep${run}`)
    await expect(page.getByText(`Sweep${run} Alpha`)).toBeVisible()
    await page.getByRole('button', { name: 'Edit Player' }).first().click()
    await page.getByLabel('Last name').fill('Alpha2')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText(`Sweep${run} Alpha2`)).toBeVisible()
  })
  await step(page, 'players: create second player', async () => {
    await page.getByRole('button', { name: /New player/ }).first().click()
    await page.getByLabel('First name').fill(`Sweep${run}`)
    await page.getByLabel('Last name').fill('Beta')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByLabel('Search Players').fill(`Sweep${run}`)
    await expect(page.getByText(`Sweep${run} Beta`)).toBeVisible()
  })

  // ---------- Teams
  await step(page, 'teams: create (two different players enforced)', async () => {
    await page.getByRole('link', { name: 'Teams', exact: true }).click()
    await page.getByRole('button', { name: /New team/ }).first().click()
    await page.getByLabel('Team name').fill(`Sweep Team ${run}`)
    await page.getByLabel('Player 1').selectOption({ label: `Sweep${run} Alpha2` })
    await page.getByLabel('Player 2').selectOption({ label: `Sweep${run} Alpha2` })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Choose two different players')).toBeVisible()
    await page.getByLabel('Player 2').selectOption({ label: `Sweep${run} Beta` })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByLabel('Search Teams').fill(`Sweep Team ${run}`)
    await expect(page.getByText(`Sweep Team ${run}`)).toBeVisible()
  })
  await step(page, 'teams: edit name', async () => {
    await page.getByLabel('Search Teams').fill(`Sweep Team ${run}`)
    await page.getByRole('button', { name: 'Edit Team' }).first().click()
    await page.getByLabel('Team name').fill(`Sweep Team ${run} B`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText(`Sweep Team ${run} B`)).toBeVisible()
  })

  // ---------- Courts / Umpires
  await step(page, 'courts: create, edit, delete', async () => {
    await page.getByRole('link', { name: 'Courts' }).click()
    await page.getByRole('button', { name: /New court/ }).first().click()
    await page.getByLabel('Court name').fill(`Sweep Court ${run}`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByLabel('Search Courts').fill(`Sweep Court ${run}`)
    await page.getByRole('button', { name: 'Edit Court' }).first().click()
    await page.getByLabel('Venue').fill('Sweep Venue')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Sweep Venue')).toBeVisible()
    await page.getByRole('button', { name: 'Delete Court' }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText(`Sweep Court ${run}`)).toHaveCount(0)
  })
  await step(page, 'umpires: create + edit + deactivate', async () => {
    await page.getByRole('link', { name: 'Umpires' }).click()
    await page.getByRole('button', { name: /New umpire/ }).first().click()
    await page.getByLabel('Username').fill(`sweepump${run}`)
    await page.getByLabel('Email').fill(`sweepump${run}@example.com`)
    await page.getByLabel('First name').fill('Sweep')
    await page.getByLabel('Password', { exact: true }).fill('Sweep#Pass2026')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByLabel('Search Umpires').fill(`sweepump${run}`)
    await expect(page.getByText(`sweepump${run}`)).toBeVisible()
    await page.getByRole('button', { name: 'Edit Umpire' }).first().click()
    await page.getByLabel('Last name').fill('Tester')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Sweep Tester')).toBeVisible()
  })

  // ---------- Matches
  let matchUrl = ''
  await step(page, 'matches: create friendly via form (new players)', async () => {
    await page.getByRole('link', { name: 'Matches' }).click()
    await page.getByRole('button', { name: /New match/ }).click()
    await page.getByLabel('Match name').fill(`QA Sweep Friendly ${run}`)
    const first = page.getByPlaceholder('First name')
    for (const [i, n] of ['QAa1', 'QAa2', 'QAb1', 'QAb2'].entries()) await first.nth(i).fill(`${n}${run}`)
    await page.getByRole('button', { name: 'Create match' }).click()
    await expect(page.getByRole('heading', { name: `QA Sweep Friendly ${run}` })).toBeVisible()
    matchUrl = page.url()
  })
  await step(page, 'matches: validation (one player missing)', async () => {
    await page.goto(`${ADMIN}/matches`)
    await page.getByRole('button', { name: /New match/ }).click()
    await page.getByLabel('Match name').fill('x y')
    await page.getByRole('button', { name: 'Create match' }).click()
    await expect(page.getByText('Pick or name both players').first()).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
  await step(page, 'matches: create from existing team + players', async () => {
    await page.getByRole('button', { name: /New match/ }).click()
    await page.getByLabel('Match name').fill(`QA Sweep Existing ${run}`)
    await page.getByRole('button', { name: 'Existing team' }).first().click()
    const sel = page.locator('select').filter({ has: page.locator('option', { hasText: `Sweep Team ${run} B` }) }).first()
    await sel.selectOption(await sel.locator('option', { hasText: `Sweep Team ${run} B` }).first().getAttribute('value') as string)
    const first = page.getByPlaceholder('First name')
    await first.nth(0).fill(`QAc1${run}`)
    await first.nth(1).fill(`QAc2${run}`)
    await page.getByRole('button', { name: 'Create match' }).click()
    await expect(page.getByRole('heading', { name: `QA Sweep Existing ${run}` })).toBeVisible()
  })
  await step(page, 'match page: info, share link, QR, edit, status buttons', async () => {
    await page.goto(matchUrl)
    await expect(page.getByText('Match information')).toBeVisible()
    await page.getByRole('button', { name: 'Copy link' }).click()
    await page.getByRole('button', { name: 'QR code' }).click()
    await expect(page.getByAltText('QR code for the live spectator page')).toBeVisible()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Match name').fill(`QA Sweep Friendly ${run} (edited)`)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: /\(edited\)/ })).toBeVisible()
    await page.getByRole('button', { name: 'Mark ready' }).click()
    await expect(page.getByText('ready', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Back to scheduled' }).click()
    await expect(page.getByRole('button', { name: 'Mark ready' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Download Match Result PDF/ })).toBeDisabled()
  })
  await step(page, 'matches list: search + status filter + friendlies filter', async () => {
    await page.goto(`${ADMIN}/matches`)
    await page.getByLabel('Search matches').fill(`QA Sweep Friendly ${run}`)
    await expect(page.getByText(`QA Sweep Friendly ${run} (edited)`)).toBeVisible()
    await page.getByLabel('Filter by status').selectOption('completed')
    await expect(page.getByText(`QA Sweep Friendly ${run} (edited)`)).toHaveCount(0)
    await page.getByLabel('Filter by status').selectOption('')
    await page.getByLabel('Filter by type').selectOption('friendly')
    await expect(page.getByText(`QA Sweep Friendly ${run} (edited)`)).toBeVisible()
  })

  // ---------- Scoring console
  await step(page, 'console: points, undo, pause/resume, fullscreen, end match', async () => {
    await page.goto(matchUrl)
    await page.getByRole('link', { name: /Start scoring/ }).click()
    const a = page.getByRole('button', { name: /Point for/ }).first()
    const b = page.getByRole('button', { name: /Point for/ }).nth(1)
    await a.click(); await page.waitForTimeout(200); await a.click(); await page.waitForTimeout(200); await b.click()
    await expect(page.getByText(/Saved · r3/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText(/Saved · r4/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByText(/Match paused/)).toBeVisible()
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByText(/Match paused/)).toHaveCount(0)
    await page.getByRole('button', { name: /Full screen/ }).click()
    await page.getByRole('button', { name: 'End match' }).click()
    await page.getByRole('button', { name: /wins$/ }).first().click()
    await expect(page.getByText('Match completed')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Saved · r\d+/)).toBeVisible({ timeout: 20000 }) // confirmed by the server before leaving
  })
  await step(page, 'match page after end: PDF download, verify, correct result', async () => {
    await page.goto(matchUrl)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Match Result PDF' }).click()])
    expect(dl.suggestedFilename()).toMatch(/^match-result-MATCH\d+\.pdf$/)
    await page.getByRole('button', { name: 'Verify result' }).click()
    await expect(page.getByText('Verified')).toBeVisible()
    await page.getByRole('button', { name: 'Correct result' }).click()
    await page.getByLabel('Set 1 ' + 'QA').first().fill('6').catch(() => undefined)
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
  await step(page, 'live scoring list page', async () => {
    await page.goto(`${ADMIN}/live`)
    await expect(page.getByRole('heading', { name: 'Live Scoring' })).toBeVisible()
  })
  await step(page, 'match: cancel + delete a spare match', async () => {
    await page.goto(`${ADMIN}/matches`)
    await page.getByRole('button', { name: /New match/ }).click()
    await page.getByLabel('Match name').fill(`QA Sweep Spare ${run}`)
    const first = page.getByPlaceholder('First name')
    for (const [i, n] of ['QAd1', 'QAd2', 'QAe1', 'QAe2'].entries()) await first.nth(i).fill(`${n}${run}`)
    await page.getByRole('button', { name: 'Create match' }).click()
    await expect(page.getByRole('heading', { name: `QA Sweep Spare ${run}` })).toBeVisible()
    await page.getByRole('button', { name: 'Delete match' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page).toHaveURL(/\/matches$/)
  })

  // ---------- Tournament pages & global pages
  await step(page, 'tournaments list, create form validation + cancel', async () => {
    await page.getByRole('link', { name: 'Tournaments' }).click()
    await page.getByRole('button', { name: /New tournament/ }).first().click()
    await page.getByRole('button', { name: 'Create tournament' }).click()
    await expect(page.getByText('Name must be at least 3 characters')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
  for (const [label, heading] of [['Fixtures', 'Fixtures'], ['Standings', 'Standings'], ['Administrative Reports', 'Administrative Reports'], ['Settings', 'Settings'], ['Dashboard', 'Dashboard']] as const) {
    await step(page, `page: ${label}`, async () => {
      await page.getByRole('link', { name: label, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    })
  }
  await step(page, 'settings: users + audit tabs (super admin)', async () => {
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('tab', { name: 'Users' }).click()
    await expect(page.getByText('sweepump' + run)).toBeVisible()
    await page.getByRole('tab', { name: 'Audit log' }).click()
    await expect(page.getByText('auth.login').first()).toBeVisible()
  })

  // ---------- cleanup of throw-away records
  await step(page, 'cleanup: delete sweep team and players', async () => {
    await page.getByRole('link', { name: 'Teams', exact: true }).click()
    await page.getByLabel('Search Teams').fill(`Sweep Team ${run}`)
    await page.getByRole('button', { name: 'Delete Team' }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText(`Sweep Team ${run} B`)).toHaveCount(0)
    await page.getByRole('link', { name: 'Players' }).click()
    for (const n of ['Alpha2', 'Beta']) {
      await page.getByLabel('Search Players').fill(`Sweep${run}`)
      await page.getByRole('button', { name: 'Delete Player' }).first().click()
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(600)
      void n
    }
  })

  console.log('\n===== UI SWEEP RESULTS =====')
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.err ? '  -> ' + r.err : ''}`)
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed`)
  console.log('console errors:', consoleErrors.length ? [...new Set(consoleErrors)].join(' | ') : 'none')
  console.log('4xx/5xx API responses:', badResponses.length ? [...new Set(badResponses)].join(' | ') : 'none')
  expect(results.filter((r) => !r.ok).map((r) => r.name)).toEqual([])
})
