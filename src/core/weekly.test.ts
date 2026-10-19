import { describe, expect, it } from 'vitest'
import { cleanWeekly, newWeekly, weeklyLeft, weeklyOpen, weeklyPicks, weeklyView, WEEKLY_COUNT, WEEKLY_POOL, type WeeklyState } from './weekly'
import { dailyQuests } from './quests'

const WEEK = '2026-10-19'

describe('이번 주 목표 뽑기', () => {
  it('한 주에 세 개이고, 같은 주에는 늘 같다', () => {
    expect(weeklyPicks(WEEK)).toHaveLength(WEEKLY_COUNT)
    expect(weeklyPicks(WEEK)).toEqual(weeklyPicks(WEEK))
  })

  it('셋은 서로 다른 통계다', () => {
    const stats = weeklyPicks(WEEK).map((p) => p.stat)
    expect(new Set(stats).size).toBe(WEEKLY_COUNT)
  })

  it('주가 바뀌면 목표가 달라질 수 있다(여러 주를 보면 적어도 두 가지가 나온다)', () => {
    const sets = new Set(Array.from({ length: 12 }, (_, i) => weeklyPicks(`2026-10-${String(5 + i * 7).padStart(2, '0')}`).map((p) => p.stat).join(',')))
    expect(sets.size).toBeGreaterThan(1)
  })

  it('오늘의 할 일과 같은 통계는 목표 수치를 세 배 이상으로 잡는다', () => {
    const daily = dailyQuests(WEEK).flatMap((q) => q.goals.map((g) => ({ stat: g.stat, target: g.target })))
    for (const w of WEEKLY_POOL) {
      const d = daily.find((x) => x.stat === w.stat)
      if (d) expect(w.target).toBeGreaterThanOrEqual(d.target * 3)
    }
  })
})

describe('이번 주 진행', () => {
  it('주 시작 뒤 늘어난 양만 세고, 목표에서 멈춘다', () => {
    const picks = weeklyPicks(WEEK)
    const st = newWeekly(WEEK, { [picks[0].stat]: 100 })
    const v = weeklyView(st, WEEK, { [picks[0].stat]: 104 })
    expect(v.rows[0].current).toBe(4)
    const over = weeklyView(st, WEEK, { [picks[0].stat]: 100 + picks[0].target + 9 })
    expect(over.rows[0].current).toBe(picks[0].target)
    expect(over.rows[0].done).toBe(true)
  })

  it('저장된 주가 오늘의 주와 다르면 진행은 0이고, 남은 목표는 셋이다', () => {
    const old: WeeklyState = { week: '2026-10-12', base: {}, got: [], bonus: false }
    expect(weeklyLeft(old, WEEK, {})).toBe(WEEKLY_COUNT)
    expect(weeklyLeft(null, WEEK, {})).toBe(WEEKLY_COUNT)
  })

  it('남은 목표 수는 채운 만큼 줄어든다', () => {
    const picks = weeklyPicks(WEEK)
    const st = newWeekly(WEEK, {})
    const stats = { [picks[0].stat]: picks[0].target }
    expect(weeklyLeft(st, WEEK, stats)).toBe(WEEKLY_COUNT - 1)
  })
})

describe('저장 값 검증', () => {
  it('맞는 주간 상태는 그대로 읽는다', () => {
    const st = newWeekly(WEEK, {})
    expect(cleanWeekly(st)).toEqual(st)
  })

  it('월요일이 아니거나 모르는 통계가 있으면 버린다', () => {
    expect(cleanWeekly({ week: '2026-10-21', base: {}, got: [], bonus: false })).toBeNull()
    expect(cleanWeekly({ week: WEEK, base: { wood: 1 }, got: [], bonus: false })).toBeNull()
    expect(cleanWeekly({ week: WEEK, base: {}, got: ['bug'], bonus: false })).toBeNull()
    expect(cleanWeekly(null)).toBeNull()
  })
})

describe('시작 조건', () => {
  it('섬 이야기 5장을 마치기 전에는 열리지 않고, 5장을 마치면 열린다', () => {
    expect(weeklyOpen(4)).toBe(false)
    expect(weeklyOpen(5)).toBe(true)
  })
})
