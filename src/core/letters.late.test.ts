import { describe, expect, it } from 'vitest'
import { lateGiftLetters, lateWindow, wishLetter, type Letter } from './letters'

const gifted: Letter = { id: 'letter-2026-10-18', from: 'bomi', fromName: '봄이', day: '2026-10-18', text: '좋은 아침!', gift: 'peach', read: false, claimed: false }
const plain: Letter = { ...gifted, id: 'letter-2026-10-17', gift: null }

describe('어제 놓친 선물 편지 늦게 받기', () => {
  it('sends a missed gift letter once, dated today, with the gift kept', () => {
    const late = lateGiftLetters('2026-10-19', [gifted], [])
    expect(late).toHaveLength(1)
    expect(late[0]).toMatchObject({ id: 'late-letter-2026-10-18', day: '2026-10-19', gift: 'peach', claimed: false })
    expect(late[0].text.startsWith('📮 어제 못 받은 편지예요.')).toBe(true)
  })

  it('leaves letters without a gift alone', () => {
    expect(lateGiftLetters('2026-10-19', [plain], [])).toEqual([])
  })

  it('does not resend a letter that was already received or already sent late', () => {
    expect(lateGiftLetters('2026-10-19', [gifted], ['letter-2026-10-18'])).toEqual([])
    expect(lateGiftLetters('2026-10-19', [gifted], ['late-letter-2026-10-18'])).toEqual([])
  })

  it('ignores missing candidates and keeps a wish letter late too', () => {
    const wish = wishLetter('2026-10-18', '2026-10-17')
    const late = lateGiftLetters('2026-10-19', [null, wish, null], [])
    expect(late.map((l) => l.id)).toEqual(['late-wish-2026-10-17'])
    expect(late[0].gift).toBe('flower-seed')
  })
})

describe('늦게 받기가 끼어드는 기간', () => {
  const idx = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86400000
  }
  it('only looks back when the last visit was 2 to 7 days before today', () => {
    expect(lateWindow('2026-10-17', '2026-10-19', idx)).toBe(true)
    expect(lateWindow('2026-10-12', '2026-10-19', idx)).toBe(true)
    // 어제 연 날이면 놓친 것이 없고, 일주일이 넘게 떨어졌으면 하루치만 주는 규칙에서 벗어난다
    expect(lateWindow('2026-10-18', '2026-10-19', idx)).toBe(false)
    expect(lateWindow('2000-01-01', '2026-10-19', idx)).toBe(false)
    expect(lateWindow('2026-10-19', '2026-10-19', idx)).toBe(false)
  })
})
