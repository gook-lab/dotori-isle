import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dateKey } from '../core/rng'
import { costLabel } from '../core/items'
import { VILLAGERS, villagerPosition } from '../core/villagers'
import { isMeteorNight } from '../core/skyEvents'
import { weatherFor, type Weather } from '../core/weather'
import { DOCKS, ROCKS, SHOP_DOOR, SPAWN, STALL, TREES } from '../core/world'
import { HOME_SITE } from '../core/home'
import { facedFixture, findAction, houseDoor, runAction, shopGuestsNow, standUp, villagerAt } from './actions'
import { runtime } from './runtime'
import { HITS_PER_ROCK, CHOPS_PER_TREE, useGame } from './store'

/** 그 날씨인 첫 날짜. 날씨는 날짜 문자열로 정해진다. */
const dayWith = (w: Weather) => {
  for (let i = 0; i < 400; i++) {
    const d = dateKey(new Date(2026, 0, 1 + i))
    if (weatherFor(d) === w) return d
  }
  throw new Error(`no ${w} day`)
}

describe('findAction between a villager and furniture', () => {
  const v = VILLAGERS[0]
  const vp = villagerPosition(v, 0)

  beforeEach(() => {
    runtime.vclock[v.id] = 0
    runtime.fishing = { phase: 'idle' }
    runtime.seat = null
    useGame.setState({ placing: null, ground: [], collected: [], tool: 'hand' })
    // 아침으로 고정해 유성우 밤 소원 자리도, 상점 손님(10~18시)으로 빠지는 주민도 끼어들지 않게 한다
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 18, 9, 0))
  })
  afterEach(() => {
    runtime.seat = null
    vi.useRealTimers()
  })

  it('stows furniture when it is closer than the villager', () => {
    useGame.setState({ placed: [{ id: 'f1', itemId: 'flowerpot', x: vp.x + 1.2, z: vp.z, rot: 0 }] })
    runtime.player.x = vp.x + 1.6
    runtime.player.z = vp.z
    expect(findAction()?.kind).toBe('stow')
  })

  it('offers to sit on a chair and stands up from it', () => {
    useGame.setState({ placed: [{ id: 'f1', itemId: 'chair', x: vp.x + 1.2, z: vp.z, rot: 0 }] })
    runtime.player.x = vp.x + 1.6
    runtime.player.z = vp.z
    const a = findAction()
    expect(a?.kind).toBe('use')
    expect(a?.label).toContain('앉기')
    runAction(a!)
    expect(runtime.seat?.id).toBe('f1')
    expect(findAction()?.kind).toBe('stand')
    standUp()
    expect(runtime.seat).toBeNull()
    expect(Math.hypot(runtime.player.x - (vp.x + 1.2), runtime.player.z - vp.z)).toBeGreaterThan(0.5)
  })

  it('toggles a lamp on and off', () => {
    useGame.setState({ placed: [{ id: 'l1', itemId: 'lamp', x: vp.x + 1.2, z: vp.z, rot: 0 }] })
    runtime.player.x = vp.x + 1.6
    runtime.player.z = vp.z
    runAction(findAction()!)
    expect(useGame.getState().placed[0].off).toBe(true)
    expect(findAction()?.label).toContain('켜기')
  })

  it('talks when the villager is closer', () => {
    useGame.setState({ placed: [{ id: 'f1', itemId: 'chair', x: vp.x + 1.8, z: vp.z, rot: 0 }] })
    runtime.player.x = vp.x + 0.6
    runtime.player.z = vp.z
    expect(findAction()?.kind).toBe('talk')
  })
})

