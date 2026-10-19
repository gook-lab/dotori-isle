import { beforeEach, describe, expect, it } from 'vitest'
import { HOME_ROOM, roomCenter } from '../core/interior'
import { ITEMS } from '../core/items'
import { SHOP_TIERS } from '../core/shopTiers'
import { findAction, runAction } from './actions'
import { runtime } from './runtime'
import { useGame } from './store'

const c = roomCenter(HOME_ROOM)

beforeEach(() => {
  runtime.seat = null
  runtime.act = null
  runtime.fishing = { phase: 'idle' }
  useGame.setState({
    panel: null,
    placing: null,
    inHome: true,
    inside: null,
    homeFloor: 0,
    homeFurniture: [{ id: 'wd-1', itemId: 'wardrobe', x: 0.4, z: -0.4, rot: 0 }],
    homeStorage: [],
  })
  runtime.player.x = c.x
  runtime.player.z = c.z - 0.2
  runtime.player.facing = 0
})

describe('옷장', () => {
  it('가구 정보가 있고 큰 가게 진열에 들어 있다', () => {
    expect(ITEMS.wardrobe.kind).toBe('furniture')
    expect(ITEMS.wardrobe.buy).toBeGreaterThan(0)
    const tier2 = SHOP_TIERS.find((t) => t.tier === 2)
    expect(tier2?.pool).toContain('wardrobe')
  })

  it('가까이 서서 E 를 누르면 옷장 패널이 열린다(상점 구매 없이)', () => {
    const a = findAction()
    expect(a?.kind).toBe('closet')
    expect(a?.label).toBe('옷장 열기')
    runAction(a!)
    expect(useGame.getState().panel).toBe('closet')
    expect(useGame.getState().closetShop).toBe(false)
  })

  it('C 키와 같은 패널을 여는 함수를 쓴다', () => {
    useGame.getState().openCloset(false)
    expect(useGame.getState().panel).toBe('closet')
    expect(useGame.getState().closetShop).toBe(false)
  })

  it('다른 가구는 옷장 패널로 가지 않는다', () => {
    useGame.setState({ homeFurniture: [{ id: 'ch-1', itemId: 'chair', x: 0.4, z: -0.4, rot: 0 }] })
    expect(findAction()?.kind).not.toBe('closet')
  })
})
