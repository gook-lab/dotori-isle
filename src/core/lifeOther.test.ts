import { describe, expect, it } from 'vitest'
import { cleanDailyMoney, cleanLedger, otherOf, todayRow } from './life'

const DAY = '2026-10-29'

describe('가계부 그 밖의 흐름', () => {
  it('지갑 변화에서 번 것·쓴 것·ATM 이동을 뺀 나머지다', () => {
    const stats = { earn: 400, spent: 100, atmIn: 50, atmOut: 200 }
    // 지갑: 3000 + 번 400 − 쓴 100 + 통장에서 뺀 50 − 통장에 넣은·상환한 200 + 그 밖 80
    expect(otherOf(3000 + 400 - 100 + 50 - 200 + 80, 3000, stats, {})).toBe(80)
    expect(otherOf(3000 + 400 - 100 + 50 - 200 - 60, 3000, stats, {})).toBe(-60)
  })

  it('아침 기준값(dailyMoney)이 없으면 0 이다', () => {
    expect(otherOf(5000, null, { earn: 10 }, {})).toBe(0)
  })

  it('오늘 줄에 그 밖의 흐름을 받은 것과 쓴 것으로 나누어 붙인다', () => {
    expect(todayRow({ earn: 10 }, {}, 0).line).toBe('번 도토리 10개 · 쓴 도토리 0개')
    expect(todayRow({ earn: 10 }, {}, 250).line).toBe('번 도토리 10개 · 쓴 도토리 0개 · 그 밖에 받은\u00a0250개')
    expect(todayRow({}, {}, -40).line).toBe('번 도토리 0개 · 쓴 도토리 0개 · 그 밖에 쓴\u00a040개')
  })

  it('불러온 가계부는 그 밖의 흐름(음수 포함)을 지키고, 없으면 비워 둔다', () => {
    const out = cleanLedger([
      { day: DAY, earned: 10, spent: 0, other: -40 },
      { day: '2026-10-28', earned: 5, spent: 1 },
    ])
    expect(out).toEqual([
      { day: '2026-10-28', earned: 5, spent: 1 },
      { day: DAY, earned: 10, spent: 0, other: -40 },
    ])
  })

  it('아침 기준값 검사: 음수나 틀린 값은 null', () => {
    expect(cleanDailyMoney(3000)).toBe(3000)
    expect(cleanDailyMoney(-1)).toBe(null)
    expect(cleanDailyMoney('x')).toBe(null)
    expect(cleanDailyMoney(undefined)).toBe(null)
  })
})