describe('findAction for a meteor-night wish on a bench', () => {
  // 유성우 밤(맑은 날 해시 조건)을 찾아 그 날 밤 20시에 고정한다
  const meteorDay = () => {
    for (let i = 0; i < 2000; i++) {
      const d = dateKey(new Date(2026, 0, 1 + i))
      if (isMeteorNight(d, weatherFor(d))) return d
    }
    throw new Error('no meteor night')
  }

  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    runtime.seat = null
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], plants: [], tool: 'hand', inHome: false, inside: null, wishNight: null })
  })
  afterEach(() => {
    runtime.seat = null
    vi.useRealTimers()
  })

  it('offers a wish while standing outdoors on a meteor night, once per night', () => {
    const d = meteorDay()
    const [y, m, dd] = d.split('-').map(Number)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(y, m - 1, dd, 21, 0))
    useGame.setState({ day: d })
    runtime.player.x = 0
    runtime.player.z = 0
    expect(findAction()?.kind).toBe('wish')
    useGame.setState({ wishNight: d })
    expect(findAction()).toBeNull()
  })

  it('keeps stand on a bench even on a meteor night', () => {
    const d = meteorDay()
    const [y, m, dd] = d.split('-').map(Number)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(y, m - 1, dd, 21, 0))
    useGame.setState({ day: d })
    runtime.seat = { id: 'f1', x: 0, z: 0, y: 0.74, facing: 0 }
    expect(findAction()?.kind).toBe('stand')
    expect(findAction()?.label).toBe('일어나기 · R 소원 빌기')
    useGame.setState({ wishNight: d })
    expect(findAction()?.label).toBe('일어나기')
  })
})

describe('findAction for a moved-in newcomer', () => {
  const g = VILLAGERS.find((v) => v.id === 'guriguri')!

  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    runtime.vclock[g.id] = 0
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], plants: [], tool: 'hand', houses: ['guriguri'], inside: null, inHome: false, recruits: [] })
  })
  afterEach(() => vi.useRealTimers())

  // 시각을 고정해야 낮·밤 판정이 실행 시간에 흔들리지 않는다
  const at = (hour: number) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 18, hour, 0))
  }

  // 손님으로 상점에 와 있는 날과 아닌 날을 골라 둔다(손님이면 바깥 주민과 말을 걸 수 없다)
  const dayWithGuest = (wanted: boolean) => {
    for (let i = 0; i < 400; i++) {
      useGame.setState({ day: dateKey(new Date(2026, 0, 1 + i)) })
      if (shopGuestsNow().includes(g.id) === wanted) return useGame.getState().day
    }
    throw new Error('no matching day')
  }

  it('offers a talk prompt when the player stands near the newcomer by day', () => {
    at(14)
    useGame.setState({ day: dayWithGuest(false) })
    const p = villagerAt(g, ['guriguri'])
    expect(p.home).toBe(false)
    runtime.player.x = p.x + 1
    runtime.player.z = p.z
    const a = findAction()
    expect(a?.kind).toBe('talk')
    expect(a?.kind === 'talk' && a.villager.id).toBe('guriguri')
  })

  it('does not offer a talk prompt to a villager who is shopping in the raccoon shop', () => {
    at(14)
    useGame.setState({ day: dayWithGuest(true) })
    const p = villagerAt(g, ['guriguri'])
    runtime.player.x = p.x + 1
    runtime.player.z = p.z
    expect(findAction()?.kind).not.toBe('talk')
  })

  it('offers the house door at night, when the newcomer is inside', () => {
    at(22)
    expect(villagerAt(g, ['guriguri']).home).toBe(true)
    const door = houseDoor(g)
    runtime.player.x = door.x
    runtime.player.z = door.z
    expect(findAction()?.kind).toBe('enter')
  })
})

describe('findAction at a pelican dock', () => {
  // 펠리 자리(여행 섬 부두)에서 1 걸음 떨어진 안쪽에 선다
  const dock = DOCKS[1]
  const stand = () => {
    runtime.player.x = dock.x + (dock.arrive.x - dock.x) * 0.5
    runtime.player.z = dock.z + (dock.arrive.z - dock.z) * 0.5
    runtime.player.facing = 0
  }

  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    runtime.seat = null
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], plants: [], tool: 'hand', inHome: false, inside: null })
    stand()
  })

  it('beats a pebble that is behind the player', () => {
    useGame.setState({ ground: [{ id: 'g1', itemId: 'stone', x: runtime.player.x, z: runtime.player.z - 0.3 }] })
    expect(findAction()?.kind).toBe('pelican')
  })

  it('still picks up a pebble that is clearly closer and in front', () => {
    useGame.setState({ ground: [{ id: 'g1', itemId: 'stone', x: runtime.player.x, z: runtime.player.z + 0.1 }] })
    expect(findAction()?.kind).toBe('pickup')
  })

  it('never lays a shell within the dock radius', async () => {
    const { generateDay } = await import('../core/daily')
    const { nearDock } = await import('../core/world')
    for (let d = 1; d <= 20; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      for (const sh of generateDay(day).shells) expect(nearDock(sh.x, sh.z, 2.2)).toBe(false)
    }
  })
})

