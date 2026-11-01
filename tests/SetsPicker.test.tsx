import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SetsPicker, setsExplanation, setsToWin } from '@/features/matches/SetsPicker'
import { applyPoint, initialState, normalizeConfig } from '@/features/scoring/engine'

function Harness({ start = 3, spy }: { start?: number; spy?: (n: number) => void }) {
  const [n, setN] = useState(start)
  return <SetsPicker value={n} onChange={(v) => { setN(v); spy?.(v) }} />
}
const box = () => screen.getByRole('spinbutton', { name: /custom number of sets/i }) as HTMLInputElement

describe('SetsPicker (admin types the number of sets)', () => {
  it('quick buttons set 1, 3 and 5', async () => {
    const seen: number[] = []
    render(<Harness spy={(n) => seen.push(n)} />)
    await userEvent.click(screen.getByRole('radio', { name: /best of 5/i }))
    await userEvent.click(screen.getByRole('radio', { name: /best of 1/i }))
    expect(seen).toEqual([5, 1])
    expect(box().value).toBe('1')
  })

  it('accepts any typed number and explains how many sets win', async () => {
    const seen: number[] = []
    render(<Harness spy={(n) => seen.push(n)} />)
    await userEvent.clear(box())
    await userEvent.type(box(), '8')
    expect(seen.at(-1)).toBe(8)
    expect(screen.getByText(/first to win 5 sets/i)).toBeInTheDocument()
    expect(screen.getByText(/4-4 tie cannot decide/i)).toBeInTheDocument() // even number: play continues
    await userEvent.clear(box())
    await userEvent.type(box(), '7')
    expect(seen.at(-1)).toBe(7)
    expect(screen.getByText('First to win 4 sets')).toBeInTheDocument()
    // typing a preset value highlights the matching quick button
    await userEvent.clear(box())
    await userEvent.type(box(), '5')
    expect(screen.getByRole('radio', { name: /best of 5/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('rejects invalid input: never sends it, shows an error, restores the last good value on blur', async () => {
    const seen: number[] = []
    render(<Harness start={3} spy={(n) => seen.push(n)} />)
    await userEvent.clear(box())
    expect(screen.getByText(/whole number from 1 to 21/i)).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(box(), '0')
    expect(screen.getByText(/whole number from 1 to 21/i)).toBeInTheDocument()
    await userEvent.clear(box())
    await userEvent.type(box(), '-4')
    expect(seen).toEqual([]) // nothing invalid was reported to the form
    await userEvent.tab() // leave the box
    expect(box().value).toBe('3')
    expect(screen.queryByText(/whole number from 1 to 21/i)).toBeNull()
  })

  it('a number above 21 is refused and the last valid value comes back on blur', async () => {
    const seen: number[] = []
    render(<Harness start={3} spy={(n) => seen.push(n)} />)
    await userEvent.clear(box())
    await userEvent.type(box(), '22')
    expect(screen.getByText(/whole number from 1 to 21/i)).toBeInTheDocument()
    expect(seen).not.toContain(22)
    await userEvent.tab()
    expect(box().value).toBe(String(seen.at(-1)))
  })

  it('accepts the limits 1 and 21', async () => {
    const seen: number[] = []
    render(<Harness spy={(n) => seen.push(n)} />)
    await userEvent.clear(box()); await userEvent.type(box(), '21')
    await userEvent.clear(box()); await userEvent.type(box(), '1')
    expect(seen).toEqual([2, 21, 1]) // typing 21 passes through 2 (valid) on the way; then 1
  })
})

describe('sets needed to win', () => {
  it.each([[1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [7, 4], [8, 5], [9, 5], [21, 11]])('best of %i -> first to %i', (n, need) => {
    expect(setsToWin(n)).toBe(need)
    expect(setsExplanation(n)).toMatch(need === 1 ? /One set/ : new RegExp(`${need} sets`))
  })

  it('the TypeScript engine plays best of 8 as first to 5 sets', () => {
    const c = normalizeConfig({ bestOf: 8 })
    let s = initialState(c)
    const winSet = (team: 0 | 1) => { for (let i = 0; i < 24; i++) s = applyPoint(c, s, team) }
    for (const t of [0, 0, 0, 0, 1, 1, 1, 1] as const) { winSet(t); expect(s.completed).toBe(false) }
    winSet(1)
    expect(s.completed && s.winner === 1 && s.sets.length === 9).toBe(true)
  })

  it('the engine accepts 1..21 and rejects everything else', () => {
    for (const n of [1, 2, 8, 21]) expect(normalizeConfig({ bestOf: n }).bestOf).toBe(n)
    for (const n of [0, 22, -1, 2.5, NaN]) expect(() => normalizeConfig({ bestOf: n as never })).toThrow()
  })
})
