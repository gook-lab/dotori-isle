import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GIFT_PROJECTS } from '../core/islandGift'
import { NEW_SHOP } from '../core/shopTiers'
import { useGame } from './store'

// 상점 밖 도토리 지출(섬 가꾸기 2차 · 집 증축 돕기 · 리폼)은 이름 붙은 누계로 세고, 상점 누계 spent 는 그대로 둔다
const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({
    ...fresh,
    day: '2026-10-26',
    money: 20000,
    inventory: [{ id: 'wooden-box', count: 1 }, { id: 'wood', count: 2 }],
    homeFurniture: [],
    shop: { ...NEW_SHOP, tier: 2 },
    stats: {},
    home: { stage: 5, loan: 0, order: null },
    houses: ['mocha'],
    houseExpand: null,
    expanded: [],
    islandGift: { built: GIFT_PROJECTS.length, fund: 0, ready: null },
    islandAcorn: { built: 0, fund: 0, ready: null },
  })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('상점 밖 도토리 지출 누계', () => {
  it('집 증축 돕기는 보탠 만큼 spentHouse 에 쌓이고 spent 는 그대로다', () => {
    useGame.getState().donateHouseExpand('mocha')
    const s = useGame.getState()
    expect(s.stats.spentHouse).toBe(1000)
    expect(s.stats.spent ?? 0).toBe(0)
  })

  it('섬 가꾸기 2차 기부는 실제로 빠진 도토리만큼 spentGift 에 쌓인다', () => {
    useGame.getState().donateAcornGift(3000)
    const s = useGame.getState()
    expect(s.money).toBe(17000)
    expect(s.stats.spentGift).toBe(3000)
    expect(s.stats.spent ?? 0).toBe(0)
  })

  it('리폼은 치른 도토리만큼 spentReform 에 쌓인다', () => {
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'mint')).toBe(true)
    const s = useGame.getState()
    expect(s.stats.spentReform).toBe(36)
    expect(s.money).toBe(20000 - 36)
  })
})
