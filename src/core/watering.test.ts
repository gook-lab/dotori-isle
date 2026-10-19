import { describe, expect, it } from 'vitest'
import { canAreaLabel, canBuyUpgrade, canCells, canDir, canTargets, CAN_NAMES, inCan, isCanLevel, upgradeFor } from './watering'

describe('watering area — 바라보는 쪽 칸 정사각형', () => {
  it('has one, four and nine cells for levels 1, 2 and 3', () => {
    expect(canCells(0, 0, 0, 1)).toHaveLength(1)
    expect(canCells(0, 0, 0, 2)).toHaveLength(4)
    expect(canCells(0, 0, 0, 3)).toHaveLength(9)
  })

  it('puts the 2×2 block in front of the player, starting one cell ahead', () => {
    // 바라보는 쪽은 +z (facing 0). 발밑 칸은 빼고 앞 두 줄이다.
    expect(canCells(0, 0, 0, 2).map((c) => [c.x, c.z]).sort()).toEqual([[0, 1], [0, 2], [1, 1], [1, 2]])
    expect(inCan(0, 0, 0, 2, 0, 1)).toBe(true)
    expect(inCan(0, 0, 0, 2, 1, 2)).toBe(true)
    expect(inCan(0, 0, 0, 2, 0, 0)).toBe(false)
    expect(inCan(0, 0, 0, 2, -1, 1)).toBe(false)
    expect(inCan(0, 0, 0, 2, 0, 3)).toBe(false)
  })

  it('centres the 3×3 block one cell ahead', () => {
    expect(inCan(0, 0, 0, 3, 0, 1)).toBe(true)
    expect(inCan(0, 0, 0, 3, -1, 2)).toBe(true)
    expect(inCan(0, 0, 0, 3, 0, 3)).toBe(false)
    expect(inCan(0, 0, 0, 3, 2, 1)).toBe(false)
  })

  it('turns with the facing direction, to the nearest of the four directions', () => {
    // facing π/2 이면 바라보는 쪽은 +x
    expect(canDir(Math.PI / 2)).toEqual({ x: 1, z: 0 })
    expect(canDir(0.3)).toEqual({ x: 0, z: 1 })
    expect(canDir(-1.4)).toEqual({ x: -1, z: 0 })
    expect(inCan(0, 0, Math.PI / 2, 2, 1, 0)).toBe(true)
    expect(inCan(0, 0, Math.PI / 2, 2, 0, 1)).toBe(false)
  })

  it('rounds the player position to the cell it stands in', () => {
    expect(canCells(0.4, 0.2, 0, 1)).toEqual([{ x: 0, z: 1 }])
    expect(canCells(0.6, -0.4, 0, 1)).toEqual([{ x: 1, z: 1 }])
  })

  it('picks dry plants in the area first and falls back to wet ones', () => {
    const plants = [
      { id: 'wet', x: 0, z: 1, watered: true },
      { id: 'dry', x: 1, z: 2, watered: false },
      { id: 'far', x: 0, z: 5, watered: false },
    ]
    expect(canTargets(plants, 0, 0, 0, 2).map((p) => p.id)).toEqual(['dry'])
    const allWet = plants.map((p) => ({ ...p, watered: true }))
    expect(canTargets(allWet, 0, 0, 0, 2).map((p) => p.id)).toEqual(['wet', 'dry'])
    expect(canTargets(plants, 0, 0, 0, 1).map((p) => p.id)).toEqual(['wet'])
  })

  it('labels the area for the prompt and names each can', () => {
    expect(canAreaLabel(1)).toBe('')
    expect(canAreaLabel(2)).toBe(' (2×2)')
    expect(canAreaLabel(3)).toBe(' (3×3)')
    expect(CAN_NAMES[2]).toBe('넓은 물뿌리개')
    expect(isCanLevel(4)).toBe(false)
    expect(isCanLevel(3)).toBe(true)
  })
})

describe('watering can upgrades', () => {
  it('goes 1 → 2 → 3 and stops at the largest can', () => {
    expect(upgradeFor(1)?.level).toBe(2)
    expect(upgradeFor(2)?.level).toBe(3)
    expect(upgradeFor(3)).toBeNull()
  })

  it('needs the basic can first', () => {
    const r = canBuyUpgrade(false, 1, 1, 9999, 2)
    expect(r.ok).toBe(false)
  })

  it('needs the previous level, so the 3×3 can cannot be bought from the basic one', () => {
    const r = canBuyUpgrade(true, 1, 2, 9999, 3)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('넓은 물뿌리개')
  })

  it('needs the shop tier to be open, and enough acorns', () => {
    expect(canBuyUpgrade(true, 1, 0, 9999, 2).ok).toBe(false)
    expect(canBuyUpgrade(true, 1, 1, 100, 2).ok).toBe(false)
    expect(canBuyUpgrade(true, 1, 1, 350, 2)).toEqual({ ok: true, price: 350 })
  })

  it('does not sell a level the player already has', () => {
    expect(canBuyUpgrade(true, 2, 2, 9999, 2).ok).toBe(false)
  })
})
