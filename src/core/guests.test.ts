import { describe, expect, it } from 'vitest'
import { GUESTS, guestTalk, tripGuestsFor } from './guests'
import { byWater, tripDist } from './island'
import { VILLAGERS } from './villagers'
import { canStand } from './world'

describe('여행 섬 손님', () => {
  it('손님은 여덟 명이고 집터가 섬 안 물가 밖에 있다', () => {
    expect(GUESTS.length).toBe(8)
    for (const g of GUESTS) {
      expect(g.newcomer).toBe(true)
      expect(byWater(g.house.x, g.house.z, 1.7)).toBe(false)
    }
    // 기존 주민이 목록 앞에 그대로 있다(집 자리가 바뀌지 않게).
    expect(VILLAGERS.slice(0, 11).every((v) => !v.guest)).toBe(true)
  })

  it('여행마다 두 명이 여행 섬 걸을 수 있는 자리에 놓인다', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const list = tripGuestsFor(`seed-${i}`, [])
      expect(list.length).toBe(2)
      expect(list[0].id).not.toBe(list[1].id)
      for (const g of list) {
        seen.add(g.id)
        expect(tripDist(g.x, g.z)).toBeLessThan(0.7)
        expect(canStand(g.x, g.z)).toBe(true)
      }
    }
    // 무작위라 여러 번 가면 여러 손님을 만난다.
    expect(seen.size).toBeGreaterThan(5)
  })

  it('같은 seed 는 같은 손님, 초대했거나 이사 온 손님은 빠진다', () => {
    expect(tripGuestsFor('a', [])).toEqual(tripGuestsFor('a', []))
    const taken = GUESTS.slice(0, 7).map((g) => g.id)
    const list = tripGuestsFor('b', taken)
    expect(list.map((g) => g.id)).toEqual([GUESTS[7].id])
    expect(tripGuestsFor('c', GUESTS.map((g) => g.id))).toEqual([])
  })

  it('처음 만나면 자기소개 후 초대 질문을 하고, 다른 손님 집을 기다리는 중엔 묻지 않는다', () => {
    const v = GUESTS[0]
    const first = guestTalk(v, { nth: 1, invited: false, waiting: null })
    expect(first.lines[0]).toContain(v.name)
    expect(first.ask?.options.some((o) => o.invite)).toBe(true)
    expect(guestTalk(v, { nth: 2, invited: false, waiting: '소라' }).ask).toBeNull()
    expect(guestTalk(v, { nth: 2, invited: true, waiting: null }).ask).toBeNull()
  })
})
