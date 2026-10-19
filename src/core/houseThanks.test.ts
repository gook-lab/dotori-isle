import { describe, expect, it } from 'vitest'
import { cleanHouseThanks } from './houseExpand'
import { houseThanksLetter } from './letters'
import { VILLAGERS } from './villagers'

const D = '2026-11-01'

describe('주민 집 증축 감사 편지', () => {
  it('주민 본인이 보내고, 편지 id 는 주민 id 로 정해진다', () => {
    const l = houseThanksLetter(D, 'mocha')!
    expect(l.id).toBe('house-thanks-mocha')
    expect(l.from).toBe('mocha')
    expect(l.fromName).toBe(VILLAGERS.find((v) => v.id === 'mocha')!.name)
    expect(l.day).toBe(D)
    expect(l.gift).toBeNull()
  })

  it('반말에 주민 말끝 버릇을 붙인다', () => {
    const v = VILLAGERS.find((x) => x.id === 'mocha')!
    const l = houseThanksLetter(D, 'mocha')!
    expect(l.text).toContain(v.tic.trim())
    expect(l.text).toMatch(/고마워!/)
    expect(l.text).not.toMatch(/요[.!]/)
  })

  it('모르는 주민이면 편지를 만들지 않는다', () => {
    expect(houseThanksLetter(D, 'nobody')).toBeNull()
  })

  it('저장 기록은 주민 id 와 날짜가 맞을 때만 읽는다', () => {
    expect(cleanHouseThanks({ id: 'mocha', day: D })).toEqual({ id: 'mocha', day: D })
    expect(cleanHouseThanks({ id: 'nobody', day: D })).toBeNull()
    expect(cleanHouseThanks({ id: 'mocha', day: 'bad' })).toBeNull()
    expect(cleanHouseThanks(null)).toBeNull()
  })
})
