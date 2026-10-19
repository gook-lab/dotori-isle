import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dateKey } from '../core/rng'
import { weatherFor, type Weather } from '../core/weather'
import { SPAWN } from '../core/world'
import { findAction, runAction } from './actions'
import { CATCH_FLY, runtime } from './runtime'
import { migrateSave, useGame } from './store'
import { NEW_SHOP } from '../core/shopTiers'
import type { Plant } from '../core/garden'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())
/** 맑은 날짜. 비 오는 날은 물 주기 안내가 다르게 뜬다. */
const sunny = (() => {
  for (let i = 0; i < 400; i++) {
    const d = dateKey(new Date(2026, 0, 1 + i))
    if (weatherFor(d) === ('sunny' as Weather)) return d
  }
  throw new Error('no sunny day')
})()

/** 꽃은 정수 칸에 심는다. 플레이어는 그 칸의 가운데에 서서 +z 를 본다. dx·dz 는 플레이어 칸 기준 칸 수다. */
const CELL = { x: Math.round(SPAWN.x), z: Math.round(SPAWN.z) }
const flower = (id: string, dx: number, dz: number, watered = false): Plant => ({ id, x: CELL.x + dx, z: CELL.z + dz, color: '#fff', stage: 0, watered })

beforeEach(() => {
  runtime.fishing = { phase: 'idle' }
  runtime.act = null
  runtime.waterFx = null
  runtime.player.x = CELL.x
  runtime.player.z = CELL.z
  runtime.player.facing = 0
  useGame.setState({ placing: null, placed: [], ground: [], collected: [], tool: 'can', tools: ['can'], canLevel: 1, plants: [], stats: {}, money: 0, inventory: [], day: sunny, shop: NEW_SHOP })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('watering can areas in findAction', () => {
  it('the basic can still waters only the nearest flower with no area label', () => {
    useGame.setState({ plants: [flower('a', 0, 0.9)] })
    const a = findAction()
    expect(a?.kind).toBe('water')
    expect(a?.label).toBe('꽃에 물 주기')
    expect(a?.kind === 'water' && a.area).toBe(1)
  })

  it('the 2×2 can offers every dry flower in the square and says the area', () => {
    useGame.setState({ canLevel: 2, plants: [flower('in1', 0, 1), flower('in2', 1, 2), flower('out', 0, 3)] })
    const a = findAction()
    expect(a?.kind).toBe('water')
    expect(a?.label).toBe('물 주기 (2×2)')
    expect(a?.kind === 'water' && a.plants.map((p) => p.id).sort()).toEqual(['in1', 'in2'])
  })

  it('the 3×3 can says the area and switches to 더 주기 when the flowers are all wet', () => {
    useGame.setState({ canLevel: 3, plants: [flower('wet', 0, 1, true)] })
    const a = findAction()
    expect(a?.label).toBe('물 더 주기 (3×3)')
  })

  it('an empty area offers nothing to say, but still swings the can', () => {
    useGame.setState({ canLevel: 3, plants: [] })
    const a = findAction()
    expect(a?.kind).toBe('water')
    expect(a?.label).toBe('')
  })
})

describe('watering an area', () => {
  it('waters every dry flower in the area at once and counts each one for quests', () => {
    useGame.setState({ canLevel: 2, plants: [flower('a', 0, 1), flower('b', 1, 2), flower('c', 0, 3), flower('d', 0, 2, true)] })
    const a = findAction()
    if (!a || a.kind !== 'water') throw new Error('no water action')
    runAction(a)
    const s = useGame.getState()
    expect(s.plants.map((p) => [p.id, p.watered])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
      ['d', true],
    ])
    expect(s.stats.water).toBe(2)
  })

  it('keeps the area on the ground for the watering animation, one tile per cell', () => {
    useGame.setState({ canLevel: 3, plants: [] })
    const a = findAction()
    if (!a || a.kind !== 'water') throw new Error('no water action')
    runAction(a)
    expect(runtime.waterFx?.level).toBe(3)
    expect(runtime.waterFx?.cells).toHaveLength(9)
  })

  it('a 1×1 can turns toward its flower, as before', () => {
    useGame.setState({ canLevel: 1, plants: [flower('side', 1, 0)] })
    const a = findAction()
    if (!a || a.kind !== 'water') throw new Error('no water action')
    runAction(a)
    expect(runtime.player.facing).toBeCloseTo(Math.PI / 2)
    expect(useGame.getState().plants[0].watered).toBe(true)
  })
})

describe('buying a bigger watering can', () => {
  it('the 2×2 can costs acorns and needs the 가게 tier', () => {
    useGame.setState({ money: 1000, shop: { tier: 0, order: null } })
    useGame.getState().buyCanUpgrade(2)
    expect(useGame.getState().canLevel).toBe(1)
    expect(useGame.getState().money).toBe(1000)

    useGame.setState({ shop: { tier: 1, order: null } })
    useGame.getState().buyCanUpgrade(2)
    const s = useGame.getState()
    expect(s.canLevel).toBe(2)
    expect(s.money).toBe(650)
    expect(s.stats.spent).toBe(350)
  })

  it('the 3×3 can is blocked until the 큰 가게 tier and needs the 2×2 first', () => {
    useGame.setState({ money: 9999, canLevel: 1, shop: { tier: 2, order: null } })
    useGame.getState().buyCanUpgrade(3)
    expect(useGame.getState().canLevel).toBe(1)

    useGame.setState({ canLevel: 2 })
    useGame.getState().buyCanUpgrade(3)
    expect(useGame.getState().canLevel).toBe(3)
    expect(useGame.getState().money).toBe(9999 - 900)
  })

  it('an upgrade needs the watering can itself', () => {
    useGame.setState({ money: 9999, tools: [], tool: 'hand', shop: { tier: 1, order: null } })
    useGame.getState().buyCanUpgrade(2)
    expect(useGame.getState().canLevel).toBe(1)
  })
})

describe('save migration for canLevel', () => {
  it('fills a basic can for older saves and keeps a valid level', () => {
    expect(migrateSave({ money: 1, day: today }).canLevel).toBe(1)
    expect(migrateSave({ money: 1, day: today, canLevel: 2 }).canLevel).toBe(2)
    expect(migrateSave({ money: 1, day: today, canLevel: 7 }).canLevel).toBe(1)
  })
})

describe('fishing show-off waits for the fish to fly to the hand', () => {
  it('the caption and the show pose start after CATCH_FLY, not at the catch', () => {
    vi.useFakeTimers()
    useGame.setState({ inventory: [], caption: null })
    useGame.getState().catchFish('sea-bass')
    expect(useGame.getState().caption).toBeNull()
    expect(runtime.act?.kind).not.toBe('show')
    vi.advanceTimersByTime(CATCH_FLY * 1000 - 10)
    expect(useGame.getState().caption).toBeNull()
    vi.advanceTimersByTime(20)
    expect(useGame.getState().caption?.itemId).toBe('sea-bass')
    expect(runtime.act?.kind).toBe('show')
  })
})
