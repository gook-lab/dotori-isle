import { describe, expect, it } from 'vitest'
import { fenceBlocker, fenceLinks, fenceSides, FENCE_FAR, FENCE_ID, FENCE_NEAR, isFence } from './fence'

const site = { x: 20, z: 20, door: { x: 20, z: 22.3 } }

describe('fenceBlocker', () => {
  it('leaves other furniture to the normal placement rules', () => {
    expect(fenceBlocker('chair', 20, 20, site)).toBeNull()
  })

  it('needs a house first', () => {
    expect(fenceBlocker(FENCE_ID, 25, 20, null)).toBeTruthy()
  })

  it('allows the ring between the house and the outer limit', () => {
    expect(fenceBlocker(FENCE_ID, 20 + FENCE_NEAR, 20, site)).toBeNull()
    expect(fenceBlocker(FENCE_ID, 20 - FENCE_FAR, 20 + 2, site)).toBeNull()
  })

  it('keeps the inside of the house ring and the outside clear', () => {
    expect(fenceBlocker(FENCE_ID, 20 + FENCE_NEAR - 1, 20, site)).toContain('몸체')
    expect(fenceBlocker(FENCE_ID, 20 + FENCE_FAR + 1, 20, site)).toContain('여섯 칸')
  })

  it('keeps the front door clear', () => {
    expect(fenceBlocker(FENCE_ID, 20, 23, site)).toContain('현관')
  })
})

describe('fence kinds and links', () => {
  const at = (x: number, z: number, itemId = FENCE_ID) => ({ id: `${itemId}-${x}-${z}`, itemId, x, z, rot: 0 })

  it('lets every fence kind be placed, but not other furniture', () => {
    expect(isFence('fence-white')).toBe(true)
    expect(isFence('fence-stone')).toBe(true)
    expect(isFence('chair')).toBe(false)
    expect(fenceBlocker('fence-stone', 25, 20, site)).toBeNull()
  })

  it('reports the neighbour sides a fence cell connects to, across kinds', () => {
    const placed = [at(20, 20), at(21, 20, 'fence-white'), at(20, 21, 'fence-stone')]
    expect(fenceSides(placed, 20, 20)).toEqual({ n: true, e: true, s: false, w: false })
    expect(fenceSides(placed, 21, 20)).toEqual({ n: false, e: false, s: false, w: true })
  })

  it('counts each adjacent fence pair once, only inside the ring', () => {
    // 가로로 네 칸: 세 쌍
    const row = [0, 1, 2, 3].map((k) => at(23 + k, 20))
    expect(fenceLinks(row, site)).toBe(3)
    // 몸체 바로 옆 칸(반경 2)은 세지 않는다
    expect(fenceLinks([at(21, 20), at(22, 20)], site)).toBe(0)
    expect(fenceLinks([], null)).toBe(0)
  })

  it('does not link fences that are only diagonal', () => {
    expect(fenceLinks([at(23, 20), at(24, 21)], site)).toBe(0)
  })
})
