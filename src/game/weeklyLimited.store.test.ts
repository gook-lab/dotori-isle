import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limitedFor } from '../core/weeklyLimited'
import { NEW_SHOP_LOG } from '../core/shopEvents'
import { useGame } from './store'

// 주간 한정 진열: 한 주에 한 번만 살 수 있고, 다음 월요일에 다시 살 수 있다.
const MON = '2026-10-19'
const NEXT_MON = '2026-10-26'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${MON}T11:00:00`))
  useGame.setState({
    day: MON,
    money: 20000,
    inventory: [],
    shop: { tier: 2, order: null },
    shopLog: NEW_SHOP_LOG,
    weeklyBuy: null,
    toast: null,
    toastQueue: [],
  })
})

describe('주간 한정 물건 구매', () => {
  it('같은 주에는 한 번만 사고, 다음 월요일에는 다시 살 수 있다', () => {
    const first = limitedFor(MON)!
    useGame.getState().buyItem(first.itemId, true)
    expect(useGame.getState().weeklyBuy).toBe(MON)
    expect(useGame.getState().inventory).toEqual([{ id: first.itemId, count: 1, variant: first.variant }])
    expect(useGame.getState().money).toBe(20000 - first.price)

    useGame.setState({ day: '2026-10-22' })
    useGame.getState().buyItem(first.itemId, true)
    expect(useGame.getState().money).toBe(20000 - first.price)

    const next = limitedFor(NEXT_MON)!
    vi.setSystemTime(new Date(`${NEXT_MON}T11:00:00`))
    useGame.setState({ day: NEXT_MON })
    useGame.getState().buyItem(next.itemId, true)
    expect(useGame.getState().weeklyBuy).toBe(NEXT_MON)
    expect(useGame.getState().money).toBe(20000 - first.price - next.price)
  })
})
