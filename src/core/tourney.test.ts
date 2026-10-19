import { describe, expect, it } from 'vitest'
import { canExchange, canJoin, clockText, countCatch, finishRun, medalOf, NEW_TOURNEY, remainingMs, runOver, sanitizeTourney, scoreOf, startRun, TOURNEY_LEN_MS, tourneyWindow } from './tourney'

const SUN = '2026-03-15' // 일요일
const MON = '2026-03-16'

describe('대회 시간대', () => {
  it('opens only on Sunday between nine and six', () => {
    expect(tourneyWindow(SUN, 8)).toBe(false)
    expect(tourneyWindow(SUN, 9)).toBe(true)
    expect(tourneyWindow(SUN, 17)).toBe(true)
    expect(tourneyWindow(SUN, 18)).toBe(false)
    expect(tourneyWindow(MON, 12)).toBe(false)
  })

  it('lets a player join once a day, and not while a run is going', () => {
    expect(canJoin(NEW_TOURNEY, SUN, 10, false)).toBe(true)
    expect(canJoin({ points: 0, lastDay: SUN }, SUN, 10, false)).toBe(false)
    expect(canJoin(NEW_TOURNEY, SUN, 10, true)).toBe(false)
    expect(canJoin(NEW_TOURNEY, MON, 10, false)).toBe(false)
  })
})

describe('판과 시간', () => {
  it('runs for three minutes from the start', () => {
    const run = startRun(SUN, 1000)
    expect(run.endAt - 1000).toBe(TOURNEY_LEN_MS)
    expect(runOver(run, 1000 + TOURNEY_LEN_MS - 1)).toBe(false)
    expect(runOver(run, 1000 + TOURNEY_LEN_MS)).toBe(true)
  })

  it('counts catches only while a run exists', () => {
    expect(countCatch(null)).toBeNull()
    const once = countCatch(startRun(SUN, 0))
    expect(once?.count).toBe(1)
    expect(countCatch(once)?.count).toBe(2)
  })

  it('shows the time left as minutes and seconds, rounding up', () => {
    expect(clockText(TOURNEY_LEN_MS)).toBe('3:00')
    expect(clockText(179_001)).toBe('3:00')
    expect(clockText(61_000)).toBe('1:01')
    expect(clockText(1)).toBe('0:01')
    expect(clockText(0)).toBe('0:00')
    expect(remainingMs(startRun(SUN, 0), 500_000)).toBe(0)
  })
})

describe('점수와 포인트', () => {
  it('turns the catch count into points by tier', () => {
    expect([0, 3, 4, 7, 8, 11, 12, 30].map(scoreOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(medalOf(12)).toBe('금메달')
    expect(medalOf(0)).toBe('참가상')
  })

  it('adds the points and records the day when a run is finished', () => {
    const run = { day: SUN, endAt: 0, count: 9 }
    expect(finishRun({ points: 2, lastDay: null }, run)).toEqual({ points: 4, lastDay: SUN })
  })
})

describe('포인트 바꾸기', () => {
  it('needs enough points for the chosen prize', () => {
    expect(canExchange('tourney-trophy', 3)).toEqual({ ok: true, cost: 3 })
    expect(canExchange('tourney-trophy', 2)).toEqual({ ok: false, reason: '포인트가 1 모자라요' })
    expect(canExchange('chair', 99).ok).toBe(false)
  })

  it('keeps only a usable saved record', () => {
    expect(sanitizeTourney({ points: 4.7, lastDay: SUN })).toEqual({ points: 4, lastDay: SUN })
    expect(sanitizeTourney({ points: -2, lastDay: 5 })).toEqual({ points: 0, lastDay: null })
    expect(sanitizeTourney(undefined)).toEqual(NEW_TOURNEY)
  })
})