// 집터 근처의 바위는 집 짓기 안내가 먼저 뜨므로 빈 바위를 고른다
const quietRock = () => ROCKS.find((r) => VILLAGERS.every((v) => Math.hypot(r.x - v.house.x, r.z - v.house.z) > 4)) ?? ROCKS[0]

describe('findAction for watering, rocks and pebbles', () => {
  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], plants: [], tool: 'hand' })
    runtime.player.x = SPAWN.x
    runtime.player.z = SPAWN.z
    runtime.player.facing = 0
  })

  it('waters an unwatered plant beside the player before a watered one in front', () => {
    // 앞(+z 0.9)에는 물 준 꽃, 옆(+x 1.0)에는 마른 꽃
    useGame.setState({
      tool: 'can',
      plants: [
        { id: 'wet', x: SPAWN.x, z: SPAWN.z + 0.9, color: '#fff', stage: 0, watered: true },
        { id: 'dry', x: SPAWN.x + 1, z: SPAWN.z + 0.2, color: '#fff', stage: 0, watered: false },
      ],
    })
    const a = findAction()
    expect(a?.kind).toBe('water')
    expect(a?.kind === 'water' && a.plants[0]?.id).toBe('dry')
    expect(a?.label).toBe('꽃에 물 주기')
  })

  it('falls back to a watered plant when every plant in reach is already watered', () => {
    useGame.setState({ tool: 'can', day: dayWith('sunny'), plants: [{ id: 'wet', x: SPAWN.x, z: SPAWN.z + 0.9, color: '#fff', stage: 0, watered: true }] })
    expect(findAction()?.label).toBe('물 더 주기')
  })

  it('does not offer to water again a plant that rain already wet', () => {
    useGame.setState({ tool: 'can', day: dayWith('rain'), plants: [{ id: 'wet', x: SPAWN.x, z: SPAWN.z + 0.9, color: '#fff', stage: 0, watered: true }] })
    const a = findAction()
    expect(a?.kind).toBe('hint')
    expect(a?.label).toBe('비가 와서 촉촉해요')
  })

  it('tells a hand, shovel or axe holder to use the watering can beside a dry flower', () => {
    for (const tool of ['hand', 'shovel', 'axe'] as const) {
      useGame.setState({ tool, day: dayWith('sunny'), plants: [{ id: 'dry', x: SPAWN.x + 0.6, z: SPAWN.z, color: '#fff', stage: 0, watered: false }] })
      const a = findAction()
      expect(a?.kind, tool).toBe('hint')
      expect(a?.label, tool).toBe('물뿌리개(5)로 물을 줘요')
    }
  })

  it('hints that a shovel or axe is needed when a bare hand stands by a rock', () => {
    const r = quietRock()
    runtime.player.x = r.x - 0.6
    runtime.player.z = r.z
    const a = findAction()
    expect(a?.kind).toBe('hint')
    expect(a?.label).toContain('삽이나 도끼')
  })

  it('hits the rock instead of a pebble on the ground when a shovel faces the rock', () => {
    const r = quietRock()
    // 바위 앞 1 칸에 서서 바위를 본다. 돌멩이는 발밑 가까이.
    runtime.player.x = r.x - 1
    runtime.player.z = r.z
    runtime.player.facing = Math.PI / 2
    useGame.setState({ tool: 'shovel', ground: [{ id: 'g1', itemId: 'stone', x: runtime.player.x + 0.2, z: runtime.player.z }] })
    expect(findAction()?.kind).toBe('hit')
    // 맨손이면 돌멩이를 줍는다
    useGame.setState({ tool: 'hand' })
    expect(findAction()?.kind).toBe('pickup')
  })

  it('keeps chopping a tree the axe faces even with wood lying at the feet', () => {
    const t = TREES.find((x) => !ROCKS.some((r) => Math.hypot(r.x - x.x, r.z - x.z) < 3))!
    runtime.player.x = t.x - 1
    runtime.player.z = t.z
    runtime.player.facing = Math.PI / 2
    useGame.setState({ tool: 'axe', ground: [{ id: 'w1', itemId: 'wood', x: runtime.player.x + 0.2, z: runtime.player.z }] })
    expect(findAction()?.kind).toBe('chop')
    // 돌아서면 목재를 줍는다
    runtime.player.facing = -Math.PI / 2
    expect(findAction()?.kind).toBe('pickup')
  })

  it('still picks up a pebble when the shovel-holder stands with the rock behind them', () => {
    const r = quietRock()
    runtime.player.x = r.x + 1
    runtime.player.z = r.z
    runtime.player.facing = Math.PI / 2
    useGame.setState({ tool: 'shovel', ground: [{ id: 'g1', itemId: 'stone', x: runtime.player.x + 0.2, z: runtime.player.z }] })
    expect(findAction()?.kind).toBe('pickup')
  })
})

