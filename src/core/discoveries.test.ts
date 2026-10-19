import { describe, expect, it } from 'vitest'
import { canDiscover, critterAt, DISCOVERIES, type DiscoverySpot, discoveryNear, ECHO_CALLS, outcomeOf, pebbleBounces, treeAge, WISH_COST, WISH_GIFT_ACORNS, wishGift } from './discoveries'
import { byWater, heightAt, isWalkable } from './island'
import { BUSHES } from './scenery'
import { flatWithin } from './tiers'
import { canStand, ROCKS, TREES } from './world'
import { PONDS } from './waters'
import { VILLAGERS } from './villagers'

/** 자리가 평평한 땅이 아닌 이유 목록. 비어 있으면 자리로 쓸 수 있다. 조약돌은 물가에 있어야 해서 물가 조건만 뺀다. */
function unfitReasons(s: DiscoverySpot): string[] {
  const why: string[] = []
  let lo = Infinity
  let hi = -Infinity
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      const px = i * 0.3
      const pz = j * 0.3
      if (px * px + pz * pz > 1.5 * 1.5) continue
      const h = heightAt(s.x + px, s.z + pz)
      lo = Math.min(lo, h)
      hi = Math.max(hi, h)
    }
  }
  if (hi - lo > 0.15) why.push('반경 1.5 안 높이 차')
  if (!flatWithin(s.x, s.z, 1.5)) why.push('절벽 띠·경사로')
  if (!isWalkable(s.x, s.z)) why.push('걸을 수 없음')
  if (s.id !== 'pebble' && byWater(s.x, s.z, 2)) why.push('물가')
  const near = (list: { x: number; z: number }[], r: number) => list.some((t) => Math.hypot(t.x - s.x, t.z - s.z) < r)
  if (near(VILLAGERS.map((v) => v.house), 6)) why.push('주민 집터')
  if (near(TREES, 2.5)) why.push('나무')
  if (near(ROCKS, 2.5)) why.push('바위')
  if (near(BUSHES, 2.5)) why.push('덤불')
  if (DISCOVERIES.some((o) => o.id !== s.id && Math.hypot(o.x - s.x, o.z - s.z) < 3)) why.push('다른 발견거리')
  return why
}

describe('발견거리 자리', () => {
  it('여섯 곳이 서로 떨어져 있고 모두 걸을 수 있는 땅 위다', () => {
    expect(DISCOVERIES).toHaveLength(6)
    for (const s of DISCOVERIES) {
      expect(isWalkable(s.x, s.z)).toBe(true)
      expect(canStand(s.x, s.z)).toBe(true)
    }
    for (let i = 0; i < DISCOVERIES.length; i++) {
      for (let j = i + 1; j < DISCOVERIES.length; j++) {
        const a = DISCOVERIES[i]
        const b = DISCOVERIES[j]
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(3)
      }
    }
  })

  it('언덕 자리는 주변보다 높다', () => {
    const echo = DISCOVERIES.find((s) => s.id === 'echo')!
    expect(heightAt(echo.x, echo.z)).toBeGreaterThan(3)
  })

  it('가까운 자리만 골라 준다', () => {
    const well = DISCOVERIES.find((s) => s.id === 'well')!
    expect(discoveryNear(well.x + 0.5, well.z)?.id).toBe('well')
    expect(discoveryNear(0, 0)).toBeNull()
  })
})

describe('발견거리 자리 조건', () => {
  it('여섯 자리는 모두 평평한 땅이고 주변 물건과 떨어져 있다', () => {
    for (const s of DISCOVERIES) expect({ id: s.id, why: unfitReasons(s) }).toEqual({ id: s.id, why: [] })
  })

  it('우물은 연못 가장자리에서 2~5 떨어진 자리다', () => {
    const well = DISCOVERIES.find((s) => s.id === 'well')!
    const edge = Math.min(...PONDS.map((p) => Math.hypot(p.x - well.x, p.z - well.z) - p.r))
    expect(edge).toBeGreaterThanOrEqual(2)
    expect(edge).toBeLessThanOrEqual(5)
  })
})

describe('하루 한 번', () => {
  it('같은 날이면 다시 못 하고 다음 날에는 된다', () => {
    expect(canDiscover(undefined, '2026-07-15')).toBe(true)
    expect(canDiscover('2026-07-15', '2026-07-15')).toBe(false)
    expect(canDiscover('2026-07-15', '2026-07-16')).toBe(true)
  })
})

describe('결과 굴림', () => {
  it('물수제비는 1~6번 튄다', () => {
    expect(pebbleBounces(0)).toBe(1)
    expect(pebbleBounces(0.99)).toBe(6)
    expect(outcomeOf('pebble', 0.5).bounces).toBe(4)
  })

  it('나이테로 본 나무 나이는 20~60살이고 같은 자리는 늘 같다', () => {
    const age = treeAge('stump')
    expect(age).toBeGreaterThanOrEqual(20)
    expect(age).toBeLessThanOrEqual(60)
    expect(age % 5).toBe(0)
    expect(treeAge('stump')).toBe(age)
    expect(outcomeOf('stump', 0.1).text).toContain(`${age}살`)
  })

  it('바위 밑 친구는 가끔만 나온다', () => {
    expect(critterAt(0.1)).toBe('crab')
    expect(critterAt(0.3)).toBe('pillbug')
    expect(critterAt(0.9)).toBeNull()
  })

  it('우물은 동전 한 개를 치르고, 1% 안에 들면 도토리 선물을 받는다', () => {
    expect(wishGift(0.005)).toBe(true)
    expect(wishGift(0.5)).toBe(false)
    const miss = outcomeOf('well', 0.5)
    expect(miss.cost).toBe(WISH_COST)
    expect(miss.acorns).toBeUndefined()
    const hit = outcomeOf('well', 0)
    expect(hit.acorns).toBe(WISH_GIFT_ACORNS)
  })

  it('메아리는 정해진 횟수만큼 돌아오고, 다람쥐 둥지는 도토리 하나를 준다', () => {
    expect(outcomeOf('echo', 0.3).echoes).toBe(ECHO_CALLS)
    expect(outcomeOf('hollow', 0.3).acorns).toBe(1)
  })

  it('모든 결과에는 한두 줄 문구와 효과음이 있다', () => {
    for (const s of DISCOVERIES) {
      for (const r of [0, 0.3, 0.7, 0.999]) {
        const o = outcomeOf(s.id, r)
        expect(o.text.length).toBeGreaterThan(4)
        expect(o.sound).toBeTruthy()
      }
    }
  })
})
