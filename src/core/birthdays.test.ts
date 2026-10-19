import { describe, expect, it } from 'vitest'
import { birthdayChatDue, birthdayOf, birthdaysOn, birthdayPartyNow, birthdayTalkLines, isBirthday, seasonOfBirthday } from './birthdays'
import { VILLAGERS } from './villagers'

const ids = VILLAGERS.map((v) => v.id)

describe('villager birthdays', () => {
  it('is the same for the same villager every time and stays on a real date', () => {
    for (const id of ids) {
      const b = birthdayOf(id)
      expect(birthdayOf(id)).toEqual(b)
      expect(b.month).toBeGreaterThanOrEqual(1)
      expect(b.month).toBeLessThanOrEqual(12)
      expect(b.day).toBeGreaterThanOrEqual(1)
      expect(b.day).toBeLessThanOrEqual(28)
    }
  })

  it('spreads the villagers over the calendar and over all four seasons', () => {
    const months = new Set(ids.map((id) => birthdayOf(id).month))
    const seasons = new Set(ids.map((id) => seasonOfBirthday(id)))
    expect(months.size).toBeGreaterThanOrEqual(7)
    expect(seasons.size).toBe(4)
  })

  it('matches only the day it falls on, every year', () => {
    const id = 'mocha'
    const { month, day } = birthdayOf(id)
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    expect(isBirthday(id, `2026-${mm}-${dd}`)).toBe(true)
    expect(isBirthday(id, `2031-${mm}-${dd}`)).toBe(true)
    expect(isBirthday(id, `2026-${mm}-${String(day === 28 ? 1 : day + 1).padStart(2, '0')}`)).toBe(false)
    expect(isBirthday(id, 'not-a-day')).toBe(false)
  })

  it('lists only the villagers whose birthday is that day', () => {
    const { month, day } = birthdayOf('bomi')
    const key = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    expect(birthdaysOn(ids, key)).toContain('bomi')
    expect(birthdaysOn(['bomi'], key)).toEqual(['bomi'])
  })
})

describe('생일 날 연출과 수다', () => {
  const mocha = birthdayOf('mocha')
  const birthdayDay = `2026-${String(mocha.month).padStart(2, '0')}-${String(mocha.day).padStart(2, '0')}`
  const otherDay = birthdayDay === '2026-10-07' ? '2026-10-08' : '2026-10-07'

  it('turns the party on only for the first talk on the birthday', () => {
    expect(birthdayPartyNow('mocha', birthdayDay, true)).toBe(true)
    expect(birthdayPartyNow('mocha', birthdayDay, false)).toBe(false)
    expect(birthdayPartyNow('mocha', otherDay, true)).toBe(false)
    expect(birthdayPartyNow('bomi', birthdayDay, true)).toBe(isBirthday('bomi', birthdayDay))
  })

  it('gives every personality two different birthday lines to talk about', () => {
    for (const p of ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy'] as const) {
      const lines = birthdayTalkLines(p)
      expect(lines).toHaveLength(2)
      expect(new Set(lines).size).toBe(2)
    }
  })

  it('guarantees one birthday talk on the second conversation, not the first, and only once a day', () => {
    expect(birthdayChatDue('mocha', birthdayDay, false, [])).toBe(true)
    expect(birthdayChatDue('mocha', birthdayDay, true, [])).toBe(false)
    expect(birthdayChatDue('mocha', birthdayDay, false, [`${birthdayDay}:mocha`])).toBe(false)
    expect(birthdayChatDue('mocha', otherDay, false, [])).toBe(false)
  })
})
