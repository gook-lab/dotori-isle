import { describe, expect, it } from 'vitest'
import { frozenAt, groundLeafSpots, isDeepWinter, kickAcorn, leafPileSpots, petalAt, pondFrozen } from './seasonal'
import { PONDS } from './waters'
import { islandDist } from './island'

describe('깊은 겨울과 얼음 연못', () => {
  it('1~2월만 깊은 겨울이다', () => {
    expect(isDeepWinter('2027-01-15')).toBe(true)
    expect(isDeepWinter('2027-02-03')).toBe(true)
    expect(isDeepWinter('2026-12-20')).toBe(false)
    expect(isDeepWinter('2026-10-19')).toBe(false)
  })

  it('작은 연못만 깊은 겨울에 통째로 언다', () => {
    const small = PONDS.find((p) => p.r < 4)!
    const big = PONDS.find((p) => p.r >= 4)!
    expect(pondFrozen(small, '2027-01-15')).toBe(true)
    expect(pondFrozen(small, '2026-10-19')).toBe(false)
    expect(pondFrozen(big, '2027-01-15')).toBe(false)
    expect(frozenAt(small.x, small.z, '2027-01-15')).toBe(true)
    expect(frozenAt(small.x, small.z, '2026-10-19')).toBe(false)
  })
})

describe('가을 낙엽더미', () => {
  const spots = leafPileSpots()
  it('풀밭 섬 안쪽에 열두 곳 안팎, 같은 씨앗이면 같다', () => {
    expect(spots.length).toBeGreaterThanOrEqual(8)
    for (const s of spots) expect(islandDist(s.x, s.z)).toBeLessThan(0.75)
    expect(leafPileSpots()).toEqual(spots)
  })
  it('도토리는 날짜와 더미마다 정해진다', () => {
    expect(kickAcorn('leaf-0', '2026-10-19')).toBe(kickAcorn('leaf-0', '2026-10-19'))
    const hits = spots.filter((s) => kickAcorn(s.id, '2026-10-19')).length
    expect(hits).toBeGreaterThanOrEqual(0)
    expect(hits).toBeLessThanOrEqual(spots.length)
  })
})

describe('봄 꽃잎', () => {
  it('꽃잎은 나무 위쪽에서 떨어지며 흩날린다', () => {
    const o = { x: 2, y: 1, z: 3 }
    const y0 = petalAt(o, 0.3, 0).y
    const y1 = petalAt(o, 0.3, 1).y
    expect(y0).toBeGreaterThanOrEqual(o.y)
    expect(y0).toBeLessThanOrEqual(o.y + 3)
    expect(y1).not.toBe(y0)
  })

  it('out 을 주면 그 객체에 쓰고 같은 객체를 돌려준다', () => {
    const o = { x: 2, y: 1, z: 3 }
    const out = { x: 0, y: 0, z: 0 }
    expect(petalAt(o, 0.3, 1, out)).toBe(out)
    expect(out).toEqual(petalAt(o, 0.3, 1))
  })
})

describe('가을 땅의 낙엽 조각', () => {
  const trees = [
    { x: 0, z: 0 },
    { x: 20, z: -5 },
  ]
  it('나무마다 정해진 장수만큼, 밑동 둘레 거리 안에 놓는다', () => {
    const spots = groundLeafSpots(trees, 4)
    expect(spots).toHaveLength(8)
    spots.forEach((s, i) => {
      const t = trees[Math.floor(i / 4)]
      const d = Math.hypot(s.x - t.x, s.z - t.z)
      expect(d).toBeGreaterThanOrEqual(0.9)
      expect(d).toBeLessThanOrEqual(2.2)
      expect(s.tone).toBeGreaterThanOrEqual(0)
      expect(s.tone).toBeLessThan(4)
    })
  })
  it('같은 입력이면 늘 같은 자리다', () => {
    expect(groundLeafSpots(trees)).toEqual(groundLeafSpots(trees))
  })
})
