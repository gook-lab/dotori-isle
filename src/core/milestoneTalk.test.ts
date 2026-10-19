import { describe, expect, it } from 'vitest'
import { milestoneOf, milestoneTalkLines, MILESTONE_LINES, type Milestone, type MilestoneInput } from './milestoneTalk'
import { PERSONALITY } from './chat'
import { todayTalk, type TodayInput } from './todayTalk'
import { NEW_SHOP } from './shopTiers'

const BASE: MilestoneInput = {
  day: '2026-10-19',
  yesterday: '2026-10-18',
  shopUpDay: null,
  loanPaidToday: false,
  homeDoneDay: null,
  giftDoneDay: null,
  giftOpen: true,
}
const on = (over: Partial<MilestoneInput>) => milestoneOf({ ...BASE, ...over })

describe('경제 이정표 — 고르기', () => {
  it('평범한 날에는 이정표가 없다', () => {
    expect(on({})).toBeNull()
  })

  it('이정표 하나마다 맞는 종류가 나온다', () => {
    expect(on({ shopUpDay: BASE.day })).toBe('shop-up')
    expect(on({ loanPaidToday: true })).toBe('loan-paid')
    expect(on({ homeDoneDay: BASE.yesterday })).toBe('room-done')
    expect(on({ giftDoneDay: BASE.day })).toBe('gift-built')
    expect(on({ day: '2026-12-03', yesterday: '2026-12-02' })).toBe('warm-week')
    expect(on({ day: '2026-04-03', yesterday: '2026-04-02' })).toBe('flower-week')
  })

  it('증축은 완성된 날이 아니라 다음 날에만 말한다', () => {
    expect(on({ homeDoneDay: BASE.day })).toBeNull()
    expect(on({ homeDoneDay: '2026-10-17' })).toBeNull()
  })

  it('섬 가꾸기가 다 끝났으면 따뜻한 모금 주간도 말하지 않는다', () => {
    expect(on({ day: '2026-12-03', yesterday: '2026-12-02', giftOpen: false })).toBeNull()
  })

  it('겹치면 상점 올림이 가장 먼저, 계절 주간이 가장 나중이다', () => {
    const cases: [Partial<MilestoneInput>, Milestone][] = [
      [{ shopUpDay: BASE.day, loanPaidToday: true, giftDoneDay: BASE.day }, 'shop-up'],
      [{ loanPaidToday: true, homeDoneDay: BASE.yesterday }, 'loan-paid'],
      [{ homeDoneDay: BASE.yesterday, giftDoneDay: BASE.day }, 'room-done'],
    ]
    for (const [over, kind] of cases) expect(on(over)).toBe(kind)
    expect(on({ day: '2026-04-03', yesterday: '2026-04-02', giftDoneDay: '2026-04-03' })).toBe('gift-built')
  })
})

describe('경제 이정표 — 대사', () => {
  const KINDS = Object.keys(MILESTONE_LINES) as Milestone[]
  const PERS = ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy'] as const

  it('모든 이정표마다 모든 성격이 한 줄씩 가진다(두 줄 중 하나를 고른다)', () => {
    for (const k of KINDS) {
      for (const p of PERS) {
        const pair = MILESTONE_LINES[k][p]
        expect(pair).toHaveLength(2)
        expect(pair.every((l) => l.trim().length > 0)).toBe(true)
      }
    }
  })

  it('같은 날 같은 주민에게는 같은 줄이 나오고, 주민마다 다를 수 있다', () => {
    const a = milestoneTalkLines('shop-up', 'cheery', BASE.day, 'bomi')
    expect(a).toEqual(milestoneTalkLines('shop-up', 'cheery', BASE.day, 'bomi'))
    expect(a).toHaveLength(1)
    expect(MILESTONE_LINES['shop-up'].cheery).toContain(a[0])
  })

  it('성격 목록은 채팅의 성격과 맞는다', () => {
    const used = new Set(Object.values(PERSONALITY))
    for (const p of PERS) expect(used.has(p)).toBe(true)
  })
})

describe('경제 이정표 — 화제 연결', () => {
  const talk = (over: Partial<TodayInput>) =>
    todayTalk({
      day: BASE.day,
      hour: 10,
      shop: NEW_SHOP,
      news: null,
      storyChapter: 0,
      storyDone: false,
      weekRecap: [],
      ...over,
    })

  it('이정표가 있으면 오늘 소식에 종류와 날짜가 붙는다', () => {
    const t = talk({ milestone: { ...BASE, loanPaidToday: true } })
    expect(t.milestone).toEqual({ kind: 'loan-paid', day: BASE.day })
  })

  it('이정표 입력이 없거나 평범한 날에는 화제가 없다', () => {
    expect(talk({}).milestone).toBeUndefined()
    expect(talk({ milestone: BASE }).milestone).toBeUndefined()
  })
})
