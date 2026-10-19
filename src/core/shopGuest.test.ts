import { describe, expect, it } from 'vitest'
import { GUEST_FROM, GUEST_MAX, GUEST_TO, shopGuestIds, shopGuestLine, shopGuestSpot } from './shopGuest'
import { birthdayOf } from './birthdays'
import { VILLAGERS } from './villagers'

const ids = VILLAGERS.map((v) => v.id)

describe('도토리 상점 손님: 누가 언제', () => {
  it('낮 시간대에만 오고, 밤이나 이른 아침에는 오지 않는다', () => {
    expect(shopGuestIds('2026-10-19', GUEST_FROM - 1, ids)).toEqual([])
    expect(shopGuestIds('2026-10-19', GUEST_TO, ids)).toEqual([])
    expect(shopGuestIds('2026-10-19', 23, ids)).toEqual([])
  })

  it('하루에 최대 두 명이고, 후보 밖의 주민은 오지 않는다', () => {
    let max = 0
    for (let d = 1; d <= 30; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      const got = shopGuestIds(day, 12, ids)
      expect(got.length).toBeLessThanOrEqual(GUEST_MAX)
      for (const id of got) expect(ids).toContain(id)
      max = Math.max(max, got.length)
    }
    expect(max).toBeGreaterThan(0)
  })

  it('생일인 주민은 그날 상점 손님이 되지 않는다', () => {
    for (const v of VILLAGERS) {
      const b = birthdayOf(v.id)
      const day = `2026-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
      for (let h = GUEST_FROM; h < GUEST_TO; h++) expect(shopGuestIds(day, h, ids)).not.toContain(v.id)
    }
  })

  it('같은 날·같은 후보면 늘 같은 손님이 온다', () => {
    expect(shopGuestIds('2026-10-19', 12, ids)).toEqual(shopGuestIds('2026-10-19', 12, ids))
    expect(shopGuestIds('2026-10-19', 12, [])).toEqual([])
  })
})

describe('도토리 상점 손님: 걸음과 말', () => {
  it('손님은 진열대 앞 바닥 띠 안에서 오간다', () => {
    for (let t = 0; t < 200; t += 3.7) {
      const p = shopGuestSpot(1, t)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(2.2)
      expect(p.z).toBeGreaterThanOrEqual(0.8)
      expect(p.z).toBeLessThanOrEqual(2.0)
    }
  })

  it('말은 주민의 말끝 버릇을 붙여 쇼핑 대사로 나온다', () => {
    for (const v of VILLAGERS) {
      const line = shopGuestLine(v, '2026-10-19')
      expect(line.length).toBeGreaterThan(5)
      expect(line).toMatch(/[가-힣]/)
    }
  })
})
