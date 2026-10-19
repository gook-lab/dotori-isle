import { describe, expect, it } from 'vitest'
import { bugPosition, generateDay } from './daily'
import { heightAt, islandDist } from './island'
import { dexHint, TIDE_TABLE } from './items'
import { TIDE_POOLS, tideBugs, tidePosition } from './tidepool'

describe('물웅덩이 자리', () => {
  it('남쪽 바닷가 모래 띠에 세 개가 놓인다', () => {
    expect(TIDE_POOLS).toHaveLength(3)
    for (const p of TIDE_POOLS) {
      expect(islandDist(p.x, p.z)).toBeGreaterThan(0.8)
      expect(islandDist(p.x, p.z)).toBeLessThan(1)
      expect(p.z).toBeGreaterThan(0)
    }
  })
})

describe('물웅덩이 생물', () => {
  it('웅덩이마다 한두 마리이고, 같은 날이면 늘 같다', () => {
    const a = tideBugs('2026-10-19')
    expect(a.length).toBeGreaterThanOrEqual(TIDE_POOLS.length)
    expect(a.length).toBeLessThanOrEqual(TIDE_POOLS.length * 2)
    expect(tideBugs('2026-10-19')).toEqual(a)
    for (const b of a) expect(TIDE_TABLE.some((t) => t.id === b.day)).toBe(true)
  })

  it('웅덩이 안에서만 움직인다', () => {
    for (const pool of TIDE_POOLS) {
      for (let t = 0; t < 60; t += 3) {
        const [x, , z] = tidePosition(pool, 7, t)
        expect(Math.hypot(x - pool.x, z - pool.z)).toBeLessThanOrEqual(pool.r * 0.5 * Math.SQRT2 + 1e-9)
      }
    }
  })

  it('섬 벌레 목록과 섞이지 않고, 날마다 하루 생물 목록에 든다', () => {
    const layout = generateDay('2026-10-19')
    const tide = layout.bugs.filter((b) => b.pool)
    expect(tide.length).toBeGreaterThanOrEqual(TIDE_POOLS.length)
    for (const b of tide) {
      const [x, , z] = bugPosition(b, 1, false)
      expect(heightAt(x, z)).toBeGreaterThan(-1)
    }
    expect(layout.bugs.filter((b) => !b.pool).every((b) => !TIDE_TABLE.some((t) => t.id === b.day))).toBe(true)
  })

  it('도감 설명은 웅덩이와 잠자리채를 말한다', () => {
    expect(dexHint('tide-crab')).toContain('물웅덩이')
  })
})
