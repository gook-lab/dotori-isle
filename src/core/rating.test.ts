import { describe, expect, it } from 'vitest'
import { firstNewRecipe, islandRating, nextRewarded, ratingInputOf, ratingParts, ratingRewards, ratingTip, starsOf, islandScore, type RatingInput } from './rating'
import { STARTER_RECIPES } from './recipes'

const EMPTY: RatingInput = { placed: 0, variety: 0, planted: 0, watered: 0, standing: 0, totalTrees: 0, holes: 0, litter: 0, houses: 0, shopTier: 0, museum: 0 }
const FULL: RatingInput = { placed: 50, variety: 20, planted: 30, watered: 30, standing: 100, totalTrees: 100, holes: 0, litter: 0, houses: 5, shopTier: 2, museum: 10 }

describe('island score parts', () => {
  it('an empty island only gets the tidy base', () => {
    expect(ratingParts(EMPTY)).toEqual({ decor: 0, flowers: 0, trees: 0, tidy: 10, neighbours: 0, shop: 0, museum: 0 })
    expect(islandScore(EMPTY)).toBe(10)
  })

  it('painted paths add a tidy bonus that stops at the cap', () => {
    expect(ratingParts({ ...EMPTY, paths: 3 }).tidy).toBe(11)
    expect(ratingParts({ ...EMPTY, paths: 2 }).tidy).toBe(10)
    expect(ratingParts({ ...EMPTY, paths: 99 }).tidy).toBe(15)
  })

  it('a full island reaches exactly 100 points and five stars', () => {
    expect(islandScore(FULL)).toBe(100)
    expect(islandRating(FULL)).toEqual({ score: 100, stars: 5 })
  })

  it('furniture count and variety are capped separately', () => {
    expect(ratingParts({ ...EMPTY, placed: 50, variety: 0 }).decor).toBe(12)
    expect(ratingParts({ ...EMPTY, placed: 0, variety: 50 }).decor).toBe(8)
  })

  it('watering counts only up to five flowers on top of planting', () => {
    expect(ratingParts({ ...EMPTY, planted: 4, watered: 4 }).flowers).toBe(8)
    expect(ratingParts({ ...EMPTY, planted: 20, watered: 20 }).flowers).toBe(15)
  })

  it('over-felling costs extra below 70% standing trees', () => {
    expect(ratingParts({ ...EMPTY, standing: 100, totalTrees: 100 }).trees).toBe(15)
    // 절반만 남으면 비율대로 8점에서 과벌목 벌점 4점을 뺀다
    expect(ratingParts({ ...EMPTY, standing: 50, totalTrees: 100 }).trees).toBe(4)
    expect(ratingParts({ ...EMPTY, standing: 0, totalTrees: 100 }).trees).toBe(0)
  })

  it('open holes and litter lower the tidy score and never go below zero', () => {
    expect(ratingParts({ ...EMPTY, holes: 2 }).tidy).toBe(6)
    expect(ratingParts({ ...EMPTY, litter: 3 }).tidy).toBe(4)
    expect(ratingParts({ ...EMPTY, holes: 30, litter: 30 }).tidy).toBe(0)
  })

  it('neighbours and shop tier each have a cap', () => {
    expect(ratingParts({ ...EMPTY, houses: 9 }).neighbours).toBe(25)
    expect(ratingParts({ ...EMPTY, shopTier: 2 }).shop).toBe(10)
    expect(ratingParts({ ...EMPTY, museum: 40 }).museum).toBe(5)
  })
})

describe('stars', () => {
  it('maps score bands to one to five stars', () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(starsOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })
})

