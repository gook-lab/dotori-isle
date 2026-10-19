import { describe, expect, it } from 'vitest'
import { cleanInteriorWall, cleanPaint, DEFAULT_PAINT, INTERIOR_WALL_COST, INTERIOR_WALLS, interiorAffordable, interiorWallColor, paintAffordable, paintColors, paintHint, paintTipDue, PAINT_OPTIONS } from './homePaint'
import { HOME_STAGES } from './home'

describe('집 외관 색', () => {
  it('저장값이 없거나 깨졌으면 전부 기본색(0번)이다', () => {
    expect(cleanPaint(undefined)).toEqual(DEFAULT_PAINT)
    expect(cleanPaint({ roof: 9, wall: -1, door: 1.5 })).toEqual(DEFAULT_PAINT)
    expect(cleanPaint({ roof: '2', wall: 2, door: 3 })).toEqual({ roof: 0, wall: 2, door: 3 })
  })

  it('기본색은 단계의 지붕·벽 색을 따르고, 고른 색은 그대로 쓴다', () => {
    const base = paintColors(1, DEFAULT_PAINT)
    expect(base.roof).toBe(HOME_STAGES[1].look.roof)
    expect(base.wall).toBe(HOME_STAGES[1].look.wall)
    const picked = paintColors(2, { roof: 1, wall: 2, door: 3 })
    expect(picked.roof).toBe(PAINT_OPTIONS.roof[1].color)
    expect(picked.wall).toBe(PAINT_OPTIONS.wall[2].color)
    expect(picked.door).toBe(PAINT_OPTIONS.door[3].color)
  })

  it('지붕 여섯 가지 안, 벽 네 가지 색(기본 포함), 문 네 가지 안이다', () => {
    expect(PAINT_OPTIONS.roof.length).toBeGreaterThanOrEqual(4)
    expect(PAINT_OPTIONS.roof.length).toBeLessThanOrEqual(6)
    expect(PAINT_OPTIONS.wall.length).toBe(5)
    expect(PAINT_OPTIONS.door.length).toBe(4)
  })
})

describe('외관 꾸미기 안내', () => {
  it('도토리가 가장 싼 칸(문 300)보다 모자라면 얼마를 더 모을지 말한다', () => {
    expect(paintHint(100, DEFAULT_PAINT)).toBe('도토리 200개만 더 모으면 문을 칠할 수 있어요')
  })

  it('아무것도 안 칠했으면 가장 싼 문부터 권한다', () => {
    expect(paintHint(5000, DEFAULT_PAINT)).toContain('문(도토리 300개)부터')
  })

  it('이미 칠했으면 칸별 가격을 보여 준다', () => {
    expect(paintHint(5000, { roof: 1, wall: 0, door: 0 })).toBe('지붕 🌰 1,000 · 벽 🌰 600 · 문 🌰 300')
  })

  it('돈이 충분하면 모자란 말은 하지 않는다', () => {
    expect(paintHint(300, DEFAULT_PAINT)).not.toContain('더 모으면')
  })
})

describe('외관 칠하기 첫 편지', () => {
  it('집을 지은 다음 날, 한 번도 안 칠했으면 보낸다', () => {
    expect(paintTipDue('2026-10-18', '2026-10-18', DEFAULT_PAINT)).toBe(true)
  })

  it('지은 날이 어제가 아니거나 집을 짓지 않았으면 보내지 않는다', () => {
    expect(paintTipDue('2026-10-17', '2026-10-18', DEFAULT_PAINT)).toBe(false)
    expect(paintTipDue(null, '2026-10-18', DEFAULT_PAINT)).toBe(false)
  })

  it('이미 한 번이라도 칠했으면 다시 알리지 않는다', () => {
    expect(paintTipDue('2026-10-18', '2026-10-18', { roof: 0, wall: 2, door: 0 })).toBe(false)
  })
})

describe('외관 칸을 고를 수 있는지', () => {
  it('정가보다 돈이 적으면 흐리게 보인다(지금 색은 예외)', () => {
    expect(paintAffordable(999, 'roof', 1, DEFAULT_PAINT)).toBe(false)
    expect(paintAffordable(1000, 'roof', 1, DEFAULT_PAINT)).toBe(true)
    expect(paintAffordable(0, 'roof', 0, DEFAULT_PAINT)).toBe(true)
  })
})

describe('실내 벽지', () => {
  it('저장값이 없거나 깨졌으면 크림(0번)이다', () => {
    expect(cleanInteriorWall(undefined)).toBe(0)
    expect(cleanInteriorWall(INTERIOR_WALLS.length)).toBe(0)
    expect(cleanInteriorWall(-1)).toBe(0)
    expect(cleanInteriorWall('2')).toBe(0)
    expect(cleanInteriorWall(2)).toBe(2)
  })

  it('0번은 본채 기본 벽 색 #eadbc2 이고, 칸마다 색이 다르다', () => {
    expect(interiorWallColor(0)).toBe('#eadbc2')
    const colors = INTERIOR_WALLS.map((w) => w.color)
    expect(new Set(colors).size).toBe(colors.length)
    expect(interiorWallColor(3)).toBe(INTERIOR_WALLS[3].color)
  })

  it('지금 벽지는 언제나 고를 수 있고, 다른 칸은 정가 이상이어야 한다', () => {
    expect(interiorAffordable(0, 2, 2)).toBe(true)
    expect(interiorAffordable(INTERIOR_WALL_COST - 1, 1, 0)).toBe(false)
    expect(interiorAffordable(INTERIOR_WALL_COST, 1, 0)).toBe(true)
  })
})
