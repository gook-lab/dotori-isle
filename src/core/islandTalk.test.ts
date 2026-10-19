import { describe, expect, it } from 'vitest'
import type { Personality } from './chat'
import { islandTalkLine, porchTalkLine, type IslandFlavor } from './islandTalk'

const FLAVORS: IslandFlavor[] = ['wallpaper', 'set', 'pebble', 'ledger', 'stairs', 'facility']
const PERSONS: Personality[] = ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy']

describe('새 섬 요소 주민 한 줄', () => {
  for (const f of FLAVORS) {
    it(`${f}: 성격마다 한 줄씩 있고 줄바꿈이 없다`, () => {
      for (const p of PERSONS) {
        const line = islandTalkLine(f, p)
        expect(line.length).toBeGreaterThan(0)
        expect(line).not.toContain('\n')
      }
    })

    it(`${f}: 성격끼리 같은 말을 쓰지 않는다`, () => {
      const lines = PERSONS.map((p) => islandTalkLine(f, p))
      expect(new Set(lines).size).toBe(lines.length)
    })
  }

  it('요소끼리도 같은 줄이 없다', () => {
    const all = FLAVORS.flatMap((f) => PERSONS.map((p) => islandTalkLine(f, p)))
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('증축된 이웃 집 포치 주민 한 줄', () => {
  it('성격마다 한 줄씩 있고 서로 다르다', () => {
    const lines = PERSONS.map((p) => porchTalkLine('모카', p))
    for (const l of lines) expect(l.length).toBeGreaterThan(0)
    expect(new Set(lines).size).toBe(lines.length)
  })

  it('집 주인 이름에 받침에 맞는 조사를 붙인다', () => {
    expect(porchTalkLine('모카', 'cheery')).toMatch(/^모카가 집 현관/)
    expect(porchTalkLine('동그리', 'cheery')).toMatch(/^동그리가 집 현관/)
    expect(porchTalkLine('구리구리', 'cheery')).toMatch(/^구리구리가 집 현관/)
  })
})
