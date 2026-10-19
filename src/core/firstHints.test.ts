import { describe, expect, it } from 'vitest'
import { cleanSeenHints, FIRST_HINTS, firstHintOnce, isFirstHint } from './firstHints'

describe('처음 안내: 한 번만 띄우기', () => {
  it('gives the text the first time and remembers it', () => {
    const r = firstHintOnce([], 'atm')
    expect(r?.text).toBe(FIRST_HINTS.atm)
    expect(r?.seen).toEqual(['atm'])
  })

  it('stays silent once it has been seen, and keeps the other seen hints', () => {
    expect(firstHintOnce(['atm'], 'atm')).toBeNull()
    expect(firstHintOnce(['atm'], 'phone')?.seen).toEqual(['atm', 'phone'])
  })

  it('writes a short one-sentence-style line for every feature', () => {
    for (const text of Object.values(FIRST_HINTS)) {
      expect(text.length).toBeGreaterThan(10)
      expect(text.length).toBeLessThan(90)
    }
  })
})

describe('처음 안내: 저장값 검증', () => {
  it('knows only the feature ids', () => {
    expect(isFirstHint('hall')).toBe(true)
    expect(isFirstHint('toString')).toBe(false)
    expect(isFirstHint(3)).toBe(false)
  })

  it('drops unknown and repeated values, and treats a missing list as empty', () => {
    expect(cleanSeenHints(['atm', 'nope', 'atm', 'bottle'])).toEqual(['atm', 'bottle'])
    expect(cleanSeenHints(undefined)).toEqual([])
    expect(cleanSeenHints('atm')).toEqual([])
  })
})
