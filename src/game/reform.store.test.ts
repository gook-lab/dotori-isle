import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NEW_SHOP } from '../core/shopTiers'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({
    ...fresh,
    money: 100,
    inventory: [
      { id: 'wooden-box', count: 1 },
      { id: 'wood', count: 2 },
    ],
    homeFurniture: [],
    shop: { ...NEW_SHOP, tier: 2 },
  })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('리폼 코너', () => {
  it('상점 2단계 전에는 리폼할 수 없다', () => {
    useGame.setState({ shop: { ...NEW_SHOP, tier: 1 } })
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'mint')).toBe(false)
    expect(useGame.getState().inventory[0].variant).toBeUndefined()
  })

  it('주머니 가구를 고치면 도토리와 목재 1을 쓰고 칸에 변형을 적는다', () => {
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'mint')).toBe(true)
    const s = useGame.getState()
    expect(s.inventory[0]).toEqual({ id: 'wooden-box', count: 1, variant: 'mint' })
    expect(s.inventory.find((x) => x.id === 'wood')?.count).toBe(1)
    expect(s.money).toBe(100 - 36)
  })

  it('방 가구를 고치면 방 가구에 변형이 남는다', () => {
    useGame.setState({ homeFurniture: [{ id: 'h1', itemId: 'wooden-box', x: 1, z: 1, rot: 0 }] })
    expect(useGame.getState().reformFurniture({ from: 'home', id: 'h1' }, 'charcoal')).toBe(true)
    expect(useGame.getState().homeFurniture[0].variant).toBe('charcoal')
  })

  it('같은 색이거나 목재가 없으면 바뀌지 않는다', () => {
    useGame.setState({ inventory: [{ id: 'wooden-box', count: 1, variant: 'mint' }, { id: 'wood', count: 1 }] })
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'mint')).toBe(false)
    useGame.setState({ inventory: [{ id: 'wooden-box', count: 1 }] })
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'mint')).toBe(false)
    expect(useGame.getState().money).toBe(100)
  })

  it('방 가구를 주머니에 넣을 때 변형도 따라온다', () => {
    useGame.setState({ inventory: [], homeFurniture: [{ id: 'h1', itemId: 'wooden-box', x: 1, z: 1, rot: 0, variant: 'honey' }] })
    useGame.getState().pickUpHome('h1')
    expect(useGame.getState().inventory).toEqual([{ id: 'wooden-box', count: 1, variant: 'honey' }])
  })
})

describe('저장 버전 19 로 올린 뒤 variant 정리', () => {
  it('모르는 변형은 지우고 아는 변형은 남긴다', () => {
    const s = migrateSave({
      inventory: [{ id: 'wooden-box', count: 1, variant: 'neon' }],
      placed: [{ id: 'p1', itemId: 'wooden-box', x: 0, z: 0, rot: 0, variant: 'mint' }],
      homeFurniture: [{ id: 'h1', itemId: 'wooden-box', x: 0, z: 0, rot: 0, variant: 'rose' }],
      homeStorage: [{ id: 'wooden-box', count: 1, variant: 42 }],
    })
    expect(s.inventory[0].variant).toBeUndefined()
    expect(s.placed[0].variant).toBe('mint')
    expect(s.homeFurniture[0].variant).toBe('rose')
    expect(s.homeStorage[0].variant).toBeUndefined()
  })
})

describe('보관함 가구 리폼', () => {
  it('보관함 칸의 가구도 변형을 적고 목재와 도토리를 쓴다', () => {
    useGame.setState({ homeStorage: [{ id: 'wooden-box', count: 1 }] })
    expect(useGame.getState().reformFurniture({ from: 'storage', index: 0 }, 'rose')).toBe(true)
    const s = useGame.getState()
    expect(s.homeStorage[0].variant).toBe('rose')
    expect(s.money).toBe(100 - 36)
  })
})

describe('고급 마감 고르기', () => {
  it('백화점 전에는 마감을 바꿀 수 없다', () => {
    useGame.setState({ money: 9999 })
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'gold')).toBe(false)
    expect(useGame.getState().inventory[0].variant).toBeUndefined()
  })

  it('백화점 이후에는 마감 도토리를 내고 칸에 마감을 적는다', () => {
    useGame.setState({ money: 2000, shop: { ...NEW_SHOP, tier: 3 } })
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'gold')).toBe(true)
    expect(useGame.getState().inventory[0].variant).toBe('gold')
    expect(useGame.getState().money).toBe(2000 - 1500)
  })
})
