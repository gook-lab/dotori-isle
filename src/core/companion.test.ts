import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { biteDelaySeconds, COMPANION_MS, companionBug, companionCatch, companionGift, companionRemaining, fishingSpot, followGoal, sideStand, stepToward } from './companion'
import { BUG_TABLE } from './items'
import { FISH_TABLE } from './items'

describe('같이 낚시 따라가기', () => {
  it('플레이어 뒤쪽 옆 자리를 목표로 한다', () => {
    // facing 0 이면 앞은 +z 이므로 목표는 뒤(-z)에 있어야 한다
    const g = followGoal({ x: 0, z: 0, facing: 0 })
    expect(g.z).toBeLessThan(0)
    expect(Math.hypot(g.x, g.z)).toBeGreaterThan(1)
    expect(Math.hypot(g.x, g.z)).toBeLessThan(3)
  })

  it('목표를 향해 한 걸음 옮기고, 도착하면 멈춘다', () => {
    const a = stepToward({ x: 0, z: 0 }, { x: 0, z: 2 }, 2, 0.5)
    expect(a.moving).toBe(true)
    expect(a.z).toBeCloseTo(1)
    const b = stepToward({ x: 0, z: 2 }, { x: 0, z: 2 }, 2, 0.5)
    expect(b).toEqual({ x: 0, z: 2, moving: false })
  })

  it('많이 뒤처지면 더 빨리 쫓아간다', () => {
    const near = stepToward({ x: 0, z: 0 }, { x: 0, z: 1 }, 2, 0.1)
    const far = stepToward({ x: 0, z: 0 }, { x: 0, z: 10 }, 2, 0.1)
    expect(far.z).toBeGreaterThan(near.z * 2)
  })
})

describe('같이 낚시 자리 고르기', () => {
  it('플레이어 옆 2칸, 물가(땅) 쪽에 선다', () => {
    // facing 0 이면 오른쪽은 -x 방향. 오른쪽이 물이면 왼쪽(+x)을 고른다
    const stand = sideStand({ x: 0, z: 0, facing: 0 }, (x) => x < -1)
    expect(stand).not.toBeNull()
    expect(stand!.x).toBeGreaterThan(1)
    expect(Math.abs(stand!.x)).toBeCloseTo(2)
    expect(Math.abs(stand!.z)).toBeLessThan(0.001)
  })

  it('양옆이 모두 물이면 설 자리가 없다', () => {
    expect(sideStand({ x: 0, z: 0, facing: 0 }, (x) => Math.abs(x) > 0)).toBeNull()
  })

  it('물 위 가장 가까운 자리를 고르고, 플레이어 몸 옆에 둔다', () => {
    const isWater = (x: number) => x > 1.5
    const spot = fishingSpot({ x: 0, z: 0, facing: 0 }, isWater)
    expect(spot).not.toBeNull()
    expect(spot!.x).toBeGreaterThan(1.5)
  })

  it('물이 없으면 자리가 없다', () => {
    expect(fishingSpot({ x: 0, z: 0, facing: 0 }, () => false)).toBeNull()
  })
})

describe('같이 낚시 입질과 선물', () => {
  it('입질 시간은 25~60초 사이다', () => {
    for (let i = 0; i < 50; i++) {
      const s = biteDelaySeconds(mulberry32(i + 1))
      expect(s).toBeGreaterThanOrEqual(25)
      expect(s).toBeLessThanOrEqual(60)
    }
  })

  it('벌레잡기 동행은 벌레 표에 있는 벌레를 잡는다', () => {
    const ids = new Set(BUG_TABLE.map((b) => b.id))
    const rng = mulberry32(9)
    for (let i = 0; i < 30; i++) expect(ids.has(companionBug(true, rng))).toBe(true)
  })

  it('잡는 물고기는 낚시 목록에 있는 것이다', () => {
    const ids = new Set(FISH_TABLE.map((f) => f.id))
    const rng = mulberry32(7)
    for (let i = 0; i < 30; i++) expect(ids.has(companionCatch(false, rng))).toBe(true)
  })

  it('남은 시간은 30분에서 줄고 0 에서 멈춘다', () => {
    expect(companionRemaining(1000 + COMPANION_MS, 1000)).toBe(COMPANION_MS)
    expect(companionRemaining(1000, 5000)).toBe(0)
  })

  it('선물은 마지막으로 잡은 물고기, 못 잡았으면 없다', () => {
    expect(companionGift([])).toBeNull()
    expect(companionGift(['carp', 'sea-bass'])).toBe('sea-bass')
  })
})
