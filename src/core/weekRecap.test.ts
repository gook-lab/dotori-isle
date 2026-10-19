import { describe, expect, it } from 'vitest'
import { cleanWeekMark, nextMark, QUIET_LINE, RECAP_MAX, recapLines, snapshotOf, type WeekSnapshot } from './weekRecap'

const zero: WeekSnapshot = snapshotOf({}, 0, 0)
const after = (stats: Record<string, number>, tier = 0, houses = 0): WeekSnapshot => snapshotOf(stats, tier, houses)

describe('weekly recap lines', () => {
  it('says it was a quiet week when nothing changed', () => {
    expect(recapLines(zero, zero)).toEqual([QUIET_LINE])
    expect(recapLines(after({ fish: 4 }), after({ fish: 4 }))).toEqual([QUIET_LINE])
  })

  it('counts only the difference from the base, never negative', () => {
    const base = after({ fish: 10, earn: 500 })
    const now = after({ fish: 13, earn: 500 })
    expect(recapLines(now, base)).toEqual(['🐟 물고기 3마리를 낚았어요.'])
    expect(recapLines(after({ fish: 2 }), base)).toEqual([QUIET_LINE])
  })

  it('summarizes fish, bugs, acorns, shop, homes, newcomers, bottle letters, and chores', () => {
    const base = after({}, 1, 2)
    const now = after({ fish: 5, bug: 2, earn: 1200, build: 1, letter: 2, chop: 3, shake: 4 }, 2, 4)
    const lines = recapLines(now, base)
    expect(lines).toEqual(['🐟 물고기 5마리를 낚았어요.', '🦋 벌레 2마리를 잡았어요.', '🌰 도토리 1,200개를 벌었어요.', '🏗️ 도토리 상점을 1단계 키웠어요.'])
  })

  it('keeps the summary to the first four lines, in order of importance', () => {
    const lines = recapLines(after({ fish: 1, bug: 1, earn: 1, build: 1, letter: 1, chop: 1 }, 1, 1), zero)
    expect(lines.length).toBe(RECAP_MAX)
    expect(lines[0]).toContain('물고기')
    expect(lines.join(' ')).not.toContain('병 편지')
  })
})

describe('weekly recap mark', () => {
  it('keeps only the recap stats and the day and recap lines', () => {
    const mark = nextMark(after({ fish: 3, secret: 9 }, 1, 2), '2026-10-18', ['🐟 물고기 3마리를 낚았어요.'])
    const back = cleanWeekMark(JSON.parse(JSON.stringify(mark)))
    expect(back).toEqual(mark)
    expect(back!.stats.secret).toBeUndefined()
  })

  it('drops a save that has no valid day, tier, or houses', () => {
    expect(cleanWeekMark(null)).toBeNull()
    expect(cleanWeekMark({ day: 'not-a-day', stats: {}, tier: 0, houses: 0 })).toBeNull()
    expect(cleanWeekMark({ day: '2026-10-18', stats: {}, tier: 9, houses: 0 })).toBeNull()
    expect(cleanWeekMark({ day: '2026-10-18', stats: {}, tier: 0, houses: -1 })).toBeNull()
  })

  it('turns bad stat values into zero and trims a bad recap list', () => {
    const m = cleanWeekMark({ day: '2026-10-18', stats: { fish: -2, bug: 'x', earn: 7 }, tier: 0, houses: 1, recap: ['ok', 3, 'x'.repeat(200)] })
    expect(m!.stats.fish).toBe(0)
    expect(m!.stats.bug).toBe(0)
    expect(m!.stats.earn).toBe(7)
    expect(m!.recap).toEqual(['ok'])
  })

  it('이번 주 섬 이야기 목표 축하 줄은 요약 맨 앞에 붙는다', () => {
    expect(recapLines(zero, zero, ['🎯 도감 50종 목표를 채웠어요'])).toEqual(['🎯 도감 50종 목표를 채웠어요'])
    expect(recapLines(after({ fish: 3 }), after({ fish: 0 }), ['🎯 도감 50종 목표를 채웠어요'])).toEqual(['🎯 도감 50종 목표를 채웠어요', '🐟 물고기 3마리를 낚았어요.'])
  })
})
