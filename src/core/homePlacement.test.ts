import { describe, expect, it } from 'vitest'
import { canPlaceInHome, homeCells, homeFixed, homePlaceBlocker, type HomeStage } from './home'
import type { Placed } from './placement'

const STAGES: HomeStage[] = [0, 1, 2, 3, 4, 5]
const piece = (itemId: string, x: number, z: number, floor: 0 | 1 | 2 | 3 = 0): Placed => ({ id: `${itemId}-${x}-${z}`, itemId, x, z, rot: 0, floor })

describe('방 가구 놓는 칸 규칙', () => {
  it('벽걸이도 바닥 가구와 같은 칸 규칙을 따른다: 같은 칸에는 하나만 놓인다', () => {
    const rack = piece('tool-rack', 1, 0)
    expect(canPlaceInHome(1, 0, 5, [rack], 0)).toBe(false)
    expect(canPlaceInHome(1, 0, 5, [piece('table', 1, 0)], 0)).toBe(false)
  })

  it('정상 배치는 침대와 보관함 자리에 겹치지 않는다', () => {
    for (const stage of STAGES) {
      if (stage === 0) continue
      for (const cell of homeCells(stage, 0)) {
        if (!canPlaceInHome(cell.x, cell.z, stage, [], 0)) continue
        for (const f of homeFixed(stage)) {
          expect(Math.hypot(f.x - cell.x, f.z - cell.z), `stage ${stage} (${cell.x},${cell.z})`).toBeGreaterThanOrEqual(f.r + 0.45)
        }
      }
    }
  })

  it('다락 칸은 본채 칸과 따로 센다: 다락에 놓인 가구가 본채 칸을 막지 않는다', () => {
    const attic = piece('tool-rack', 0, 0, 1)
    expect(canPlaceInHome(0, 0, 3, [attic], 0)).toBe(true)
    expect(canPlaceInHome(0, 0, 3, [attic], 1)).toBe(false)
  })

  it('못 놓는 까닭을 한 줄로 말한다: 칸 밖, 가구 있음, 침대, 보관함', () => {
    const [bed, chest] = homeFixed(5)
    expect(homePlaceBlocker(99, 99, 5, [], 0)).toContain('안쪽 칸')
    expect(homePlaceBlocker(1, 0, 5, [piece('table', 1, 0)], 0)).toContain('이미 가구')
    const nearBed = homeCells(5, 0).filter((c) => Math.hypot(bed.x - c.x, bed.z - c.z) < bed.r + 0.45)
    const nearChest = homeCells(5, 0).filter((c) => Math.hypot(chest.x - c.x, chest.z - c.z) < chest.r + 0.45)
    expect(nearBed.length + nearChest.length).toBeGreaterThan(0)
    for (const c of nearBed) expect(homePlaceBlocker(c.x, c.z, 5, [], 0)).toContain('침대')
    for (const c of nearChest) expect(homePlaceBlocker(c.x, c.z, 5, [], 0)).toContain('보관함')
  })

  it('못 놓는 까닭이 없는 칸만 놓을 수 있다', () => {
    for (const cell of homeCells(5, 0)) {
      expect(canPlaceInHome(cell.x, cell.z, 5, [], 0)).toBe(homePlaceBlocker(cell.x, cell.z, 5, [], 0) === null)
    }
  })
})
