import { describe, expect, it } from 'vitest'
import { morningNews, NEWS_MAX_LINES, type NewsInput } from './morningNews'

const quiet: NewsInput = {
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

describe('아침 섬 소식', () => {
  it('생일 줄은 이름 뒤에 의를 붙인다', () => {
    expect(morningNews({ ...quiet, birthdays: ['모카', '펠리'] }).some((l) => l.includes('모카, 펠리의 생일이에요'))).toBe(true)
  })

  it('아무 일도 없으면 날씨 한 줄만 있다', () => {
    const lines = morningNews(quiet)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('맑아요')
  })

  it('내일 날씨가 다르면 내일 예보를 함께 말한다', () => {
    const lines = morningNews({ ...quiet, tomorrow: 'rain' })
    expect(lines[0]).toContain('내일은 비가 와요')
  })

  it('최대 네 줄이고, 날씨가 맨 앞이다', () => {
    const lines = morningNews({
      ...quiet,
      festival: '꽃 축제',
      birthdays: ['모카'],
      visitor: '펠리',
      flashSale: '의자',
      monthly: '화분',
      loan: 500,
    })
    expect(lines).toHaveLength(NEWS_MAX_LINES)
    expect(lines[0]).toContain('오늘은')
    // 대출은 우선순위가 가장 낮아 네 줄에 못 든다
    expect(lines.some((l) => l.includes('대출'))).toBe(false)
  })

  it('행사는 한 줄만 고르고 축제가 장날보다 앞선다', () => {
    const lines = morningNews({ ...quiet, festival: '꽃 축제', market: true, tourney: true, meteor: true })
    const events = lines.filter((l) => l.includes('축제') || l.includes('장날') || l.includes('낚시 대회') || l.includes('별똥별'))
    expect(events).toHaveLength(1)
    expect(events[0]).toContain('꽃 축제')
  })

  it('행사가 없으면 낚시 대회, 장날, 별똥별, 무지개 가능성 순으로 고른다', () => {
    expect(morningNews({ ...quiet, tourney: true, market: true })[1]).toContain('낚시 대회')
    expect(morningNews({ ...quiet, market: true, meteor: true })[1]).toContain('장날')
    expect(morningNews({ ...quiet, meteor: true, rainbow: true })[1]).toContain('별똥별')
    expect(morningNews({ ...quiet, rainbow: true })[1]).toContain('무지개가 뜰지도')
  })

  it('없는 항목은 줄로 나오지 않는다', () => {
    const lines = morningNews({ ...quiet, birthdays: [], visitor: null, flashSale: null, sales: [], monthly: null, loan: 0 })
    expect(lines.join(' ')).not.toMatch(/생일|놀러|특가|이달의|대출/)
  })

  it('대출이 있을 때만 잔액 한 줄을 준다', () => {
    const lines = morningNews({ ...quiet, loan: 2500 })
    expect(lines.some((l) => l.includes('대출 도토리 2,500개'))).toBe(true)
  })

  it('특가는 반짝 특가가 보통 특가보다 앞선다', () => {
    const lines = morningNews({ ...quiet, flashSale: '의자', sales: ['화분'] })
    expect(lines.some((l) => l.includes('반짝 특가') && l.includes('의자를 반값'))).toBe(true)
    expect(lines.some((l) => l.includes('화분'))).toBe(false)
  })

  it('조사를 받침에 맞춘다', () => {
    const lines = morningNews({ ...quiet, visitor: '펠리', monthly: '의자' })
    expect(lines.some((l) => l.includes('🚪 오늘 펠리가 집에'))).toBe(true)
    expect(lines.some((l) => l.includes('🛍️ 이달의 가구 의자가 들어왔어요'))).toBe(true)
  })
})
