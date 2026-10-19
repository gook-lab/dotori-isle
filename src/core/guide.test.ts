import { describe, expect, it } from 'vitest'
import { fruitTreesByDistance, pickUpHintOn, SHORE_QUEST, shakeHintOn, shoreDue } from './guide'
import type { TreeSpot } from './world'

const tree = (id: string, x: number, z: number, kind: 'fruit' | 'pine' = 'fruit'): TreeSpot => ({ id, kind, x, z, scale: 1 })

describe('첫 나무 흔들기 안내', () => {
  it('첫 퀘스트를 끝내기 전, 아직 흔들지 않았을 때만 켜진다', () => {
    expect(shakeHintOn({}, [])).toBe(true)
    expect(shakeHintOn({ shake: 1 }, [])).toBe(false)
    expect(shakeHintOn({}, ['welcome'])).toBe(false)
  })

  it('아직 흔들지 않은 열매나무를 가까운 순서로 주고, 소나무와 흔든 나무는 뺀다', () => {
    const trees = [tree('a', 0, 0), tree('b', 3, 0), tree('pine', 1, 0, 'pine')]
    expect(fruitTreesByDistance(trees, [], 2.5, 0).map((t) => t.id)).toEqual(['b', 'a'])
    expect(fruitTreesByDistance(trees, ['b'], 2.5, 0).map((t) => t.id)).toEqual(['a'])
    expect(fruitTreesByDistance(trees, ['a', 'b'], 0, 0)).toEqual([])
  })
})

describe('떨어진 열매 줍기 안내', () => {
  it('shows after the first shake while the pocket has no fruit', () => {
    expect(pickUpHintOn({ shake: 1 }, [], 0)).toBe(true)
  })

  it('hides once a fruit is in the pocket, after the welcome quest, or before any shake', () => {
    expect(pickUpHintOn({ shake: 1 }, [], 1)).toBe(false)
    expect(pickUpHintOn({ shake: 1 }, ['welcome'], 0)).toBe(false)
    expect(pickUpHintOn({}, [], 0)).toBe(false)
  })
})

describe('2일차 조개 부탁 넣기', () => {
  it('is due from the first day after the start, and then only once', () => {
    expect(shoreDue(0, [], [])).toBe(false)
    expect(shoreDue(1, [], [])).toBe(true)
    // 며칠 뒤에 들어와도 아직 없으면 넣는다(2일차에 놓쳐도 영영 빠지지 않는다)
    expect(shoreDue(4, [], [])).toBe(true)
    expect(shoreDue(4, [], [{ id: SHORE_QUEST }])).toBe(false)
    expect(shoreDue(4, [SHORE_QUEST], [])).toBe(false)
  })
})
