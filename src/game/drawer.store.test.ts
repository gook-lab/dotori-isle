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
    homeFurniture: [{ id: 'dr-1', itemId: 'drawer', x: 0.4, z: -0.4, rot: 0 }],
    homeStorage: [],
  })
  runtime.player.x = c.x
  runtime.player.z = c.z - 0.2
  runtime.player.facing = 0
})

describe('서랍장', () => {
  it('가구 정보와 상점 진열이 있다', () => {
    expect(ITEMS.drawer.kind).toBe('furniture')
    expect(ITEMS.drawer.buy).toBeGreaterThan(0)
    expect(SHOP_TIERS.some((t) => t.pool.includes('drawer'))).toBe(true)
  })

  it('가까이 서서 E 를 누르면 보관함 패널이 열린다', () => {
    const a = findAction()
    expect(a?.kind).toBe('storage')
    expect(a?.label).toBe('서랍장 열기')
    runAction(a!)
    expect(useGame.getState().panel).toBe('storage')
  })

  it('다른 가구는 여전히 넣기·쓰임 안내를 따른다', () => {
    useGame.setState({ homeFurniture: [{ id: 'ch-1', itemId: 'chair', x: 0.4, z: -0.4, rot: 0 }] })
    expect(findAction()?.kind).not.toBe('storage')
  })
})