describe('findAction for exhausted trees and rocks', () => {
  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], plants: [], houses: [], recruits: [], tool: 'hand', chopped: {}, rockHits: {} })
    runtime.player.x = SPAWN.x
    runtime.player.z = SPAWN.z
    runtime.player.facing = 0
  })

  it('offers to fell a tree that is already spent for today instead of a hint', () => {
    const pine = TREES.find((t) => t.kind === 'pine')!
    runtime.player.x = pine.x
    runtime.player.z = pine.z
    // 가까이 있는 나무를 모두 오늘 다 벤 상태로 만든다
    const near = TREES.filter((t) => Math.hypot(t.x - pine.x, t.z - pine.z) < 2)
    useGame.setState({ tool: 'axe', chopped: Object.fromEntries(near.map((t) => [t.id, CHOPS_PER_TREE])) })
    const a = findAction()
    expect(a?.kind).toBe('chop')
    expect(a?.label).toBe('나무 베어 넘기기')
  })

  it('shakes a tree even while holding the watering can', () => {
    const tree = TREES.find((t) => t.kind !== 'pine' && !ROCKS.some((r) => Math.hypot(r.x - t.x, r.z - t.z) < 3))!
    runtime.player.x = tree.x + 1
    runtime.player.z = tree.z
    useGame.setState({ tool: 'can' })
    expect(findAction()?.kind).toBe('shake')
  })

  it('does not offer to shake a fruit tree already shaken today', () => {
    const tree = TREES.find((t) => t.kind === 'fruit' && !TREES.some((o) => o !== t && Math.hypot(o.x - t.x, o.z - t.z) < 4) && !ROCKS.some((r) => Math.hypot(r.x - t.x, r.z - t.z) < 3))!
    runtime.player.x = tree.x + 1
    runtime.player.z = tree.z
    useGame.setState({ tool: 'hand', shaken: [] })
    expect(findAction()).toMatchObject({ kind: 'shake', tree: { id: tree.id } })
    useGame.setState({ shaken: [tree.id] })
    const act = findAction()
    expect(act?.kind === 'shake' ? act.tree.id : null).not.toBe(tree.id)
  })

  it('chops a fresh tree in reach before a spent one', () => {
    const [a, b] = TREES.flatMap((x) => TREES.filter((y) => y !== x && Math.hypot(x.x - y.x, x.z - y.z) < 3.5).map((y) => [x, y] as const))[0]
    runtime.player.x = (a.x + b.x) / 2
    runtime.player.z = (a.z + b.z) / 2
    useGame.setState({ tool: 'axe', chopped: { [a.id]: CHOPS_PER_TREE } })
    const act = findAction()
    expect(act?.kind).toBe('chop')
    expect(act?.kind === 'chop' && act.tree.id).toBe(b.id)
  })

  it('says a broken rock is done for today, and a pebble on the ground still wins', () => {
    const r = quietRock()
    runtime.player.x = r.x - 1
    runtime.player.z = r.z
    runtime.player.facing = Math.PI / 2
    useGame.setState({ tool: 'shovel', rockHits: { [r.id]: HITS_PER_ROCK } })
    expect(findAction()?.label).toBe('오늘은 다 캤어요')
    useGame.setState({ ground: [{ id: 'g2', itemId: 'stone', x: runtime.player.x + 0.2, z: runtime.player.z }] })
    expect(findAction()?.kind).toBe('pickup')
  })

  it('a rock that is still open in front wins over the villager plot prompt', () => {
    // 집터 바로 곁에 바위를 하나 더 두고, 그 사이에 서서 바위를 본다. 언덕 배치가 바뀌어도 같은 상황이 된다.
    const v = VILLAGERS.find((x) => !x.guest)!
    const r = { id: 'test-rock', x: v.house.x, z: v.house.z, scale: 1 }
    ROCKS.push(r)
    runtime.player.x = v.house.x + 1
    runtime.player.z = v.house.z
    runtime.player.facing = Math.atan2(r.x - runtime.player.x, r.z - runtime.player.z)
    useGame.setState({ tool: 'shovel' })
    expect(findAction()?.kind).toBe('hit')
    useGame.setState({ tool: 'axe' })
    expect(findAction()?.kind).toBe('hit')
    // 맨손이면 집 짓기 안내가 뜨고, 재료를 함께 보여 준다
    useGame.setState({ tool: 'hand' })
    const build = findAction()
    expect(build?.kind).toBe('build')
    expect(build?.label).toBe(`${v.name}의 집 짓기 · ${costLabel(v.cost)}`)
  })
})

