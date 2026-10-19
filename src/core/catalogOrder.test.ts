import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { LIMITED_ITEM } from './homeScore'
import { FESTIVALS } from './festivals'
import { checkOrder, ORDER_DAILY_MAX, orderPrice, parcelLetters, sanitizeOrders, type CatalogOrder } from './catalogOrder'
import { monthlyFurniture } from './shopEvents'

const DAY = '2026-10-19'
const base = { day: DAY, money: 100000, seen: ['lamp', 'wooden-box'], orders: [] as CatalogOrder[] }
const festival = Object.values(FESTIVALS)[0].reward
/** 이달의 가구가 아닌 가구 하나 (이번 달 안에서는 바뀌지 않는다) */
const plain = ['lamp', 'wooden-box', 'chair'].find((id) => id !== monthlyFurniture(DAY)?.itemId)!

describe('가구 주문 가격', () => {
  it('정가가 없으면 판매가의 네 배를 열 단위로 맞춘다', () => {
    expect(ITEMS['wooden-box'].buy).toBeUndefined()
    expect(orderPrice('wooden-box')).toBe(360)
    expect(orderPrice('lamp')).toBe(ITEMS.lamp.buy)
    expect(orderPrice('fence')).toBeNull()
  })
})

describe('가구 주문 가능 여부', () => {
  it('가져 본 정가 가구는 정가로 주문할 수 있다', () => {
    expect(checkOrder('lamp', base)).toEqual({ ok: true, price: ITEMS.lamp.buy })
  })

  it('가져 본 적 없거나 도움이 안 되는 항목은 이유를 돌려준다', () => {
    const r = checkOrder('chair', base)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('가져 본 가구')
    expect(checkOrder('fence', { ...base, seen: ['fence'] }).ok).toBe(false)
    expect(checkOrder('firefly', base).ok).toBe(false)
  })

  it('이달의 가구·축제 보상·한정품은 주문할 수 없다', () => {
    const monthly = monthlyFurniture(DAY)?.itemId
    if (monthly) expect(checkOrder(monthly, { ...base, seen: [monthly] }).ok).toBe(false)
    expect(checkOrder(festival, { ...base, seen: [festival] }).ok).toBe(false)
    expect(checkOrder(LIMITED_ITEM, { ...base, seen: [LIMITED_ITEM] }).ok).toBe(false)
  })

  it('하루 다섯 개까지만 주문하고, 다음 날에는 다시 할 수 있다', () => {
    const full = Array.from({ length: ORDER_DAILY_MAX }, () => ({ itemId: plain, day: DAY }))
    const seen = [plain]
    expect(checkOrder(plain, { ...base, seen, orders: full }).ok).toBe(false)
    expect(checkOrder(plain, { ...base, seen, day: '2026-10-20', orders: full }).ok).toBe(true)
  })

  it('도토리가 모자라면 실패하고 정가는 그대로 알려 준다', () => {
    const r = checkOrder('lamp', { ...base, money: 1 })
    expect(r).toEqual({ ok: false, reason: '도토리가 모자라요', price: ITEMS.lamp.buy })
  })
})

describe('소포 배달', () => {
  it('주문한 날보다 뒤인 날에만 소포 편지를 만들고, 받기 칸에 가구를 넣는다', () => {
    const orders: CatalogOrder[] = [{ itemId: 'lamp', day: DAY }, { itemId: 'wooden-box', day: '2026-10-20' }]
    const letters = parcelLetters('2026-10-20', orders)
    expect(letters).toHaveLength(1)
    expect(letters[0].gift).toBe('lamp')
    expect(letters[0].claimed).toBe(false)
  })
})

describe('주문 목록 검증', () => {
  it('가구가 아니거나 날짜가 깨진 항목은 버린다', () => {
    const raw = [{ itemId: 'lamp', day: DAY }, { itemId: 'iron-coin', day: DAY }, { itemId: 'lamp', day: 'x' }, null, 3]
    expect(sanitizeOrders(raw)).toEqual([{ itemId: 'lamp', day: DAY }])
    expect(sanitizeOrders('oops')).toEqual([])
  })
})
