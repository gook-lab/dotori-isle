import { describe, expect, it } from 'vitest'
import { homeCells } from './home'
import { stageSpace, upgradeLines, upgradePreview } from './upgradePreview'
import { wallSlots } from './wallHang'

describe('증축 미리보기', () => {
  it('마지막 단계에는 미리보기가 없다', () => {
    expect(upgradePreview(5)).toBeNull()
  })

  it('가구 칸은 열린 층의 homeCells 합계와 같다', () => {
    const s = stageSpace(4)
    const total = [0, 1, 2, 3].reduce((a, f) => a + homeCells(4, f as 0 | 1 | 2 | 3).length, 0)
    expect(s.cells).toBe(total)
  })

  it('벽걸이 자리는 열린 층의 wallSlots 방향별 합계와 같다', () => {
    const s = stageSpace(3)
    const count = (dir: 'n' | 'e' | 'w') => [0, 1].reduce((a, f) => a + wallSlots(3, f as 0 | 1).filter((x) => x.dir === dir).length, 0)
    expect(s.walls).toEqual({ n: count('n'), e: count('e'), w: count('w') })
  })

  it('새로 생기는 방은 다음 단계에서 새로 열리는 층이다', () => {
    expect(upgradePreview(0)!.newRooms).toEqual([])
    expect(upgradePreview(1)!.newRooms).toEqual([])
    expect(upgradePreview(2)!.newRooms).toEqual(['다락'])
    expect(upgradePreview(3)!.newRooms).toEqual(['옆방'])
    expect(upgradePreview(4)!.newRooms).toEqual(['지하실'])
    expect(upgradePreview(5)).toBeNull()
  })

  it('증축하면 칸과 벽걸이 자리가 늘어난다', () => {
    for (const stage of [0, 1, 2, 3, 4] as const) {
      const p = upgradePreview(stage)!
      expect(p.to.cells).toBeGreaterThan(p.from.cells)
      expect(p.to.walls.n + p.to.walls.e + p.to.walls.w).toBeGreaterThanOrEqual(p.from.walls.n + p.from.walls.e + p.from.walls.w)
    }
  })

  it('미리보기 줄은 세 줄이고 해요체로 끝난다', () => {
    const lines = upgradeLines(upgradePreview(3)!)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('칸이')
    expect(lines[1]).toMatch(/벽걸이 자리가 \d+곳에서 \d+곳으로 늘어나요/)
    expect(lines[2]).toContain('옆방')
    expect(lines.every((l) => /요\.?$/.test(l))).toBe(true)
  })

  it('숫자가 같으면 그대로라고 쓴다', () => {
    const same = { from: stageSpace(0), to: stageSpace(0), newRooms: [] as string[] }
    const lines = upgradeLines(same)
    expect(lines[0]).toBe('가구 칸은 그대로예요')
    expect(lines[1]).toBe('벽걸이 자리는 그대로예요')
    expect(lines[2]).toBe('새로 생기는 방은 없어요')
  })
})
