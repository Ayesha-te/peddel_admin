import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { RulesEditor } from '@/features/matches/MatchFormModal'
import { normalizeConfig } from '@/features/scoring/engine'
import type { MatchConfig } from '@/types'
import { formatText } from '@/utils/format'

function Harness({ initial, onChange }: { initial?: Partial<MatchConfig>; onChange?: (c: MatchConfig) => void }) {
  const [v, setV] = useState<MatchConfig>(normalizeConfig(initial))
  return <RulesEditor value={v} onChange={(c) => { setV(c); onChange?.(c) }} title="Match format for every match in this tournament" />
}

describe('RulesEditor (match and tournament forms)', () => {
  it('lets the organiser choose best of 1, 3 or 5', async () => {
    let last: MatchConfig | undefined
    render(<Harness onChange={(c) => (last = c)} />)
    expect(screen.getAllByRole('radio', { name: /best of/i })).toHaveLength(3)
    await userEvent.click(screen.getByRole('radio', { name: /best of 5/i }))
    expect(last?.bestOf).toBe(5)
    expect(screen.getByRole('radio', { name: /best of 5/i })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: /best of 1/i }))
    expect(last?.bestOf).toBe(1)
    expect(screen.queryByText(/super tie-break/i)).toBeNull() // not offered for a single set
  })

  it('lets the organiser type any number of sets (match and tournament forms)', async () => {
    let last: MatchConfig | undefined
    render(<Harness onChange={(c) => (last = c)} />)
    const box = screen.getByRole('spinbutton', { name: /custom number of sets/i })
    await userEvent.clear(box)
    await userEvent.type(box, '8')
    expect(last?.bestOf).toBe(8)
    expect(screen.getByText(/first to win 5 sets/i)).toBeInTheDocument()
    expect(screen.getByText(/super tie-break/i)).toBeInTheDocument() // offered for any multi-set format
  })

  it('lets the organiser choose deuce or golden point, and explains each', async () => {
    let last: MatchConfig | undefined
    render(<Harness onChange={(c) => (last = c)} />)
    expect(screen.getByRole('radio', { name: /deuce \(advantage\)/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/first point after 40–40 wins the game/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /golden point/i }))
    expect(last?.goldenPoint).toBe(true)
    await userEvent.click(screen.getByRole('radio', { name: /deuce \(advantage\)/i }))
    expect(last?.goldenPoint).toBe(false)
  })

  it('shows an existing tournament format when editing', () => {
    render(<Harness initial={{ bestOf: 5, goldenPoint: true }} />)
    expect(screen.getByRole('radio', { name: /best of 5/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /golden point/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('describes formats in plain words', () => {
    expect(formatText({ bestOf: 5, goldenPoint: true, superTiebreak: true, tiebreakEnabled: true })).toBe('Best of 5 sets · Golden point · Super tie-break decider')
    expect(formatText({ bestOf: 1, goldenPoint: false, superTiebreak: true })).toBe('Best of 1 set · Deuce (advantage)')
  })
})
