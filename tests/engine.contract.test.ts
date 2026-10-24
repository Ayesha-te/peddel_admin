import { describe, expect, it } from 'vitest'
import fixture from './fixtures/scoring_contract.json'
import { applyPoint, describe as describeState, initialState, normalizeConfig } from '@/features/scoring/engine'

/** The Python engine is authoritative: every step of every recorded scenario must match exactly. */
describe('TS scoring engine matches the Python engine (contract)', () => {
  const kinds = new Set<string>()
  for (const sc of fixture.scenarios as any[]) {
    it(`replays ${sc.name}`, () => {
      const cfg = normalizeConfig(sc.config)
      expect(cfg).toEqual(sc.normalizedConfig)
      let state = initialState(cfg)
      for (const step of sc.steps) {
        state = applyPoint(cfg, state, step.team)
        expect(state).toEqual(step.state)
        const d = describeState(cfg, state)
        expect(d).toEqual(step.display)
        kinds.add(d.pointKind)
      }
    })
  }
  it('covers every kind of point state', () => {
    expect([...kinds].sort()).toEqual(['advantage', 'deuce', 'golden', 'normal', 'super', 'tiebreak'])
  })
})

describe('engine rules', () => {
  const cfg = normalizeConfig()
  it('rejects scoring after completion', () => {
    let s = initialState(normalizeConfig({ bestOf: 1 }))
    const c = normalizeConfig({ bestOf: 1 })
    for (let i = 0; i < 24; i++) s = applyPoint(c, s, 0)
    expect(s.completed).toBe(true)
    expect(() => applyPoint(c, s, 1)).toThrow(/completed/)
  })
  it('does not mutate its input', () => {
    const s = initialState(cfg)
    const copy = structuredClone(s)
    applyPoint(cfg, s, 0)
    expect(s).toEqual(copy)
  })
})
