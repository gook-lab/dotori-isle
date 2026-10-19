import { describe, expect, it } from 'vitest'
import { generateDay } from './daily'
import { weatherFor } from './weather'
import { addDays, balloonHour, balloonProgress, BALLOON_SPAN, typhoonAftermath, typhoonDays, typhoonEve, typhoonOn, windDay, windLevel } from './wind'

describe('addDays', () => {
  it('넘어가는 달과 해도 맞게 더한다', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('바람 날', () => {
  it('봄·가을에만 나고 같은 날이면 늘 같다', () => {
    const days = Array.from({ length: 365 }, (_, i) => addDays('2026-01-01', i))
    for (const d of days) {
      if (windDay(d)) expect(['2026-03', '2026-04', '2026-05', '2026-09', '2026-10', '2026-11']).toContain(d.slice(0, 7))
    }
  })
  it('봄·가을 몇 달 동안 가끔(대략 열 날 안팎) 분다', () => {
    const springAutumn = Array.from({ length: 183 }, (_, i) => addDays('2026-03-01', i)).filter((d) => d.slice(5, 7) !== '07' && d.slice(5, 7) !== '08')
    const n = springAutumn.filter(windDay).length
    expect(n).toBeGreaterThan(5)
    expect(n).toBeLessThan(60)
  })
  it('태풍 날은 바람 날에 넣지 않고 태풍 단계로 본다', () => {
    const t = typhoonDays(2026)[0]
    expect(windDay(t)).toBe(false)
    expect(windLevel(t)).toBe('typhoon')
  })
})

describe('바람 풍선', () => {
  it('바람 날에만, 10시에서 16시 사이에 뜬다', () => {
    for (let i = 0; i < 200; i++) {
      const d = addDays('2026-03-01', i)
      const h = balloonHour(d)
      if (h === null) continue
      expect(windDay(d)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(10)
      expect(h).toBeLessThanOrEqual(15)
    }
  })
  it('떠 있는 동안만 진행도를 주고, 밖이면 null', () => {
    const d = Array.from({ length: 200 }, (_, i) => addDays('2026-03-01', i)).find((x) => balloonHour(x) !== null)!
    const h = balloonHour(d)!
    expect(balloonProgress(d, h + BALLOON_SPAN / 2)).toBeCloseTo(0.5)
    expect(balloonProgress(d, h - 0.1)).toBeNull()
    expect(balloonProgress(d, h + BALLOON_SPAN + 0.01)).toBeNull()
  })
})

describe('태풍', () => {
  it('해마다 8월 20일 이후에 한두 번 온다', () => {
    for (let y = 2026; y < 2046; y++) {
      const ds = typhoonDays(y)
      expect(ds.length === 1 || ds.length === 2).toBe(true)
      expect(new Set(ds).size).toBe(ds.length)
      for (const d of ds) {
        expect(d.slice(0, 7)).toBe(`${y}-08`)
        expect(Number(d.slice(8))).toBeGreaterThanOrEqual(20)
      }
    }
  })
  it('같은 해에는 늘 같고 해마다 다르다', () => {
    expect(typhoonDays(2027)).toEqual(typhoonDays(2027))
    const all = Array.from({ length: 20 }, (_, i) => typhoonDays(2026 + i).join(','))
    expect(new Set(all).size).toBeGreaterThan(5)
  })
  it('예보는 태풍 전날, 여파는 태풍 다음 날에 맞는다', () => {
    const t = typhoonDays(2026)[0]
    expect(typhoonEve(addDays(t, -1))).toBe(true)
    expect(typhoonAftermath(addDays(t, 1))).toBe(true)
    expect(typhoonAftermath(t)).toBe(false)
    expect(typhoonOn(addDays(t, 1))).toBe(false)
  })
})

describe('태풍 날 날씨와 여파', () => {
  it('태풍 날은 비, 다음 날 해변엔 떠밀려 온 물건이 더 많다', () => {
    const t = typhoonDays(2026)[0]
    expect(weatherFor(t)).toBe('rain')
    const after = addDays(t, 1)
    const washed = generateDay(after).shells.filter((x) => x.id.includes('-wash-'))
    expect(washed.length).toBeGreaterThan(0)
    expect(generateDay(addDays(t, 2)).shells.some((x) => x.id.includes('-wash-'))).toBe(false)
  })
})
