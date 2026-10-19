import { describe, expect, it } from 'vitest'
import { cleanStampCard, NEW_STAMP_CARD, STAMP_GOAL, STAMP_REWARD, stampLine, stampOn, withStampNote } from './stampCard'

describe('stampOn', () => {
  it('처음 산 날에 한 칸 찍는다', () => {
    const r = stampOn(null, '2026-10-19')
    expect(r).toEqual({ card: { n: 1, last: '2026-10-19', cards: 0 }, stamped: true, reward: 0 })
  })

  it('같은 날 여러 번 사도 한 칸만 찍는다', () => {
    const first = stampOn(null, '2026-10-19')
    const again = stampOn(first.card, '2026-10-19')
    expect(again.stamped).toBe(false)
    expect(again.card).toEqual(first.card)
    expect(again.reward).toBe(0)
  })

  it('목표 칸째에 보상을 주고 빈 카드로 바꾸며 완성 수를 올린다', () => {
    let card = NEW_STAMP_CARD
    for (let i = 0; i < STAMP_GOAL - 1; i++) card = stampOn(card, `2026-10-${String(i + 1).padStart(2, '0')}`).card
    expect(card.n).toBe(STAMP_GOAL - 1)
    const done = stampOn(card, '2026-10-20')
    expect(done.reward).toBe(STAMP_REWARD)
    expect(done.card).toEqual({ n: 0, last: '2026-10-20', cards: 1 })
  })

  it('완성한 뒤 다음 날 다시 한 칸부터 찍는다', () => {
    const done = { n: 0, last: '2026-10-20', cards: 1 }
    expect(stampOn(done, '2026-10-21').card).toEqual({ n: 1, last: '2026-10-21', cards: 1 })
  })
})

describe('stampLine', () => {
  it('찍은 날은 칸 수를, 완성한 날은 도토리 보상을 말한다', () => {
    expect(stampLine(stampOn({ n: 2, last: '2026-10-18', cards: 0 }, '2026-10-19'))).toBe('단골 스탬프를 찍었어요! 3/6')
    expect(stampLine(stampOn({ n: 5, last: null, cards: 0 }, '2026-10-19'))).toBe('단골 스탬프 6칸을 다 채워서 도토리 150개를 받았어요!')
  })

  it('찍지 않은 날은 빈 문자열이다', () => {
    expect(stampLine(stampOn({ n: 2, last: '2026-10-19', cards: 0 }, '2026-10-19'))).toBe('')
  })
})

describe('withStampNote', () => {
  it('찍은 날은 구매 문장 뒤에 한 줄로 잇고, 안 찍은 날은 구매 문장만 남긴다', () => {
    const bought = '작은 벽 선반을 샀어요! 주머니에서 눌러 섬에 놓아봐요'
    expect(withStampNote(bought, stampOn({ n: 1, last: '2026-10-18', cards: 0 }, '2026-10-19'))).toBe(`${bought} · 단골 스탬프를 찍었어요! 2/6`)
    expect(withStampNote(bought, stampOn({ n: 1, last: '2026-10-19', cards: 0 }, '2026-10-19'))).toBe(bought)
  })
})

describe('cleanStampCard', () => {
  it('정상 값은 그대로 두고 깨진 값은 null 로 본다', () => {
    expect(cleanStampCard({ n: 3, last: '2026-10-19', cards: 1 })).toEqual({ n: 3, last: '2026-10-19', cards: 1 })
    expect(cleanStampCard({ n: 3, last: null, cards: 0 })).toEqual({ n: 3, last: null, cards: 0 })
    expect(cleanStampCard(undefined)).toBeNull()
    expect(cleanStampCard({ n: 100, last: null, cards: 0 })).toBeNull()
    // 목표를 낮추기 전에 찍힌 칸(예: 8칸)은 그대로 받고, 다음 구매 때 완성한다
    expect(cleanStampCard({ n: 8, last: null, cards: 0 })).toEqual({ n: 8, last: null, cards: 0 })
    expect(cleanStampCard({ n: -1, last: null, cards: 0 })).toBeNull()
    expect(cleanStampCard({ n: 1.5, last: null, cards: 0 })).toBeNull()
    expect(cleanStampCard({ n: 1, last: 'yesterday', cards: 0 })).toBeNull()
    expect(cleanStampCard({ n: 1, last: null, cards: -2 })).toBeNull()
  })
})

describe('목표를 6칸으로 낮춘 뒤의 저장', () => {
  it('8칸 찍힌 카드는 다음 구매 때 완성해 보상을 준다', () => {
    const r = stampOn({ n: 8, last: '2026-10-18', cards: 0 }, '2026-10-19')
    expect(r.reward).toBe(STAMP_REWARD)
    expect(r.card).toEqual({ n: 0, last: '2026-10-19', cards: 1 })
  })
})
