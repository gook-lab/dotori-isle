import { describe, expect, it } from 'vitest'
import { crowdHour, crowdSpeakers, CROWD_SPEAKERS, festivalDone, festivalEve, festivalOn, FESTIVALS, nextDay, progressOn } from './festivals'

describe('festival dates', () => {
  it('falls on the fifteenth of one month per season only', () => {
    expect(festivalOn('2026-04-15')?.season).toBe('spring')
    expect(festivalOn('2026-07-15')?.name).toBe('여름 불꽃놀이 밤')
    expect(festivalOn('2026-10-15')?.task).toBe('offer')
    expect(festivalOn('2027-01-15')?.season).toBe('winter')
  })

  it('is no festival on other days or other months', () => {
    expect(festivalOn('2026-04-14')).toBeNull()
    expect(festivalOn('2026-05-15')).toBeNull()
    expect(festivalOn('2026-01-15')?.season).toBe('winter')
    expect(festivalOn('2026-12-15')).toBeNull()
  })

  it('knows the festival that starts tomorrow for the eve letter', () => {
    expect(festivalEve('2026-07-14')?.season).toBe('summer')
    expect(festivalEve('2026-07-13')).toBeNull()
    expect(festivalEve('2026-07-15')).toBeNull()
  })

  it('steps to the next calendar day across months and years', () => {
    expect(nextDay('2026-01-31')).toBe('2026-02-01')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
  })

  it('every festival has a task that is achievable', () => {
    for (const f of Object.values(FESTIVALS)) {
      expect(f.target).toBeGreaterThan(0)
      expect(festivalOn(`2026-${String(f.month).padStart(2, '0')}-15`)).toBe(f)
    }
  })
})

describe('festival crowd hours', () => {
  it('gathers villagers from the evening through night only', () => {
    expect(crowdHour(16)).toBe(false)
    expect(crowdHour(17)).toBe(true)
    expect(crowdHour(22)).toBe(true)
    expect(crowdHour(23)).toBe(false)
  })
})

describe('crowd speakers', () => {
  it('picks at most three villagers, the same ones every time', () => {
    const ids = ['mocha', 'bomi', 'pengdol', 'guriguri', 'dongri']
    const a = crowdSpeakers(ids)
    expect(a).toHaveLength(CROWD_SPEAKERS)
    expect(crowdSpeakers([...ids].reverse())).toEqual(a)
    expect(crowdSpeakers(['mocha'])).toEqual(['mocha'])
  })
})

describe('festival progress', () => {
  it('counts only progress that belongs to the same day', () => {
    expect(progressOn({ day: '2026-04-15', n: 2 }, '2026-04-15')).toBe(2)
    expect(progressOn({ day: '2026-04-15', n: 2 }, '2026-04-16')).toBe(0)
    expect(progressOn({ day: null, n: 0 }, '2026-04-15')).toBe(0)
  })

  it('is done once progress reaches the target', () => {
    expect(festivalDone(FESTIVALS.spring, 2)).toBe(false)
    expect(festivalDone(FESTIVALS.spring, 3)).toBe(true)
    expect(festivalDone(FESTIVALS.summer, 1)).toBe(true)
  })
})
