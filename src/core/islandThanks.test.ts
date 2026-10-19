import { describe, expect, it } from 'vitest'
import { GIFT_PROJECTS_2 } from './islandGift'
import { islandThanksLetter } from './letters'
import { VILLAGERS } from './villagers'

const D = '2026-10-20'

describe('섬 가꾸기 2차 — 시설 감사 편지', () => {
  it('시설마다 편지가 한 통씩 오고, 편지 id 가 시설 id 라 겹치지 않는다', () => {
    const letters = GIFT_PROJECTS_2.map((p) => islandThanksLetter(D, p))
    expect(letters.every((l) => l !== null)).toBe(true)
    const ids = letters.map((l) => l!.id)
    expect(new Set(ids).size).toBe(GIFT_PROJECTS_2.length)
    expect(ids).toEqual(GIFT_PROJECTS_2.map((p) => `island-thanks-${p.id}`))
  })

  it('시설마다 다른 주민이 쓰고, 그 주민은 섬에 사는 이웃이다', () => {
    const letters = GIFT_PROJECTS_2.map((p) => islandThanksLetter(D, p)!)
    const froms = letters.map((l) => l.from)
    expect(new Set(froms).size).toBe(froms.length)
    for (const l of letters) {
      const v = VILLAGERS.find((x) => x.id === l.from)
      expect(v).toBeDefined()
      expect(v?.guest).toBeFalsy()
      expect(l.fromName).toBe(v?.name)
    }
  })

  it('문장은 주민 말투로 쓰고, 말끝 버릇을 붙이며, 시설 이름에 맞는 조사를 쓴다', () => {
    const letters = GIFT_PROJECTS_2.map((p) => islandThanksLetter(D, p)!)
    expect(letters[0].text).toMatch(/^등대 산책로 가로등이 켜져서/)
    expect(letters[1].text).toMatch(/^해변 파라솔이 생겨서/)
    expect(letters[2].text).toMatch(/^서쪽 언덕 전망 정자가 생겨서/)
    expect(letters[3].text).toMatch(/^광장 시계탑이 생겨서/)
    for (const l of letters) {
      const v = VILLAGERS.find((x) => x.id === l.from)!
      expect(l.text).toContain(v.tic.trim())
      expect(l.text).toMatch(/고마워[.!]?$/)
      expect(l.text).not.toMatch(/요[.!]/)
    }
  })

  it('목록에 없는 시설 id 에는 편지를 만들지 않는다', () => {
    expect(islandThanksLetter(D, { id: 'nope', name: '없는 시설' })).toBeNull()
  })

  it('편지 날짜는 받은 날이고 선물은 붙이지 않는다', () => {
    const l = islandThanksLetter(D, GIFT_PROJECTS_2[0])!
    expect(l.day).toBe(D)
    expect(l.gift).toBeNull()
    expect(l.read).toBe(false)
    expect(l.claimed).toBe(false)
  })
})
