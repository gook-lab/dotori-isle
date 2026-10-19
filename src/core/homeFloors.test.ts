import { describe, expect, it } from 'vitest'
import { floorOpen, hasAttic, hasCellar, hasSideRoom, homeCells, type HomeStage } from './home'
import { HOME_MOVES } from './interior'
import type { HomeFloor } from './interior'

const STAGES: HomeStage[] = [0, 1, 2, 3, 4, 5]

/** 단계별로 열리는 자리 표. 다락 3, 옆방 4, 지하실 5 이상이다. */
const TABLE: Record<number, { attic: boolean; side: boolean; cellar: boolean }> = {
  0: { attic: false, side: false, cellar: false },
  1: { attic: false, side: false, cellar: false },
  2: { attic: false, side: false, cellar: false },
  3: { attic: true, side: false, cellar: false },
  4: { attic: true, side: true, cellar: false },
  5: { attic: true, side: true, cellar: true },
}

describe('집 단계별 열리는 자리', () => {
  it('다락·옆방·지하실은 표대로 열린다(판정 함수 셋이 같은 표를 따른다)', () => {
    for (const stage of STAGES) {
      expect(hasAttic(stage), `attic ${stage}`).toBe(TABLE[stage].attic)
      expect(hasSideRoom(stage), `side ${stage}`).toBe(TABLE[stage].side)
      expect(hasCellar(stage), `cellar ${stage}`).toBe(TABLE[stage].cellar)
    }
  })

  it('판정 함수는 자리마다 층이 열리는 것과 같다', () => {
    for (const stage of STAGES) {
      expect(floorOpen(stage, 1)).toBe(hasAttic(stage))
      expect(floorOpen(stage, 2)).toBe(hasSideRoom(stage))
      expect(floorOpen(stage, 3)).toBe(hasCellar(stage))
    }
  })

  it('열린 자리에만 가구 칸이 있다', () => {
    for (const stage of STAGES) {
      expect(homeCells(stage, 1).length > 0, `attic cells ${stage}`).toBe(hasAttic(stage))
      expect(homeCells(stage, 2).length > 0, `side cells ${stage}`).toBe(hasSideRoom(stage))
      expect(homeCells(stage, 3).length > 0, `cellar cells ${stage}`).toBe(hasCellar(stage))
    }
  })

  it('옆방과 지하실 문·계단 이동은 그 단계에서만 열린다', () => {
    for (const stage of STAGES) {
      for (const m of HOME_MOVES) {
        const open = floorOpen(stage, m.to as HomeFloor)
        expect(open, `move ${m.from}->${m.to} at ${stage}`).toBe(m.to === 2 ? hasSideRoom(stage) : m.to === 3 ? hasCellar(stage) : true)
      }
    }
  })
})
