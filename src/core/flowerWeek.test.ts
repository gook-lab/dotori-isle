import { describe, expect, it } from 'vitest'
import { cleanFlowerWeek, FLOWER_DAY_CAP, flowerBonus, flowerWeekLine, flowerWeekLetter, flowerWeekOn, flowerWeekStart, NEW_FLOWER_WEEK } from './flowerWeek'

const D = '2026-04-02'

describe('봄 꽃 심기 주간 — 기간', () => {
  it('4월 1~7일만 주간이고, 첫날에만 편지 날이다', () => {
    expect(flowerWeekOn('2026-04-01')).toBe(true)
    expect(flowerWeekOn('2026-04-07')).toBe(true)
    expect(flowerWeekOn('2026-04-08')).toBe(false)
    expect(flowerWeekOn('2026-03-31')).toBe(false)
    expect(flowerWeekStart('2026-04-01')).toBe(true)
    expect(flowerWeekStart('2026-04-02')).toBe(false)
  })
})

describe('봄 꽃 심기 주간 — 보너스', () => {
  it('씨앗은 2마일, 물 준 꽃은 1마일이고, 주간 밖에서는 0이다', () => {
    expect(flowerBonus(NEW_FLOWER_WEEK, 'plant', 1, D).miles).toBe(2)
    expect(flowerBonus(NEW_FLOWER_WEEK, 'water', 3, D).miles).toBe(3)
    expect(flowerBonus(NEW_FLOWER_WEEK, 'plant', 1, '2026-04-10').miles).toBe(0)
    expect(flowerBonus(NEW_FLOWER_WEEK, 'water', 0, D).miles).toBe(0)
  })

  it('하루 상한은 10마일이고, 넘는 만큼은 주지 않는다', () => {
    let st = NEW_FLOWER_WEEK
    let total = 0
    for (let i = 0; i < 8; i++) {
      const r = flowerBonus(st, 'plant', 1, D)
      st = r.state
      total += r.miles
    }
    expect(total).toBe(FLOWER_DAY_CAP)
    expect(st).toEqual({ day: D, miles: FLOWER_DAY_CAP })
  })

  it('다음 날에는 상한이 새로 찬다', () => {
    const full = flowerBonus(NEW_FLOWER_WEEK, 'plant', 5, D)
    expect(full.miles).toBe(FLOWER_DAY_CAP)
    expect(flowerBonus(full.state, 'water', 2, '2026-04-03').miles).toBe(2)
  })

  it('한 주 전체 보너스는 하루 상한의 일곱 배(70마일)를 넘지 않는다', () => {
    expect(FLOWER_DAY_CAP * 7).toBe(70)
  })
})

describe('봄 꽃 심기 주간 — 줄과 저장', () => {
  it('HUD 줄은 주간에만 오늘 받은 양을 보여 주고, 상한이 차면 다 받았다고 말한다', () => {
    expect(flowerWeekLine(NEW_FLOWER_WEEK, '2026-04-10')).toBeNull()
    expect(flowerWeekLine(NEW_FLOWER_WEEK, D)).toBe('🌷 꽃 심기 주간 · 오늘 0/10마일')
    expect(flowerWeekLine({ day: D, miles: 4 }, D)).toBe('🌷 꽃 심기 주간 · 오늘 4/10마일')
    expect(flowerWeekLine({ day: D, miles: 10 }, D)).toBe('🌷 꽃 심기 주간 · 오늘 보너스를 다 받았어요')
    expect(flowerWeekLine({ day: D, miles: 10 }, '2026-04-03')).toBe('🌷 꽃 심기 주간 · 오늘 0/10마일')
  })

  it('저장값은 맞는 것만 받고, 틀리면 처음 상태로 돌린다', () => {
    expect(cleanFlowerWeek({ day: D, miles: 6 })).toEqual({ day: D, miles: 6 })
    expect(cleanFlowerWeek({ day: 'bad', miles: 6 })).toEqual(NEW_FLOWER_WEEK)
    expect(cleanFlowerWeek({ day: D, miles: 99 })).toEqual({ day: D, miles: 0 })
    expect(cleanFlowerWeek({ day: D, miles: 1.5 })).toEqual({ day: D, miles: 0 })
    expect(cleanFlowerWeek(null)).toEqual(NEW_FLOWER_WEEK)
  })

  it('첫날 편지는 날짜로 id 를 정하고 보너스 규칙을 적는다', () => {
    const l = flowerWeekLetter('2026-04-01')
    expect(l.id).toBe('flower-week-2026-04-01')
    expect(l.text).toContain('2마일')
    expect(l.text).toContain('1마일')
    expect(l.text).toContain('10마일')
  })
})
