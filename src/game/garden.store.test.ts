import { beforeEach, describe, expect, it } from 'vitest'
import { GARDEN_PERMIT, FENCE_ID, FENCE_PIECES } from '../core/fence'
import { HOME_SITE, NEW_HOME } from '../core/home'
import { runtime } from './runtime'
import { useGame } from './store'

const fresh = useGame.getState()

beforeEach(() => {
  runtime.fishing = { phase: 'idle' }
  useGame.setState({
    ...fresh,
    money: GARDEN_PERMIT.money,
    miles: GARDEN_PERMIT.miles,
    inventory: [],
    pocket: 30,
    placing: null,
    placed: [],
    home: NEW_HOME,
    gardenPermit: undefined,
  })
})

describe('garden permit', () => {
  it('costs 3000 money once and gives twenty fence pieces', () => {
    useGame.getState().buyGardenPermit('money')
    const s = useGame.getState()
    expect(s.gardenPermit).toBe(true)
    expect(s.money).toBe(0)
    expect(s.miles).toBe(GARDEN_PERMIT.miles)
    expect(s.inventory).toEqual([{ id: FENCE_ID, count: GARDEN_PERMIT.pieces }])
  })

  it('can also be bought with miles', () => {
    useGame.getState().buyGardenPermit('miles')
    const s = useGame.getState()
    expect(s.gardenPermit).toBe(true)
    expect(s.miles).toBe(0)
    expect(s.money).toBe(GARDEN_PERMIT.money)
  })

  it('does not charge twice', () => {
    useGame.getState().buyGardenPermit('money')
    useGame.setState({ money: GARDEN_PERMIT.money })
    useGame.getState().buyGardenPermit('money')
    expect(useGame.getState().money).toBe(GARDEN_PERMIT.money)
    expect(useGame.getState().inventory).toEqual([{ id: FENCE_ID, count: GARDEN_PERMIT.pieces }])
  })

  it('refuses without enough money or miles', () => {
    useGame.setState({ money: GARDEN_PERMIT.money - 1, miles: GARDEN_PERMIT.miles - 1 })
    useGame.getState().buyGardenPermit('money')
    useGame.getState().buyGardenPermit('miles')
    const s = useGame.getState()
    expect(s.gardenPermit).toBeUndefined()
    expect(s.inventory).toEqual([])
  })

  it('does not place a fence in the middle of the house', () => {
    useGame.getState().buyGardenPermit('money')
    useGame.setState({ placing: FENCE_ID })
    if (!HOME_SITE) throw new Error('집 터가 있어야 테스트할 수 있어요')
    useGame.getState().placeAt(HOME_SITE.x, HOME_SITE.z)
    expect(useGame.getState().placed).toEqual([])
  })

  it('sells white fence and stone wall bundles for money once the permit is held', () => {
    useGame.setState({ gardenPermit: true, money: 1000 })
    useGame.getState().buyFence('fence-white')
    expect(useGame.getState().money).toBe(500)
    expect(useGame.getState().inventory).toEqual([{ id: 'fence-white', count: FENCE_PIECES }])
    useGame.getState().buyFence('fence-stone')
    expect(useGame.getState().money).toBe(500)
    expect(useGame.getState().inventory.some((x) => x.id === 'fence-stone')).toBe(false)
  })

  it('does not sell fences before the permit', () => {
    useGame.setState({ money: 1000 })
    useGame.getState().buyFence('fence-white')
    expect(useGame.getState().inventory).toEqual([])
    expect(useGame.getState().money).toBe(1000)
  })

  it('paints a garden tile in the ring with the brush, and takes it up again on the same cell', () => {
    useGame.setState({ gardenPermit: true })
    if (!HOME_SITE) throw new Error('집 터가 있어야 테스트할 수 있어요')
    // 놓기는 칸 단위(정수)로만 들어온다
    const x = Math.round(HOME_SITE.x) + 4
    const z = Math.round(HOME_SITE.z)
    useGame.getState().startGardenPaint('deck')
    expect(useGame.getState().placing).toBe('tile-deck')
    useGame.getState().placeAt(x, z)
    expect(useGame.getState().gardenTiles).toBe(`${x},${z}w`)
    useGame.getState().placeAt(x, z)
    expect(useGame.getState().gardenTiles).toBe('')
  })
})

