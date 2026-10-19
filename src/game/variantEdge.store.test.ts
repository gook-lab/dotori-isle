import { beforeEach, describe, expect, it } from 'vitest'
import { ITEMS } from '../core/items'
import { NEW_HOME } from '../core/home'
import { NEW_SHOP } from '../core/shopTiers'
import { scoreHome, setProgress } from '../core/homeScore'
import { slotValue } from '../core/inventory'
import { useGame } from './store'

const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({ ...fresh, money: 5000, home: { ...NEW_HOME, stage: 2 }, shop: { ...NEW_SHOP, tier: 3 }, inventory: [], homeStorage: [], homeFurniture: [], pocket: 20 })
})

describe('마감 가구를 보관함에 넣었다 빼기', () => {
  it('기본 가구와 마감 가구가 섞여 있어도 고른 칸의 색이 그대로 보관되고 돌아온다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }] })
    useGame.getState().moveToStorage(0)
    expect(useGame.getState().homeStorage).toEqual([{ id: 'chair', count: 1 }])
    expect(useGame.getState().inventory).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
  })

  it('보관함에서 꺼낼 때도 고른 칸의 색을 잃지 않는다', () => {
    useGame.setState({ homeStorage: [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'glitter' }], inventory: [] })
    useGame.getState().takeFromStorage(1)
    expect(useGame.getState().inventory).toEqual([{ id: 'chair', count: 1, variant: 'glitter' }])
    expect(useGame.getState().homeStorage).toEqual([{ id: 'chair', count: 1 }])
  })
})

describe('마감 가구를 리폼으로 바꿀 때', () => {
  it('금박 한정판을 다른 색으로 바꾸면 마감은 그 색으로 바뀌고, 되팔 값은 기본 값이다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1, variant: 'gold' }, { id: 'wood', count: 1 }] })
    expect(useGame.getState().reformFurniture({ from: 'bag', index: 0 }, 'mint')).toBe(true)
    const slot = useGame.getState().inventory[0]
    expect(slot.variant).toBe('mint')
    expect(slotValue(slot)).toBe(ITEMS.chair.price)
  })
})

describe('마감 가구가 방에서 세는 점수', () => {
  const plain = [{ itemId: 'chair', x: 0, z: 0, rot: 0 }, { itemId: 'table', x: 1, z: 0, rot: 0 }]
  const finished = [{ itemId: 'chair', variant: 'gold', x: 0, z: 0, rot: 0 }, { itemId: 'table', x: 1, z: 0, rot: 0 }]

  it('세트 진행은 마감과 상관없이 같다', () => {
    expect(setProgress(finished)).toEqual(setProgress(plain))
  })

  it('가구 수·종류 점수는 마감과 상관없이 같다', () => {
    const a = scoreHome({ stage: 2, furniture: plain, framed: false })
    const b = scoreHome({ stage: 2, furniture: finished, framed: false })
    expect(b.count).toBe(a.count)
    expect(b.kinds).toBe(a.kinds)
    expect(b.parts.count).toBe(a.parts.count)
    expect(b.parts.variety).toBe(a.parts.variety)
    expect(b.parts.sets).toBe(a.parts.sets)
  })
})
