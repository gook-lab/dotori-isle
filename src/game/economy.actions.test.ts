import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays } from '../core/economy'
import { createBank } from '../core/bank'
import { canPlaceInHome, homeChest, HOME_SITE, NEW_HOME } from '../core/home'
import { exitOf, HOME_ROOM_SIZES, HOME_ROOM, roomCenter, ROOM_EXIT, SHOP_OBJECTS, SHOP_ROOM } from '../core/interior'
import { NEW_SHOP } from '../core/shopTiers'
import { SHOP_DOOR } from '../core/world'
import { findAction, runAction } from './actions'
import { runtime } from './runtime'
import { useGame } from './store'

const fresh = useGame.getState()
const D0 = '2026-03-10'

/** 플레이어를 주어진 곳에 세운다. 주민이 가까이 없도록 섬 가장자리 기준으로만 옮긴다. */
function standAt(x: number, z: number, facing = 0) {
  runtime.player.x = x
  runtime.player.z = z
  runtime.player.facing = facing
}

beforeEach(() => {
  runtime.fishing = { phase: 'idle' }
  runtime.seat = null
  useGame.setState({
    ...fresh,
    day: D0,
    money: 0,
    inventory: [],
    tools: [],
    tool: 'hand',
    ground: [],
    placed: [],
    panel: null,
    inHome: false,
    placing: null,
    homePlacing: null,
    homeFurniture: [],
    homeStorage: [],
    shop: NEW_SHOP,
    home: NEW_HOME,
    bank: createBank(D0),
    houses: [],
  })
})

describe('outside the house', () => {
  it('offers to enter the tent at its door and the consult sign beside it', () => {
    // 집 상담은 ‘집 지을 재료’ 퀘스트를 깨고 사흘이 지나야 열린다
    useGame.setState({ questsDone: ['materials'], islandStart: addDays(D0, -3) as string })
    standAt(HOME_SITE!.door.x, HOME_SITE!.door.z)
    expect(findAction()?.kind).toBe('home-door')
    standAt(HOME_SITE!.sign.x, HOME_SITE!.sign.z)
    expect(findAction()?.kind).toBe('home-sign')
    runAction(findAction()!)
    expect(useGame.getState().panel).toBe('home')
  })

  it('enters the shop building at its door when the shop is open', () => {
    standAt(SHOP_DOOR.x, SHOP_DOOR.z)
    const a = findAction()
    expect(a?.kind).toBe('shop-enter')
    expect(a && 'label' in a && a.label).toBe('도토리 상점 들어가기')
  })

  it('says the shop is under construction on the day after an order', () => {
    useGame.setState({ day: addDays(D0, 1) as string, shop: { tier: 0, order: { to: 1, day: D0 } } })
    standAt(SHOP_DOOR.x, SHOP_DOOR.z)
    const a = findAction()
    expect(a?.kind).toBe('shop-enter')
    expect(a && 'label' in a && a.label).toContain('공사')
  })

  it('still picks up a dropped item at the shop door', () => {
    useGame.setState({ ground: [{ id: 'g1', itemId: 'wood', x: SHOP_DOOR.x, z: SHOP_DOOR.z }] })
    standAt(SHOP_DOOR.x, SHOP_DOOR.z)
    expect(findAction()?.kind).toBe('pickup')
  })
})

describe('inside the shop', () => {
  const c = roomCenter(SHOP_ROOM)

  beforeEach(() => {
    useGame.setState({ inShop: true })
  })

  it('opens the ATM panel at the wall ATM once the dig quest is done', () => {
    useGame.setState({ questsDone: ['dig'] })
    standAt(c.x + SHOP_OBJECTS.atm.x - 0.8, c.z + SHOP_OBJECTS.atm.z)
    expect(findAction()?.kind).toBe('atm')
    runAction(findAction()!)
    expect(useGame.getState().panel).toBe('atm')
  })

  it('talks to a clerk, then opens the shop panel after the bubble', () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const k = SHOP_OBJECTS.clerks[0]
    standAt(c.x + k.x, c.z + k.z + 1)
    const a = findAction()
    expect(a?.kind).toBe('shop')
    runAction(a!)
    expect(useGame.getState().clerkSay?.id).toBe('garam')
    expect(useGame.getState().panel).toBeNull()
    vi.advanceTimersByTime(1500)
    expect(useGame.getState().panel).toBe('shop')
    vi.useRealTimers()
  })

  it('leaves at the door', () => {
    standAt(c.x + ROOM_EXIT.x, c.z + ROOM_EXIT.z)
    expect(findAction()?.kind).toBe('shop-leave')
  })
})

describe('inside the player room', () => {
  const c = roomCenter(HOME_ROOM)

  beforeEach(() => {
    useGame.setState({ inHome: true })
  })

  it('leaves at the door and opens the storage at the chest', () => {
    standAt(c.x + exitOf(HOME_ROOM_SIZES[0]).x, c.z + exitOf(HOME_ROOM_SIZES[0]).z)
    expect(findAction()?.kind).toBe('home-leave')
    standAt(c.x + homeChest(0).x, c.z + homeChest(0).z)
    expect(findAction()?.kind).toBe('storage')
    runAction(findAction()!)
    expect(useGame.getState().panel).toBe('storage')
  })

  it('places a chair on a free grid cell and takes it from the pocket', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }], homePlacing: 'chair' })
    // 텐트 칸은 방 뒤쪽 3×3 이다. 바라보는 칸이 (0,-1) 이 되도록 선다.
    standAt(c.x, c.z - 2.6, 0)
    const a = findAction()
    expect(a?.kind).toBe('home-place')
    expect(a && a.kind === 'home-place' && a.ok).toBe(true)
    runAction(a!)
    expect(useGame.getState().homeFurniture).toHaveLength(1)
    expect(useGame.getState().homeFurniture[0]).toMatchObject({ itemId: 'chair', x: 0, z: -1 })
    expect(useGame.getState().inventory).toEqual([])
    // 같은 칸에는 다시 놓을 수 없다
    expect(canPlaceInHome(0, -1, 0, useGame.getState().homeFurniture)).toBe(false)
  })

  it('will not place outside the grid for the tent', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }], homePlacing: 'chair' })
    standAt(c.x + 3.5, c.z + 2.5, 0)
    const a = findAction()
    expect(a?.kind).toBe('home-place')
    expect(a && a.kind === 'home-place' && a.ok).toBe(false)
    runAction(a!)
    expect(useGame.getState().homeFurniture).toEqual([])
  })

  it('a chair next to the player is sat on with E, and put back into the pocket with R', () => {
    useGame.setState({ homeFurniture: [{ id: 'h1', itemId: 'chair', x: 0, z: -1, rot: 0 }] })
    standAt(c.x + 0.2, c.z - 0.9)
    expect(findAction()?.kind).toBe('home-use')
    useGame.getState().pickUpHome('h1')
    expect(useGame.getState().homeFurniture).toEqual([])
    expect(useGame.getState().inventory).toEqual([{ id: 'chair', count: 1 }])
  })

  it('a flowerpot next to the player is patted with E, and R still puts it in the pocket', () => {
    useGame.setState({ homeFurniture: [{ id: 'h2', itemId: 'flowerpot', x: 0, z: -1, rot: 0 }] })
    standAt(c.x + 0.2, c.z - 0.9)
    const a = findAction()
    expect(a?.kind).toBe('home-act')
    expect(useGame.getState().homeFurniture).toHaveLength(1)
    useGame.getState().pickUpHome('h2')
    expect(useGame.getState().homeFurniture).toEqual([])
  })
})
