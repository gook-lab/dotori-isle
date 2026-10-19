import { describe, expect, it } from 'vitest'
import { ARRIVAL_DAYS, arrivalDayOf, birthdayWeek, canThinkOfMoving, leaveDayOf, MOVE_INTERVAL_DAYS, MOVE_LEAVE_DAYS, movers, pickMover, pickReplacement } from './moving'
import { birthdayOf } from './birthdays'
import { VILLAGERS } from './villagers'

const day = (n: number) => {
  const d = new Date(Date.UTC(2026, 2, 1) + n * 86400000)
  return d.toISOString().slice(0, 10)
}

describe('이사 고민 시작 조건', () => {
  it('처음 2주 동안에는 고민하지 않는다', () => {
    expect(canThinkOfMoving({ day: day(13), islandStart: day(0), lastMoveDay: null, moveTalk: null })).toBe(false)
    expect(canThinkOfMoving({ day: day(14), islandStart: day(0), lastMoveDay: null, moveTalk: null })).toBe(true)
  })

  it('고민은 한 달에 한 번이고, 지금 고민 중이면 새로 시작하지 않는다', () => {
    expect(canThinkOfMoving({ day: day(40), islandStart: day(0), lastMoveDay: day(20), moveTalk: null })).toBe(false)
    expect(canThinkOfMoving({ day: day(20 + MOVE_INTERVAL_DAYS), islandStart: day(0), lastMoveDay: day(20), moveTalk: null })).toBe(true)
    expect(canThinkOfMoving({ day: day(40), islandStart: day(0), lastMoveDay: null, moveTalk: { id: 'x', since: day(39) } })).toBe(false)
  })
})

describe('이사 후보와 고르기', () => {
  it('후보는 집을 지어 산 손님뿐이다', () => {
    const houses = ['sora', 'toto', 'mocha']
    const ids = movers(VILLAGERS, houses).map((v) => v.id)
    expect(ids).toEqual(['sora', 'toto'])
  })

  it('우정이 가장 낮은 주민을 고른다', () => {
    expect(pickMover([{ id: 'a', friendship: 5 }, { id: 'b', friendship: 2 }], day(30))).toBe('b')
  })

  it('생일 주간인 주민은 고르지 않는다', () => {
    const id = VILLAGERS[0].id
    const b = birthdayOf(id)
    const near = `2026-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
    expect(birthdayWeek(id, near)).toBe(true)
    expect(pickMover([{ id, friendship: 0 }], near)).toBeNull()
  })

  it('고민한 날부터 사흘 뒤 떠나고, 떠난 날부터 사흘 뒤 손님이 온다', () => {
    expect(MOVE_LEAVE_DAYS).toBe(3)
    expect(leaveDayOf(day(40))).toBe(day(43))
    expect(arrivalDayOf(day(43))).toBe(day(43 + ARRIVAL_DAYS))
  })

  it('캠핑장 손님 가운데 아직 집이 없는 손님을 고른다', () => {
    const guests = VILLAGERS.filter((v) => v.guest)
    const houses = [guests[0].id]
    const pick = pickReplacement(guests, houses, [], day(50))
    expect(pick).not.toBeNull()
    expect(houses).not.toContain(pick)
    expect(pickReplacement(guests, guests.map((g) => g.id), [], day(50))).toBeNull()
  })
})
