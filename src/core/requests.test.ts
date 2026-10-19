import { describe, expect, it } from 'vitest'
import { activeReq, deliverTo, kindOf, newReq, onPickup, onTalk, onWater, reqText, rewardOf, sanitizeReq, WATER_TARGET } from './requests'

describe('request kinds', () => {
  it('is the same for the same villager and day', () => {
    expect(kindOf('guriguri', '2026-10-19')).toBe(kindOf('guriguri', '2026-10-19'))
  })

  it('uses all four kinds across villagers and days', () => {
    const seen = new Set<string>()
    for (let d = 1; d <= 60; d++) for (const v of ['a', 'b', 'c']) seen.add(kindOf(v, `2026-10-${String(d).padStart(2, '0')}`))
    expect([...seen].sort()).toEqual(['bring', 'deliver', 'lost', 'water'])
  })

  it('never asks a villager to deliver to themselves', () => {
    for (let d = 1; d <= 30; d++) {
      const to = deliverTo('a', `2026-10-${d}`, ['a', 'b', 'c'])
      expect(to).not.toBe('a')
      expect(['b', 'c']).toContain(to)
    }
    expect(deliverTo('a', '2026-10-19', ['a'])).toBeNull()
  })
})

describe('progress', () => {
  it('water finishes after the target number of waterings', () => {
    let r = newReq('water', '2026-10-19')
    for (let i = 0; i < WATER_TARGET - 1; i++) r = onWater(r)
    expect(r.done).toBe(false)
    r = onWater(r)
    expect(r.done).toBe(true)
    expect(onWater(r).progress).toBe(WATER_TARGET)
  })

  it('deliver finishes only for the person it was addressed to', () => {
    const r = newReq('deliver', '2026-10-19', { to: 'b' })
    expect(onTalk(r, 'c').done).toBe(false)
    expect(onTalk(r, 'b').done).toBe(true)
  })

  it('lost finishes only for the dropped item', () => {
    const r = newReq('lost', '2026-10-19', { item: 'lost-a-2026-10-19' })
    expect(onPickup(r, 'other').done).toBe(false)
    expect(onPickup(r, 'lost-a-2026-10-19').done).toBe(true)
  })

  it('a finished request ignores later events', () => {
    const r = onTalk(newReq('deliver', '2026-10-19', { to: 'b' }), 'b')
    expect(onWater(r)).toEqual(r)
  })
})

describe('expiry and rewards', () => {
  it('a request from an earlier day has expired', () => {
    const r = newReq('water', '2026-10-18')
    expect(activeReq(r, '2026-10-19')).toBeNull()
    expect(activeReq(r, '2026-10-18')).toEqual(r)
    expect(activeReq(undefined, '2026-10-19')).toBeNull()
  })

  it('lost pays acorns and a piece of furniture', () => {
    expect(rewardOf(newReq('lost', '2026-10-19', { item: 'x' }))).toMatchObject({ acorns: 30, furniture: 'flowerpot' })
    expect(rewardOf(newReq('deliver', '2026-10-19', { to: 'b' })).furniture).toBeUndefined()
  })

  it('describes each kind in a line', () => {
    const name = (id: string) => `이름${id}`
    expect(reqText(newReq('deliver', '2026-10-19', { to: 'b' }), name)).toContain('이름b')
    expect(reqText(newReq('water', '2026-10-19'), name)).toContain(`0/${WATER_TARGET}`)
  })
})

describe('saved requests', () => {
  it('keeps valid entries and drops broken ones', () => {
    expect(sanitizeReq({ kind: 'water', day: '2026-10-19', progress: 1, target: 3, done: false })).toMatchObject({ kind: 'water', progress: 1, target: 3 })
    expect(sanitizeReq({ kind: 'mystery', day: '2026-10-19' })).toBeNull()
    expect(sanitizeReq(null)).toBeNull()
    expect(sanitizeReq({ kind: 'water', day: 3 })).toBeNull()
  })
})
