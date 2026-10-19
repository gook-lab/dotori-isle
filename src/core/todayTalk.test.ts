import { describe, expect, it } from 'vitest'
import { broadcastQuote, todayTalk, type TodayInput } from './todayTalk'
import { NEW_SHOP } from './shopTiers'
import { songiMood } from './shopRoom'

const input = (over: Partial<TodayInput> = {}): TodayInput => ({ day: '2026-10-19', hour: 10, shop: NEW_SHOP, news: null, storyChapter: 0, storyDone: false, weekRecap: [], ...over })

/** 2026년 일요일 중 시세가 high 인 (날, 시) 을 찾는다. 시세는 날짜로 정해지니 결과가 늘 같다. */
function highSunday(): { day: string; hour: number } | null {
  for (let d = 0; d < 365; d++) {
    const dt = new Date(2026, 0, 1 + d)
    if (dt.getDay() !== 0) continue
    const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    for (let hour = 5; hour < 12; hour++) if (songiMood(day, hour) === 'high') return { day, hour }
  }
  return null
}

describe('today talk facts', () => {
  it('quotes one broadcast line without the emoji head and never the weather line', () => {
    const news = ['☀️ 오늘은 맑아요.', '🎂 오늘은 달이의 생일이에요.', '🧺 오늘은 장날이에요.']
    const q = broadcastQuote(news, '2026-10-19')
    expect(q).toBeDefined()
    expect(news.slice(1).map((l) => l.replace(/^\S+\s/, ''))).toContain(q)
    expect(broadcastQuote(['☀️ 오늘은 맑아요.'], '2026-10-19')).toBeUndefined()
  })

  it('keeps the same quote for the same day', () => {
    const news = ['☀️ 맑아요.', '🎂 생일이에요.', '🧺 장날이에요.', '🌠 별똥별이에요.']
    expect(broadcastQuote(news, '2026-10-19')).toBe(broadcastQuote(news, '2026-10-19'))
  })

  it('marks the shop closed while an upgrade is under way', () => {
    const t = todayTalk(input({ shop: { tier: 0, order: { day: '2026-10-18', to: 1 } } }))
    expect(t.shop?.closed).toBe(true)
  })

  it('shows the shop only when it has stock or is closed', () => {
    const t = todayTalk(input({ storyChapter: 5, storyDone: true }))
    expect(t.shop === undefined || t.shop.closed === false).toBe(true)
    expect(t.story).toBeUndefined()
  })

  it('names the current story chapter until the story ends', () => {
    const t = todayTalk(input({ storyChapter: 1 }))
    expect(t.story).toEqual({ no: 2, title: '이웃 맞이' })
    expect(t.storyDone).toBeUndefined()
  })

  it('marks the story done only after the epilogue, and then gives no chapter', () => {
    const t = todayTalk(input({ storyChapter: 5, storyDone: true }))
    expect(t.storyDone).toBe(true)
    expect(t.story).toBeUndefined()
  })

  it('leaves out songi outside the Sunday market and the bottle has no news', () => {
    const t = todayTalk(input())
    expect(t.songiHigh).toBeUndefined()
    expect(t.broadcast).toBeUndefined()
    expect(t.bottle).toBe(true)
  })

  it('quotes this week only on a Sunday that has a recap', () => {
    const recap = ['🐟 물고기 3마리를 낚았어요.', '🌰 도토리 900개를 벌었어요.']
    const sunday = todayTalk(input({ day: '2026-10-18', weekRecap: recap }))
    expect(recap.map((l) => l.replace(/^\S+\s/, ''))).toContain(sunday.weekQuote)
    expect(todayTalk(input({ day: '2026-10-19', weekRecap: recap })).weekQuote).toBeUndefined()
    expect(todayTalk(input({ day: '2026-10-18', weekRecap: [] })).weekQuote).toBeUndefined()
  })

  it('marks songi high only on a Sunday market hour when the mood is high', () => {
    const high = highSunday()
    expect(high).not.toBeNull()
    expect(todayTalk(input({ day: high!.day, hour: high!.hour })).songiHigh).toBe(true)
    // 같은 시각이라도 평일이면 시장이 열리지 않아 화제가 없다
    expect(todayTalk(input({ day: '2026-10-19', hour: high!.hour })).songiHigh).toBeUndefined()
  })
})
