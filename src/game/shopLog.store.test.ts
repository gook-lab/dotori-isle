import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { monthlyFurniture } from '../core/shopEvents'
import { displayStock } from '../core/shopDisplay'
import { CANDY_ID } from '../core/pumpkin'
import { useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const fresh = useGame.getState()
const FRI = '2026-10-23'

beforeEach(() => {
  useGame.setState({
    ...fresh,
    day: FRI,
    money: 50000,
    inventory: [{ id: 'chair', count: 2 }, { id: 'peach', count: 3 }],
    shop: { tier: 3, order: null },
    shopLog: { sold: {}, monthly: null, stockDay: null, stockSold: [] },
    pocket: 20,
    rating: { ...fresh.rating, stars: 0 },
  })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('상점 기록과 이달의 가구', () => {
  it('판 품목을 개수만큼 기록한다', () => {
    useGame.getState().sell(0)
    expect(useGame.getState().shopLog.sold).toEqual({ chair: 2 })
    useGame.getState().sellAll()
    expect(useGame.getState().shopLog.sold).toEqual({ chair: 2, peach: 3 })
  })

  it('이달의 가구는 한 달에 한 번만 사고, 돈이 들며 기록된다', () => {
    const m = monthlyFurniture(FRI)!
    useGame.getState().buyMonthly()
    const s = useGame.getState()
    expect(s.shopLog.monthly).toBe('2026-10')
    expect(s.money).toBe(50000 - m.price)
    expect(s.inventory.some((x) => x.id === m.itemId)).toBe(true)
    useGame.getState().buyMonthly()
    expect(useGame.getState().money).toBe(50000 - m.price)
  })

  it('돈이 모자라면 사지 못한다', () => {
    useGame.setState({ money: 0 })
    useGame.getState().buyMonthly()
    expect(useGame.getState().shopLog.monthly).toBeNull()
  })
})

describe('진열 품절 규칙', () => {
  // 호박 등불 주간(10/25~)이라 사탕이 진열에 들어온다. 가구는 그날 진열 첫 자리를 쓴다.
  const CANDY_DAY = '2026-10-26'

  it('사탕 주간에는 사탕을 연달아 세 번 사도 모두 된다', () => {
    expect(displayStock(3, CANDY_DAY).length).toBeGreaterThan(0)
    useGame.setState({ day: CANDY_DAY })
    const before = useGame.getState().money
    for (let i = 0; i < 3; i++) useGame.getState().buyItem(CANDY_ID)
    const s = useGame.getState()
    expect(s.inventory.find((x) => x.id === CANDY_ID)?.count).toBe(3)
    expect(s.money).toBeLessThan(before)
    expect(s.shopLog.stockSold).not.toContain(CANDY_ID)
  })

  it('진열 가구는 두 번째 구매에서 품절이 되고 돈이 더 나가지 않는다', () => {
    const f = displayStock(3, CANDY_DAY)[0]
    expect(f).toBeDefined()
    useGame.setState({ day: CANDY_DAY })
    useGame.getState().buyItem(f.itemId)
    const once = useGame.getState().money
    expect(useGame.getState().shopLog.stockSold).toContain(f.itemId)
    useGame.getState().buyItem(f.itemId)
    expect(useGame.getState().money).toBe(once)
    expect(useGame.getState().inventory.find((x) => x.id === f.itemId)?.count).toBe(1)
  })
})

describe('백화점 올리기', () => {
  it('섬 별점이 3★ 보다 낮으면 올리지 못하고, 3★ 이면 공사를 맡긴다', () => {
    useGame.setState({ shop: { tier: 2, order: null }, stats: { ...fresh.stats, earn: 40000, spent: 6000 }, questsDone: ['newcomer-guriguri'], money: 30000 })
    useGame.getState().upgradeShop()
    expect(useGame.getState().shop.order).toBeNull()
    useGame.setState({ rating: { ...useGame.getState().rating, stars: 3 } })
    useGame.getState().upgradeShop()
    expect(useGame.getState().shop.order).toEqual({ to: 3, day: FRI })
    expect(useGame.getState().money).toBe(15000)
  })
})
