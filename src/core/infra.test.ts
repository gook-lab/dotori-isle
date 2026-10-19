import { describe, expect, it } from 'vitest'
import { bridgeOk, bridgeRotAt, bridgeSpots, builtBridges, builtBy, builtStairs, NO_INFRA, sanitizeInfra, stairOk, stairSpots, stairRamps, BRIDGE_MAX, STAIR_MAX, refundOf, BRIDGE_COST, type Infra } from './infra'
import { extraBridges, PONDS } from './waters'
import { PLATEAUS } from './tiers'
import { onBridge } from './waters'
import { heightAt, isWalkable } from './island'
import { extraRamps, plateauRimAt, RAMP_W } from './tiers'

describe('섬 정비 — 다리 자리', () => {
  it('개울 위에 놓을 자리가 있고 모두 판정을 통과한다', () => {
    const spots = bridgeSpots(NO_INFRA)
    expect(spots.length).toBeGreaterThan(0)
    for (const s of spots) expect(bridgeOk(s.x, s.z, s.rot, [])).toBe(true)
  })

  it('개울에서 떨어진 자리에는 다리를 놓지 못한다', () => {
    expect(bridgeOk(-30, 0, bridgeRotAt(1, 0), [])).toBe(false)
  })

  it('이미 있는 다리 근처에는 또 놓지 못한다', () => {
    const [s] = bridgeSpots(NO_INFRA)
    expect(bridgeOk(s.x + 1, s.z, s.rot, [{ x: s.x, z: s.z }])).toBe(false)
  })

  it('연못 안에는 다리를 놓지 못한다(개울 위만)', () => {
    for (const s of bridgeSpots(NO_INFRA)) expect(PONDS.every((p) => Math.hypot(p.x - s.x, p.z - s.z) > p.r)).toBe(true)
  })
})

describe('섬 정비 — 계단 자리', () => {
  it('언덕 절벽 가장자리에 계단을 놓을 자리가 있다', () => {
    const spots = stairSpots(NO_INFRA)
    expect(spots.length).toBeGreaterThan(0)
    for (const s of spots) expect(stairOk(s.plateau, s.ang, [])).toBe(true)
  })

  it('기존 경사로 위에는 계단을 또 놓지 못한다', () => {
    const p = PLATEAUS[0]
    expect(stairOk(0, p.ramps[0], [])).toBe(false)
  })

  it('계단 자리끼리는 너무 가깝게 놓지 못한다', () => {
    const [s] = stairSpots(NO_INFRA)
    expect(stairOk(s.plateau, s.ang + 0.05, [{ plateau: s.plateau, ang: s.ang }])).toBe(false)
  })
})

describe('섬 정비 — 지어진 계단은 걸어 오를 수 있다', () => {
  it('바깥 밑동에서 윗면까지 걸을 수 있고 높이가 올라간다', () => {
    const [s] = stairSpots(NO_INFRA)
    const p = PLATEAUS[s.plateau]
    extraRamps[p.id] = [s.ang]
    try {
      const rim = plateauRimAt(p, s.ang)
      let prev = -Infinity
      for (let r = rim + 0.9; r >= rim - RAMP_W - 0.4; r -= 0.2) {
        const x = p.x + Math.cos(s.ang) * r
        const z = p.z + Math.sin(s.ang) * r
        expect(isWalkable(x, z)).toBe(true)
        const h = heightAt(x, z)
        expect(h).toBeGreaterThanOrEqual(prev - 0.05)
        prev = h
      }
      expect(prev).toBeGreaterThan(p.top - 0.3)
    } finally {
      delete extraRamps[p.id]
    }
  })
})

describe('섬 정비 — 다음 날 아침에 지어진다', () => {
  it('맡긴 날에는 아직 안 지어지고 다음 날부터 지어진다', () => {
    expect(builtBy('2026-10-18', '2026-10-18')).toBe(false)
    expect(builtBy('2026-10-18', '2026-10-19')).toBe(true)
    expect(builtBy('2026-10-18', '2026-10-20')).toBe(true)
  })

  it('지어진 것만 걸을 수 있는 다리·계단 목록에 든다', () => {
    const infra: Infra = {
      ...NO_INFRA,
      bridges: [{ id: 'b1', x: 0, z: 0, rot: 0, ordered: '2026-10-18' }],
      stairs: [{ id: 's1', plateau: 0, ang: 1, ordered: '2026-10-17' }],
    }
    expect(builtBridges(infra, '2026-10-18')).toHaveLength(0)
    expect(builtBridges(infra, '2026-10-19')).toHaveLength(1)
    expect(builtStairs(infra, '2026-10-18')).toHaveLength(1)
  })

  it('계단은 언덕별로 모아 경사로 목록에 더한다', () => {
    const r = stairRamps([{ id: 's1', plateau: 0, ang: 1, ordered: '2026-10-17' }, { id: 's2', plateau: 0, ang: 2, ordered: '2026-10-17' }])
    expect(r['west-hill']).toEqual([1, 2])
  })
})

describe('섬 정비 — 저장 검증과 비용', () => {
  it('망가진 항목은 버리고 개수 상한을 넘기지 않는다', () => {
    const good = { id: 'b', x: 1, z: 2, rot: 0, ordered: '2026-10-18' }
    const many = Array.from({ length: 9 }, (_, i) => ({ ...good, id: `b${i}` }))
    const r = sanitizeInfra({ bridges: [...many, { id: 'bad', x: NaN, z: 0, rot: 0, ordered: '2026-10-18' }], stairs: [{ id: 's', plateau: 9, ang: 0, ordered: '2026-10-18' }] })
    expect(r.bridges).toHaveLength(BRIDGE_MAX)
    expect(r.stairs).toHaveLength(0)
    expect(sanitizeInfra(undefined)).toEqual(NO_INFRA)
    expect(STAIR_MAX).toBe(4)
  })

  it('철거하면 절반을 돌려준다', () => {
    expect(refundOf(BRIDGE_COST)).toBe(90)
  })

  it('지어진 다리는 개울 위를 걷게 하고 높이도 올린다', () => {
    const [s] = bridgeSpots(NO_INFRA)
    const before = isWalkable(s.x, s.z)
    extraBridges.push({ x: s.x, z: s.z, rot: s.rot, len: 4, w: 1.5 })
    try {
      expect(onBridge(s.x, s.z)).not.toBeNull()
      expect(isWalkable(s.x, s.z)).toBe(true)
      expect(before).toBe(false)
    } finally {
      extraBridges.length = 0
    }
  })
})