/** 플레이어를 두고 바라보는 앞 자리(0.9 칸)가 땅 파기가 되는 곳을 찾는다. 다른 상호작용이 없는 자리만 고른다. */
const digSpot = () => {
  const s = useGame.getState()
  for (let x = -30; x <= 30; x += 1)
    for (let z = -30; z <= 30; z += 1) {
      runtime.player.x = x
      runtime.player.z = z
      runtime.player.facing = 0
      if (findAction()?.kind === 'dig' && findAction()?.label === '땅 파기' && s.holes.length === 0) return { x, z }
    }
  throw new Error('no dig spot')
}

describe('shovel: dig anywhere, fill holes, dig up stumps', () => {
  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], plants: [], houses: [], recruits: [], tool: 'shovel', holes: [], felled: {}, dug: [], chopped: {}, rockHits: {} })
    runtime.player.facing = 0
  })

  it('shows 땅 파기 on plain grass and digs a hole where the shovel points', () => {
    const spot = digSpot()
    const a = findAction()
    expect(a?.kind).toBe('dig')
    expect(a?.label).toBe('땅 파기')
    runAction(a!)
    const holes = useGame.getState().holes
    expect(holes).toHaveLength(1)
    expect(holes[0].x).toBeCloseTo(spot.x, 5)
    expect(holes[0].z).toBeCloseTo(spot.z + 0.9, 5)
  })

  it('fills a hole in reach with the shovel, and the hole is gone', () => {
    const p = runtime.player
    useGame.setState({ holes: [{ id: 'h1', x: p.x, z: p.z + 0.9 }] })
    const a = findAction()
    expect(a?.kind).toBe('fill')
    expect(a?.label).toBe('구멍 메우기')
    runAction(a!)
    expect(useGame.getState().holes).toEqual([])
  })

  it('digs up a stump in reach and leaves a sapling', () => {
    const tree = TREES.find((t) => !ROCKS.some((r) => Math.hypot(r.x - t.x, r.z - t.z) < 4))!
    runtime.player.x = tree.x - 0.9
    runtime.player.z = tree.z
    runtime.player.facing = Math.PI / 2
    useGame.setState({ felled: { [tree.id]: { state: 'stump', day: useGame.getState().day } } })
    const a = findAction()
    expect(a?.kind).toBe('stump')
    expect(a?.label).toBe('그루터기 파내기')
    runAction(a!)
    expect(useGame.getState().felled[tree.id]).toEqual({ state: 'sapling', day: useGame.getState().day })
    expect(findAction()?.kind).not.toBe('stump')
  })

  it('a bare hand or a standing tree never offers the stump action', () => {
    const tree = TREES.find((t) => t.kind === 'fruit')!
    runtime.player.x = tree.x - 0.9
    runtime.player.z = tree.z
    runtime.player.facing = Math.PI / 2
    useGame.setState({ felled: { [tree.id]: { state: 'stump', day: useGame.getState().day } }, tool: 'hand' })
    expect(findAction()?.kind).not.toBe('stump')
  })
})

describe('axe: extra chops fell a tree', () => {
  it('a tree in reach gets the chop action even after its wood is spent', () => {
    const t = TREES.find((x) => x.kind === 'fruit')!
    runtime.player.x = t.x + 1
    runtime.player.z = t.z
    useGame.setState({ tool: 'axe', chopped: { [t.id]: CHOPS_PER_TREE }, felled: {} })
    const a = findAction()
    expect(a?.kind === 'chop' && a.tree.id).toBe(t.id)
  })
})