describe('tip selection', () => {
  it('gives no tip at five stars', () => {
    expect(ratingTip(FULL)).toBeNull()
  })

  it('picks the cheapest single step that raises the stars', () => {
    // 빈 섬은 10점. 가구 3종(개수 3·종류 3)이면 decor 12점으로 22점이라 20점에 닿는다. 꽃은 10송이가 필요해서 가구가 이긴다.
    expect(ratingTip(EMPTY)).toEqual({ text: '가구를 3개 더 놓으면 별이 하나 늘어요', units: 3 })
  })

  it('suggests one more neighbour when furniture is already maxed and that is the cheapest step', () => {
    const i = { ...EMPTY, placed: 6, variety: 4, houses: 1, shopTier: 0 } // 꾸밈 20 + 이웃 5 + 정돈 10 = 35점(2★)
    expect(islandScore(i)).toBe(35)
    expect(starsOf(islandScore(i))).toBe(2)
    expect(ratingTip(i)).toEqual({ text: '이웃이 한 명 더 이사 오면 별이 하나 늘어요', units: 1 })
  })

  it('when one step cannot reach the next star, it names the biggest step and the points left', () => {
    // 3★ 47점(가구 12 + 나무 15 + 정돈 10 + 이웃 10): 한 가지로는 60점에 못 닿는다.
    // 꽃 10송이가 가장 많이 올린다(+10점). 남은 점수는 13점.
    const i = { ...EMPTY, placed: 3, variety: 3, planted: 0, standing: 10, totalTrees: 10, houses: 2, shopTier: 0 }
    expect(islandScore(i)).toBe(47)
    const tip = ratingTip(i)
    expect(tip).toEqual({ text: '꽃을 10송이 더 심으면 점수가 10점 올라요. 별 하나까지 13점 남았어요', units: 10 })
  })

  it('never returns null before five stars', () => {
    expect(ratingTip({ ...EMPTY, standing: 0, totalTrees: 10 })).not.toBeNull()
  })

  it('the tip always raises the star count when followed', () => {
    const i = { ...EMPTY, placed: 3, variety: 2, planted: 2, watered: 1, standing: 10, totalTrees: 20, holes: 4, litter: 2 }
    const before = starsOf(islandScore(i))
    expect(ratingTip(i)).not.toBeNull()
    // 조언 중 가구만 늘려 보면 실제로 별이 오르는지 확인한다
    let more = i
    let steps = 0
    while (starsOf(islandScore(more)) === before && steps < 20) {
      more = { ...more, placed: more.placed + 1 }
      steps++
    }
    expect(starsOf(islandScore(more))).toBeGreaterThan(before)
  })
})

describe('rewards', () => {
  it('three stars give a recipe and five stars give the golden can, each only once', () => {
    expect(ratingRewards(2, 0)).toEqual([])
    expect(ratingRewards(3, 0)).toEqual(['recipe'])
    expect(ratingRewards(3, 3)).toEqual([])
    expect(ratingRewards(5, 3)).toEqual(['golden-can'])
    expect(ratingRewards(5, 0)).toEqual(['recipe', 'golden-can'])
    expect(ratingRewards(5, 5)).toEqual([])
  })

  it('records the highest reward level reached', () => {
    expect(nextRewarded(2, 0)).toBe(0)
    expect(nextRewarded(3, 0)).toBe(3)
    expect(nextRewarded(5, 3)).toBe(5)
    expect(nextRewarded(4, 5)).toBe(5)
  })

  it('finds the first recipe the player does not know yet', () => {
    expect(firstNewRecipe(STARTER_RECIPES)).toBe('log-bench')
    expect(firstNewRecipe([])).toBe('log-stool')
  })
})

describe('input from save state', () => {
  it('counts standing trees using the felled record and day', () => {
    const input = ratingInputOf(
      {
        placed: [{ itemId: 'chair' }, { itemId: 'chair' }, { itemId: 'lamp' }],
        plants: [{ watered: true }, { watered: false }],
        holes: [{}],
        ground: [{ itemId: 'empty-can' }, { itemId: 'peach' }],
        houses: ['a'],
        shop: { tier: 1 },
        museum: ['x'],
        felled: { t1: { state: 'stump', day: '2026-10-10' } },
        day: '2026-10-19',
        infra: { paths: '' },
      },
      [{ id: 't1' }, { id: 't2' }],
      (id) => id === 'empty-can',
    )
    expect(input).toEqual({ paths: 0, placed: 3, variety: 2, planted: 2, watered: 1, standing: 1, totalTrees: 2, holes: 1, litter: 1, houses: 1, shopTier: 1, museum: 1 })
  })
})
