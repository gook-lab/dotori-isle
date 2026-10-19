import { describe, expect, it } from 'vitest'
import { flagSwing } from './wind'

describe('깃발 펄럭임', () => {
  it('평소 날과 약한 바람 날은 진폭 0.18~0.22 안에서 비슷하고, 태풍에서만 크게 흔든다', () => {
    const calm = flagSwing('calm', false)
    const breeze = flagSwing('breeze', false)
    const typhoon = flagSwing('typhoon', false)
    for (const f of [calm, breeze]) expect(f.amp).toBeGreaterThanOrEqual(0.18)
    for (const f of [calm, breeze]) expect(f.amp).toBeLessThanOrEqual(0.22)
    expect(typhoon.amp).toBeGreaterThan(breeze.amp * 2)
    expect(typhoon.speed).toBeGreaterThan(breeze.speed)
  })

  it('비가 오면 같은 바람에서도 더 세게 펄럭인다', () => {
    const dry = flagSwing('breeze', false)
    const wet = flagSwing('breeze', true)
    expect(wet.amp).toBeGreaterThan(dry.amp)
    expect(wet.speed).toBeGreaterThan(dry.speed)
  })
})
