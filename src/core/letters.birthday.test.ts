import { describe, expect, it } from 'vitest'
import { birthdayLetter, birthdayThanksLetter, letterTextOn } from './letters'

const v = { id: 'maro', name: '마로', tic: ' 후아' }

describe('지난 생일 초대 본문', () => {
  it('keeps the invite on its own birthday', () => {
    const l = birthdayLetter('2026-11-11', v)
    expect(letterTextOn(l, '2026-11-11')).toBe(l.text)
  })

  it('turns an old invite into a past-tense line when the day has moved on', () => {
    const l = birthdayLetter('2026-11-11', v)
    expect(letterTextOn(l, '2026-11-12')).toBe('마로의 생일은 11월 11일이었어요')
  })

  it('leaves the saved text alone, so the same letter can still be read as written', () => {
    const l = birthdayLetter('2026-11-11', v)
    letterTextOn(l, '2026-12-01')
    expect(l.text).toContain('오늘은 내 생일이야')
  })

  it('never rewrites the thank-you letter or an ordinary letter', () => {
    const thanks = birthdayThanksLetter('2026-11-12', v, null)
    expect(letterTextOn(thanks, '2026-11-20')).toBe(thanks.text)
    const other = { ...birthdayLetter('2026-11-11', v), id: 'morning-2026-11-11-maro' }
    expect(letterTextOn(other, '2026-11-20')).toBe(other.text)
  })
})