describe('net: a free swing with nothing to catch', () => {
  it('swings with no prompt label when no bug is in reach', () => {
    useGame.setState({ tool: 'net', placed: [], ground: [], houses: [], holes: [], felled: {}, caught: [] })
    let found = false
    for (let x = -20; x <= 20 && !found; x += 1)
      for (let z = -20; z <= 20 && !found; z += 1) {
        runtime.player.x = x
        runtime.player.z = z
        const a = findAction()
        if (a?.kind === 'swing') found = true
      }
    expect(found).toBe(true)
    const a = findAction()!
    expect(a.label).toBe('')
    runAction(a)
    expect(runtime.act?.kind).toBe('swing')
  })
})

describe('facedFixture — 마주 본 가판대 우선', () => {
  const base = { day: '2026-10-19', dex: {}, shop: { tier: 1, order: null } as never }
  // 대상을 정면에 두고 서는 자리와 방향
  const facing = (x: number, z: number, tx: number, tz: number) => ({ x, z, facing: Math.atan2(tx - x, tz - z) })

  it('picks the clothing stall when the player stands in front of it', () => {
    const p = facing(STALL.x + 1.2, STALL.z, STALL.x, STALL.z)
    expect(facedFixture(p, { ...base, stats: { shake: 3 } })?.kind).toBe('stall')
  })

  it('hides the stall until the first shake goal is done', () => {
    const p = facing(STALL.x + 1.2, STALL.z, STALL.x, STALL.z)
    expect(facedFixture(p, { ...base, stats: { shake: 0 } })?.kind).not.toBe('stall')
  })

  it('picks nothing when the player stands at the stall but looks away', () => {
    const p = { x: STALL.x + 1.2, z: STALL.z, facing: Math.atan2(1, 0) }
    expect(facedFixture(p, { ...base, stats: { shake: 3 } })).toBeNull()
  })

  it('picks the shop door when facing it up close', () => {
    const p = facing(SHOP_DOOR.x, SHOP_DOOR.z + 1.2, SHOP_DOOR.x, SHOP_DOOR.z)
    expect(facedFixture(p, { ...base, stats: { shake: 3 } })?.kind).toBe('shop-enter')
  })

  it('stays empty far from every fixture', () => {
    expect(facedFixture({ x: 500, z: 500, facing: 0 }, { ...base, stats: {} })).toBeNull()
  })
})

describe('findAction at the waterfall', () => {
  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    useGame.setState({ placing: null, ground: [], collected: [], tool: 'hand', toast: null, toastQueue: [] })
  })

  it('offers to look at the waterfall and says a line about it', () => {
    runtime.player.x = -21.5
    runtime.player.z = 18.6
    runtime.player.facing = 0
    const a = findAction()
    expect(a?.kind).toBe('spout')
    runAction(a!)
    expect(['물소리가 시원해요', '물방울이 튀어 얼굴이 시원해요', '폭포가 쏴아 소리를 내요']).toContain(useGame.getState().toast?.text)
  })
})

describe('findAction at the home door with a villager nearby', () => {
  beforeEach(() => {
    runtime.fishing = { phase: 'idle' }
    runtime.seat = null
    useGame.setState({ placing: null, placed: [], ground: [], collected: [], tool: 'hand' })
    // 낮으로 고정해 밤 행동이 끼어들지 않게 한다
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 18, 14, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('offers to enter the home, not a talk, when the player faces the door and a villager is in talk range', () => {
    const door = HOME_SITE!.door
    let met = 0
    for (const v of VILLAGERS) {
      for (let t = 0; t < 600; t += 5) {
        runtime.vclock[v.id] = t
        const at = villagerAt(v, useGame.getState().houses)
        const dx = at.x - door.x
        const dz = at.z - door.z
        const d = Math.hypot(dx, dz)
        // 주민이 현관 원 바로 밖에 있을 때만 본다(대화 거리 1.9 안에 들도록 문 앞 1.0 에 선다)
        if (d < 1.5 || d > 2.4) continue
        const px = door.x + (dx / d) * 1.0
        const pz = door.z + (dz / d) * 1.0
        runtime.player.x = px
        runtime.player.z = pz
        runtime.player.facing = Math.atan2(door.x - px, door.z - pz)
        expect(Math.hypot(at.x - px, at.z - pz), `${v.id} t=${t}`).toBeLessThan(1.9)
        expect(findAction()?.kind, `${v.id} t=${t}`).toBe('home-door')
        met++
      }
    }
    // 주민이 대화 거리 안에 든 경우가 실제로 있었는지 확인해, 빈 통과를 막는다
    expect(met).toBeGreaterThan(0)
  })
})
