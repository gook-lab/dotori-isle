import { describe, expect, it } from 'vitest'
import {
  SONGI_BUNDLE_PRICE,
  SONGI_PATTERNS,
  cleanSongiBuy,
  songiBase,
  songiBundlesLeft,
  songiFactor,
  songiNow,
  songiOpen,
  songiPattern,
  songiQuote,
  songiSlotOf,
  songiWeekOf,
  songiWeekQuotes,
  spoilSongi,
} from './songi'

const SUNDAY = '2026-10-18'
const MONDAY = '2026-10-19'

describe('송이 주 단위 날짜', () => {
  it('finds the Sunday that starts the week', () => {
    expect(songiWeekOf(MONDAY)).toBe(SUNDAY)
    expect(songiWeekOf('2026-10-24')).toBe(SUNDAY)
    expect(songiWeekOf(SUNDAY)).toBe(SUNDAY)
  })

  it('has no quote on Sunday and gives Monday morning slot 0 and Saturday afternoon slot 11', () => {
    expect(songiSlotOf(SUNDAY, true)).toBeNull()
    expect(songiSlotOf(MONDAY, true)).toBe(0)
    expect(songiSlotOf(MONDAY, false)).toBe(1)
    expect(songiSlotOf('2026-10-24', false)).toBe(11)
  })
})

describe('송이 시세 모양', () => {
  it('rises, falls, waves, and spikes once in the week', () => {
    const rise = Array.from({ length: 12 }, (_, k) => songiFactor('rise', k))
    const fall = Array.from({ length: 12 }, (_, k) => songiFactor('fall', k))
    const spike = Array.from({ length: 12 }, (_, k) => songiFactor('spike', k))
    const wave = Array.from({ length: 12 }, (_, k) => songiFactor('wave', k))
    expect(rise.every((v, k) => k === 0 || v > rise[k - 1])).toBe(true)
    expect(fall.every((v, k) => k === 0 || v < fall[k - 1])).toBe(true)
    expect(Math.max(...spike)).toBeGreaterThan(1.5)
    expect(spike.filter((v) => v > 1.5).length).toBe(3)
    expect(Math.max(...wave)).toBeGreaterThan(1.2)
    expect(Math.min(...wave)).toBeLessThan(0.8)
  })

  it('picks one of the four shapes per week, the same every time', () => {
    expect(SONGI_PATTERNS).toHaveLength(4)
    expect(songiPattern(SUNDAY)).toBe(songiPattern(SUNDAY))
    const seen = new Set(Array.from({ length: 40 }, (_, i) => songiPattern(`w-${i}`)))
    expect(seen.size).toBe(4)
  })

  it('keeps the base price in the 80 to 100 range', () => {
    for (let i = 0; i < 30; i++) {
      const b = songiBase(`w-${i}`)
      expect(b).toBeGreaterThanOrEqual(80)
      expect(b).toBeLessThanOrEqual(100)
    }
  })
})

describe('송이 시세 조회', () => {
  it('gives the same morning and afternoon quotes on every call for a day', () => {
    expect(songiQuote(MONDAY, true)).toBe(songiQuote(MONDAY, true))
    expect(songiWeekQuotes(SUNDAY)).toHaveLength(12)
    expect(songiQuote(MONDAY, true)).toBe(songiWeekQuotes(SUNDAY)[0])
    expect(songiQuote(MONDAY, false)).toBe(songiWeekQuotes(SUNDAY)[1])
  })

  it('is null on Sunday and returns 0 from songiNow when the market is closed', () => {
    expect(songiQuote(SUNDAY, true)).toBeNull()
    expect(songiNow(SUNDAY, 9)).toBe(0)
    expect(songiNow(MONDAY, 9)).toBe(songiQuote(MONDAY, true))
    expect(songiNow(MONDAY, 15)).toBe(songiQuote(MONDAY, false))
  })
})

describe('송이 상인 시간과 묶음 한도', () => {
  it('is open only on Sunday from 5 to before 12', () => {
    expect(songiOpen(SUNDAY, 5)).toBe(true)
    expect(songiOpen(SUNDAY, 11.9)).toBe(true)
    expect(songiOpen(SUNDAY, 12)).toBe(false)
    expect(songiOpen(SUNDAY, 4.9)).toBe(false)
    expect(songiOpen(MONDAY, 9)).toBe(false)
  })

  it('counts bundles per week and resets for a new week', () => {
    expect(songiBundlesLeft(null, SUNDAY)).toBe(3)
    expect(songiBundlesLeft({ week: SUNDAY, n: 2 }, SUNDAY)).toBe(1)
    expect(songiBundlesLeft({ week: SUNDAY, n: 3 }, SUNDAY)).toBe(0)
    expect(songiBundlesLeft({ week: SUNDAY, n: 3 }, '2026-10-25')).toBe(3)
    expect(SONGI_BUNDLE_PRICE).toBe(400)
  })
})

describe('송이 상하기와 저장 검증', () => {
  it('turns songi into spoiled songi and keeps the count', () => {
    const inv = [{ id: 'songi', count: 10 }, { id: 'acorn', count: 2 }]
    expect(spoilSongi(inv)).toEqual([{ id: 'songi-spoiled', count: 10 }, { id: 'acorn', count: 2 }])
  })

  it('accepts a valid record and rejects broken ones', () => {
    expect(cleanSongiBuy({ week: SUNDAY, n: 2 })).toEqual({ week: SUNDAY, n: 2 })
    expect(cleanSongiBuy({ week: MONDAY, n: 1 })).toBeNull()
    expect(cleanSongiBuy({ week: SUNDAY, n: 4 })).toBeNull()
    expect(cleanSongiBuy({ week: SUNDAY, n: 1.5 })).toBeNull()
    expect(cleanSongiBuy('x')).toBeNull()
    expect(cleanSongiBuy(null)).toBeNull()
  })
})
