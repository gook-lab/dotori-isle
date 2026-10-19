import { describe, expect, it } from 'vitest'
import { cleanShopNew, isNewShopItem, NEW_ITEM_DAYS, newItemIds, seeShopNew, type ShopNewState } from './shopNew'
import { newItemsAt } from './shopTiers'
import { ITEMS } from './items'
import { nextDay } from './festivals'

const REOPEN = '2026-10-21'
const at = (tier: 1 | 2 | 3 = 1, seen: string[] = []): ShopNewState => ({ tier, day: REOPEN, seen })
const addDays = (key: string, n: number): string => (n === 0 ? key : addDays(nextDay(key), n - 1))
const NEW_T1 = newItemIds(1)[0]
const OLD_T1 = 'flower-seed' // 노점부터 있던 물건

describe('새 물건 목록', () => {
  it('노점은 새 물건이 없고, 단계마다 이전 단계에 없던 진열만 센다', () => {
    expect(newItemIds(0)).toEqual([])
    expect(newItemIds(1).length).toBeGreaterThan(0)
    expect(newItemIds(1)).not.toContain(OLD_T1)
  })

  it('id 목록과 이름 목록(newItemsAt)의 개수가 같다', () => {
    for (const t of [1, 2, 3] as const) expect(newItemIds(t).length).toBe(newItemsAt(t).length)
    expect(newItemIds(1).map((id) => ITEMS[id].name)).toEqual(newItemsAt(1))
  })
})

describe('새 물건 배지', () => {
  it('재개장 날부터 사흘 동안, 이번 단계의 새 물건에만 배지가 붙는다', () => {
    for (let n = 0; n < NEW_ITEM_DAYS; n++) expect(isNewShopItem(NEW_T1, at(), addDays(REOPEN, n))).toBe(true)
    expect(isNewShopItem(NEW_T1, at(), addDays(REOPEN, NEW_ITEM_DAYS))).toBe(false)
  })

  it('이전 단계부터 있던 물건이나 기록이 없으면 배지가 없다', () => {
    expect(isNewShopItem(OLD_T1, at(), REOPEN)).toBe(false)
    expect(isNewShopItem(NEW_T1, null, REOPEN)).toBe(false)
  })

  it('재개장 전 날짜면 배지가 없다', () => {
    expect(isNewShopItem(NEW_T1, at(), '2026-10-20')).toBe(false)
  })

  it('살펴본 물건은 배지를 잃고, 다른 새 물건은 그대로 남는다', () => {
    const next = seeShopNew(at(), NEW_T1, REOPEN)
    expect(isNewShopItem(NEW_T1, next, REOPEN)).toBe(false)
    const other = newItemIds(1)[1]
    if (other) expect(isNewShopItem(other, next, REOPEN)).toBe(true)
  })

  it('배지가 없는 물건을 살펴봐도 기록은 그대로다', () => {
    const s = at()
    expect(seeShopNew(s, OLD_T1, REOPEN)).toBe(s)
    expect(seeShopNew(null, NEW_T1, REOPEN)).toBe(null)
  })

  it('다음 단계 재개장에서는 새 기록이라 이전 단계의 떼어 낸 기록이 남지 않는다', () => {
    const t2 = at(2)
    expect(isNewShopItem(newItemIds(2)[0], t2, REOPEN)).toBe(true)
  })
})

describe('새 물건 기록 불러오기', () => {
  it('정상 값은 그대로 읽고 중복 id 는 한 번만 남긴다', () => {
    expect(cleanShopNew({ tier: 1, day: REOPEN, seen: [NEW_T1, NEW_T1] })).toEqual({ tier: 1, day: REOPEN, seen: [NEW_T1] })
  })

  it('없거나 틀린 값은 null 이고, 모르는 물건 id 는 버린다', () => {
    expect(cleanShopNew(undefined)).toBe(null)
    expect(cleanShopNew({ tier: 9, day: REOPEN, seen: [] })).toBe(null)
    expect(cleanShopNew({ tier: 1, day: 'not-a-day', seen: [] })).toBe(null)
    expect(cleanShopNew({ tier: 1, day: REOPEN, seen: ['no-such-item', 3] })).toEqual({ tier: 1, day: REOPEN, seen: [] })
  })
})
