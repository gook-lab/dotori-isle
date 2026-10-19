import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import {
  cleanPlayerBirthday,
  isPlayerBirthday,
  PLAYER_BIRTHDAY_GIFT,
  playerBirthdayLabel,
  playerBirthdayLetter,
  playerBirthdayTalkDue,
  playerBirthdayTalkLines,
} from './playerBirthday'

const PERSONALITIES = ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy'] as const

describe('플레이어 생일 판정', () => {
  it('matches only the chosen month and day, every year', () => {
    const bd = { month: 10, day: 7 }
    expect(isPlayerBirthday(bd, '2026-10-07')).toBe(true)
    expect(isPlayerBirthday(bd, '2027-10-07')).toBe(true)
    expect(isPlayerBirthday(bd, '2026-10-08')).toBe(false)
    expect(isPlayerBirthday(bd, '2026-07-10')).toBe(false)
  })

  it('is never a birthday when the player has not chosen one', () => {
    expect(isPlayerBirthday(null, '2026-10-07')).toBe(false)
    expect(isPlayerBirthday(undefined, '2026-10-07')).toBe(false)
  })

  it('reads the saved value strictly and drops anything out of range', () => {
    expect(cleanPlayerBirthday({ month: 3, day: 28 })).toEqual({ month: 3, day: 28 })
    expect(cleanPlayerBirthday({ month: 13, day: 1 })).toBeNull()
    expect(cleanPlayerBirthday({ month: 2, day: 29 })).toBeNull()
    expect(cleanPlayerBirthday({ month: 0, day: 5 })).toBeNull()
    expect(cleanPlayerBirthday({ month: '3', day: 5 })).toBeNull()
    expect(cleanPlayerBirthday({ month: 3.5, day: 5 })).toBeNull()
    expect(cleanPlayerBirthday(null)).toBeNull()
    expect(cleanPlayerBirthday('10/7')).toBeNull()
  })

  it('labels the birthday for the settings screen', () => {
    expect(playerBirthdayLabel({ month: 10, day: 7 })).toBe('10월 7일')
    expect(playerBirthdayLabel(null)).toBe('정하지 않음')
  })
})

describe('플레이어 생일 축하', () => {
  it('sends a committee letter with a small flowerpot gift', () => {
    const l = playerBirthdayLetter('2026-10-07')
    expect(l).toMatchObject({ id: 'player-birthday-2026-10-07', from: 'committee', day: '2026-10-07', gift: PLAYER_BIRTHDAY_GIFT })
    expect(ITEMS[PLAYER_BIRTHDAY_GIFT]).toMatchObject({ kind: 'furniture' })
  })

  it('gives every personality two different birthday lines', () => {
    for (const p of PERSONALITIES) {
      const lines = playerBirthdayTalkLines(p)
      expect(lines).toHaveLength(2)
      expect(new Set(lines).size).toBe(2)
    }
  })

  it('forces the congratulation only on the first talk of the birthday', () => {
    const bd = { month: 10, day: 7 }
    expect(playerBirthdayTalkDue(bd, '2026-10-07', true)).toBe(true)
    expect(playerBirthdayTalkDue(bd, '2026-10-07', false)).toBe(false)
    expect(playerBirthdayTalkDue(bd, '2026-10-08', true)).toBe(false)
    expect(playerBirthdayTalkDue(null, '2026-10-07', true)).toBe(false)
  })
})
