import { describe, expect, it } from 'vitest'
import { FENCE_FAR, FENCE_NEAR, gardenRingBlocker } from './fence'
import { gardenRangeCells, GARDEN_RANGE_TEXT } from './gardenRange'

const site = { x: 0, z: 0, door: { x: 0, z: 3 } }
const chebyshev = (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z))

describe('정원 놓기 범위', () => {
  it('집에서 세 칸부터 여섯 칸 안의 칸만 준다', () => {
    const cells = gardenRangeCells(site, () => true)
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) {
      expect(chebyshev(c.x, c.z)).toBeGreaterThanOrEqual(FENCE_NEAR)
      expect(chebyshev(c.x, c.z)).toBeLessThanOrEqual(FENCE_FAR)
    }
  })

  it('현관 앞 칸은 빠지고, 놓기 판정이 막은 칸도 빠진다', () => {
    const cells = gardenRangeCells(site, (x) => x !== 4)
    expect(cells.some((c) => c.x === 4)).toBe(false)
    for (const c of cells) expect(gardenRingBlocker(c.x, c.z, site)).toBeNull()
  })

  it('집이 없으면 빈 목록이다', () => {
    expect(gardenRangeCells(null, () => true)).toEqual([])
  })

  it('안내 한 줄은 세 칸과 여섯 칸을 말한다', () => {
    expect(GARDEN_RANGE_TEXT).toContain('세 칸')
    expect(GARDEN_RANGE_TEXT).toContain('여섯 칸')
  })
})
