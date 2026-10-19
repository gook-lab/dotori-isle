import { describe, expect, it } from 'vitest'
import { footY } from './footSettle'
import { STEP_RISER } from './tiers'

describe('발 높이 따라가기: 계단 위 낙하', () => {
  it('snaps straight down to the ground on a step when the drop is one step or less', () => {
    expect(footY(2.6, 2.6 - STEP_RISER, true, 1 / 60)).toBe(2.6 - STEP_RISER)
    expect(footY(2.6, 2.5, true, 1 / 60)).toBe(2.5)
  })

  it('keeps the slow fall when the foot is not on a step', () => {
    const y = footY(2.6, 2.5, false, 1 / 60)
    expect(y).toBeGreaterThan(2.5)
    expect(y).toBeLessThan(2.6)
  })

  it('keeps the fall for a drop bigger than one step, even on a step', () => {
    const y = footY(2.6, 2.6 - STEP_RISER - 0.05, true, 1 / 60)
    expect(y).toBeGreaterThan(2.6 - STEP_RISER - 0.05)
    expect(y).toBeLessThan(2.6)
  })

  it('still rises quickly toward a higher ground on a step', () => {
    const y = footY(2.0, 2.3, true, 1 / 60)
    expect(y).toBeGreaterThan(2.0)
    expect(y).toBeLessThan(2.3)
  })
})
