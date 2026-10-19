import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { addItem, furnitureOwned, hasFurniture, sellSlots, sortInventory, totalValue, type Slot, removeOneOf } from './inventory'

describe('가방 정렬', () => {
  it('종류 순서로 묶고, 같은 종류 안에서는 값이 비싼 것부터 놓는다', () => {
    const inv: Slot[] = [
      { id: 'chair', count: 1 },
      { id: 'horse-mackerel', count: 1 },
      { id: 'peach', count: 2 },
      { id: 'mackerel', count: 1 },
    ]
    const ids = sortInventory(inv).map((s) => s.id)
    // 과일이 먼저, 물고기는 고등어(60)가 전갱이(40)보다 앞, 가구는 맨 뒤
    expect(ids.indexOf('peach')).toBeLessThan(ids.indexOf('mackerel'))
    expect(ids.indexOf('mackerel')).toBeLessThan(ids.indexOf('horse-mackerel'))
    expect(ids[ids.length - 1]).toBe('chair')
  })

  it('정렬하면서 같은 물건은 쌓는 한도 안에서 다시 합친다', () => {
    const inv: Slot[] = [
      { id: 'peach', count: 3 },
      { id: 'mackerel', count: 1 },
      { id: 'peach', count: 4 },
    ]
    const out = sortInventory(inv)
    const peaches = out.filter((s) => s.id === 'peach')
    expect(peaches.reduce((n, s) => n + s.count, 0)).toBe(7)
    expect(peaches.every((s) => s.count <= ITEMS.peach.stack)).toBe(true)
  })

  it('변형이 다른 가구는 따로 둔다', () => {
    const out = sortInventory([
      { id: 'chair', count: 1, variant: 'red' },
      { id: 'chair', count: 1 },
    ])
    expect(out).toHaveLength(2)
  })
})

describe('골라서 팔기', () => {
  const inv: Slot[] = [
    { id: 'peach', count: 2 },
    { id: 'mackerel', count: 1 },
    { id: 'chair', count: 1 },
  ]

  it('고른 칸만 빠지고 합계가 맞는다', () => {
    const r = sellSlots(inv, [0, 1])
    expect(r.inv).toEqual([{ id: 'chair', count: 1 }])
    expect(r.sold).toHaveLength(2)
    expect(r.earned).toBe(totalValue([inv[0], inv[1]]))
  })

  it('범위 밖이나 같은 칸을 두 번 골라도 한 번만 판다', () => {
    const r = sellSlots(inv, [1, 1, 9, -1])
    expect(r.sold).toEqual([inv[1]])
    expect(r.inv).toHaveLength(2)
  })

  it('아무것도 고르지 않으면 그대로다', () => {
    const r = sellSlots(inv, [])
    expect(r.inv).toEqual(inv)
    expect(r.earned).toBe(0)
  })

  it('가구가 섞였는지 알려 준다', () => {
    expect(hasFurniture([inv[0], inv[2]])).toBe(true)
    expect(hasFurniture([inv[0], inv[1]])).toBe(false)
  })
})

describe('겹치기 한도', () => {
  it('물고기와 벌레는 한 칸에 하나만 들어간다', () => {
    const fishBug = Object.values(ITEMS).filter((d) => d.kind === 'fish' || d.kind === 'bug')
    expect(fishBug.length).toBeGreaterThan(0)
    expect(fishBug.every((d) => d.stack === 1)).toBe(true)
    const r = addItem([], fishBug[0].id, 2, 20)
    expect(r.inv).toHaveLength(2)
  })
})

describe('가진 가구 개수', () => {
  it('주머니·보관함 수량과 방에 놓은 가구를 더한다', () => {
    const bag: Slot[] = [{ id: 'wooden-box', count: 1 }, { id: 'fishing-net', count: 3 }]
    const storage: Slot[] = [{ id: 'wooden-box', count: 2 }]
    const placed = [{ itemId: 'wooden-box' }, { itemId: 'lamp' }]
    expect(furnitureOwned('wooden-box', { bag, storage, placed })).toBe(4)
    expect(furnitureOwned('lamp', { bag, storage, placed })).toBe(1)
  })

  it('없으면 0 이다', () => {
    expect(furnitureOwned('wooden-box', { bag: [], storage: [], placed: [] })).toBe(0)
  })
})

describe('removeOneOf: 변형이 같은 칸만 뺀다', () => {
  it('기본 가구를 빼도 금박 칸은 그대로 남는다', () => {
    const inv = [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }]
    expect(removeOneOf(inv, 'chair', undefined)).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
  })

  it('금박 칸을 빼도 기본 가구 칸은 그대로 남는다', () => {
    const inv = [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }]
    expect(removeOneOf(inv, 'chair', 'gold')).toEqual([{ id: 'chair', count: 1 }])
  })

  it('묶음에서 하나만 줄이고 같은 변형이 없으면 null', () => {
    const inv = [{ id: 'chair', count: 3, variant: 'mint' }]
    expect(removeOneOf(inv, 'chair', 'mint')).toEqual([{ id: 'chair', count: 2, variant: 'mint' }])
    expect(removeOneOf(inv, 'chair', 'gold')).toBeNull()
    expect(removeOneOf(inv, 'chair', undefined)).toBeNull()
  })
})
