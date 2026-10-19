import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ORDER_DAILY_MAX, orderPrice } from '../core/catalogOrder'
import { monthlyFurniture } from '../core/shopEvents'
import { useGame } from './store'

const DAY = '2026-10-19'
const NEXT = '2026-10-20'
const plain = ['lamp', 'wooden-box', 'chair'].find((id) => id !== monthlyFurniture(DAY)?.itemId)!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  useGame.setState({ day: DAY, money: 100000, furnitureSeen: [plain], orders: [], letters: [], inventory: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('가구 주문', () => {
  it('정가를 치르고 오늘 주문으로 넣는다', () => {
    useGame.getState().orderCatalog(plain)
    const s = useGame.getState()
    expect(s.money).toBe(100000 - orderPrice(plain)!)
    expect(s.orders).toEqual([{ itemId: plain, day: DAY }])
  })

  it('하루 다섯 개를 넘기면 더 넣지 않고 돈도 그대로 둔다', () => {
    useGame.setState({ orders: Array.from({ length: ORDER_DAILY_MAX }, () => ({ itemId: plain, day: DAY })) })
    useGame.getState().orderCatalog(plain)
    expect(useGame.getState().orders).toHaveLength(ORDER_DAILY_MAX)
    expect(useGame.getState().money).toBe(100000)
  })

  it('하루가 넘어가면 소포 편지로 배달하고 주문 목록을 비운다', () => {
    useGame.setState({ orders: [{ itemId: plain, day: DAY }] })
    vi.setSystemTime(new Date(2026, 9, 20, 8))
    useGame.getState().syncClock()
    const s = useGame.getState()
    expect(s.day).toBe(NEXT)
    expect(s.orders).toEqual([])
    const parcel = s.letters.find((l) => l.gift === plain)
    expect(parcel).toBeDefined()
    expect(parcel?.claimed).toBe(false)
  })
})
