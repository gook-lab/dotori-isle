import { describe, expect, it } from 'vitest'
import { josa } from './items'
import { morningNews, type NewsInput } from './morningNews'
import { stampLine, stampOn } from './stampCard'

const base: NewsInput = {
  weather: 'sunny',
  tomorrow: 'sunny',
  rainbow: false,
  meteor: false,
  festival: null,
  market: false,
  marketTomorrow: false,
  tourney: false,
  visitor: null,
  birthdays: [],
  flashSale: null,
  sales: [],
  monthly: null,
  loan: 0,
}

describe('josa 조사 고르기', () => {
  it('받침 유무로 을/를, 이/가 를 고른다', () => {
    expect(josa('독서 의자', '을', '를')).toBe('독서 의자를')
    expect(josa('머그컵', '을', '를')).toBe('머그컵을')
    expect(josa('모카', '이', '가')).toBe('모카가')
    expect(josa('도토리', '이', '가')).toBe('도토리가')
    // 대화창 제목: 받침 있는 주민(참붕)은 과, 없는 주민(봄이)은 와
    expect(`${josa('참붕', '과', '와')} 대화`).toBe('참붕과 대화')
    expect(`${josa('봄이', '과', '와')} 대화`).toBe('봄이와 대화')
  })

  it('특가 줄은 받침 있는 이름에도 없는 이름에도 맞는 조사를 쓴다', () => {
    expect(morningNews({ ...base, sales: ['독서 의자'] })).toContain('🏷️ 상점에 특가가 있어요. 독서 의자를 싸게 팔아요.')
    expect(morningNews({ ...base, sales: ['머그컵', '독서 의자'] })).toContain('🏷️ 상점에 특가가 있어요. 머그컵, 독서 의자를 싸게 팔아요.')
  })

  it('단골 스탬프 안내에 숫자 뒤 조사가 붙지 않는다', () => {
    expect(stampLine(stampOn({ n: 2, last: '2026-10-18', cards: 0 }, '2026-10-19'))).toBe('단골 스탬프를 찍었어요! 3/6')
  })
})
