import { describe, expect, it } from 'vitest'
import { cardNumberLine, NEW_STAMP_CARD, STAMP_GOAL, stampedOn, stampHint, stampOn } from './stampCard'

const DAY = '2026-10-19'

describe('단골 스탬프 카드 안내', () => {
  it('처음 카드는 찍은 칸이 없고 "오늘 처음 사면 한 칸 찍어요"라고 안내한다', () => {
    expect(stampedOn(NEW_STAMP_CARD, DAY)).toBe(false)
    expect(stampHint(NEW_STAMP_CARD, DAY)).toBe('오늘 처음 사면 한 칸 찍어요')
  })

  it('오늘 찍었으면 "오늘 도장 찍었어요"라고 한다', () => {
    const card = stampOn(NEW_STAMP_CARD, DAY).card
    expect(stampedOn(card, DAY)).toBe(true)
    expect(stampHint(card, DAY)).toBe('오늘 도장 찍었어요')
  })

  it('다음 날이 되면 다시 찍을 수 있다는 안내로 바뀐다', () => {
    const card = stampOn(NEW_STAMP_CARD, DAY).card
    expect(stampHint(card, '2026-10-20')).toBe('오늘 처음 사면 한 칸 찍어요')
  })

  it('카드 번호는 첫 카드에서는 없고, 완성한 뒤부터 N번째 카드로 말한다', () => {
    expect(cardNumberLine(0)).toBe(null)
    expect(cardNumberLine(1)).toBe('2번째 카드')
    expect(cardNumberLine(4)).toBe('5번째 카드')
  })

  it('여섯 칸이 목표이고, 카드가 없으면 빈 카드로 본다', () => {
    expect(STAMP_GOAL).toBe(6)
    expect(stampHint(null, DAY)).toBe('오늘 처음 사면 한 칸 찍어요')
  })
})
