import { describe, expect, it } from 'vitest'
import { giftPoints } from './gifts'
import { toneOf, wearKind, wearReaction, wearTaste, wornLines, wornOutfit } from './villagerWear'

describe('옷 색 계열', () => {
  it('색을 따뜻함, 차가움, 싱그러움, 연함으로 나눈다', () => {
    expect(toneOf('#f5d25a')).toBe('warm') // 레몬
    expect(toneOf('#6aa9e9')).toBe('cool') // 하늘
    expect(toneOf('#7cc576')).toBe('fresh') // 새싹
    expect(toneOf('#f4f1ea')).toBe('pale') // 무지
  })

  it('수영복은 수영복 종류, 나머지는 셔츠다', () => {
    expect(wearKind('swim-suit')).toBe('swim')
    expect(wearKind('shirt-lemon')).toBe('shirt')
  })
})

describe('주민 입맛과 옷', () => {
  it('색과 종류가 다 맞으면 love, 한쪽만 맞으면 like, 맞는 게 없으면 neutral', () => {
    expect(wearTaste({ tone: 'warm', kind: 'shirt' }, 'shirt-lemon')).toBe('love')
    expect(wearTaste({ tone: 'warm', kind: 'swim' }, 'shirt-lemon')).toBe('like')
    expect(wearTaste({ tone: 'cool' }, 'shirt-lemon')).toBe('neutral')
    expect(wearTaste({ tone: 'warm' }, 'shirt-lemon')).toBe('love')
    expect(wearTaste(undefined, 'shirt-lemon')).toBe('neutral')
  })

  it('좋아하는 옷을 주면 점수가 많이 오르고 대사도 바뀐다', () => {
    const v = { name: '코코', tic: ' 훗', wearTaste: { kind: 'swim' as const } }
    const love = wearReaction(v, 'swim-suit')
    const neutral = wearReaction(v, 'shirt-lemon')
    expect(love.taste).toBe('love')
    expect(love.points).toBe(giftPoints('love', false))
    expect(neutral.points).toBeGreaterThan(0)
    expect(love.lines[0]).not.toBe(neutral.lines[0])
  })

  it('옷은 선물한 날의 다음 날부터 입는다', () => {
    const gift = { outfit: 'shirt-berry', day: '2026-03-16' }
    expect(wornOutfit(gift, '2026-03-16')).toBeNull()
    expect(wornOutfit(gift, '2026-03-17')).toBe('shirt-berry')
    expect(wornOutfit(undefined, '2026-03-17')).toBeNull()
  })

  it('옷을 입은 주민은 취향별로 두세 줄을 건넨다', () => {
    const v = { name: '모카', tic: '냥' }
    for (const t of ['love', 'like', 'neutral'] as const) {
      const lines = wornLines(v, 'shirt-berry', t)
      expect(lines.length).toBeGreaterThanOrEqual(2)
      expect(lines.length).toBeLessThanOrEqual(3)
    }
  })
})
