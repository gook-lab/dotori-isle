import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countOf } from '../core/inventory'
import { VILLAGERS } from '../core/villagers'
import { flushMileToast } from './store'
import { weatherFor } from '../core/weather'
import { canWalk } from '../core/scenery'
import { ROCKS, TREES } from '../core/world'
import { runtime } from './runtime'
import { CHOPS_PER_TREE, FELL_CHOPS, HITS_PER_ROCK, MIN_FRUIT_STANDING, questBoard, saveOf, TOAST_QUEUE_MAX, useGame } from './store'
import { MAX_HOLES } from '../core/holes'

const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({
    ...fresh,
    money: 0,
    inventory: [],
    tools: [],
    ground: [],
    shaken: [],
    chopped: {},
    rockHits: {},
    holes: [],
    felled: {},
    plants: [],
    houses: [],
    stats: {},
    quests: [{ id: 'welcome', baseline: {} }],
    questsDone: [],
    dailyBase: {},
    dailyClaimed: [],
  })
})

describe('quest chain', () => {
  it('welcome completes from shaking and selling, grants a shovel and opens the next quest', () => {
    const s = useGame.getState()
    const fruit = TREES.filter((t) => t.kind === 'fruit')
    for (const t of fruit.slice(0, 3)) s.shakeTree(t)
    useGame.setState({ inventory: [{ id: 'coral', count: 2 }] })
    useGame.getState().sellAll()
    expect(questBoard(useGame.getState()).find((q) => q.def.id === 'welcome')?.done).toBe(true)

    useGame.getState().claimQuest('welcome')
    const after = useGame.getState()
    expect(after.tools).toContain('shovel')
    expect(after.quests.map((q) => q.id)).toEqual(['dig'])
    expect(after.questsDone).toEqual(['welcome'])
    // 다음 퀘스트는 받는 순간의 통계를 기준으로 센다.
    expect(after.quests[0].baseline.shake).toBe(3)
  })

  it('cannot claim an unfinished quest', () => {
    useGame.getState().claimQuest('welcome')
    expect(useGame.getState().questsDone).toEqual([])
  })
})

describe('gathering limits', () => {
  it('only a shake that drops fruit counts toward the shake quest', () => {
    const fruit = TREES.find((t) => t.kind === 'fruit')!
    const pine = TREES.find((t) => t.kind === 'pine')!
    useGame.getState().shakeTree(pine)
    expect(useGame.getState().stats.shake ?? 0).toBe(0)
    useGame.getState().shakeTree(fruit)
    expect(useGame.getState().stats.shake).toBe(1)
    // 오늘 이미 턴 나무를 다시 흔들어도 더 세지 않는다.
    for (let i = 0; i < 5; i++) useGame.getState().shakeTree(fruit)
    expect(useGame.getState().stats.shake).toBe(1)
  })

  it('a tree gives wood three times a day, and the two extra chops only fell it', () => {
    const t = TREES[0]
    for (let i = 0; i < CHOPS_PER_TREE + 1; i++) useGame.getState().chopTree(t)
    expect(useGame.getState().felled[t.id]).toBeUndefined()
    useGame.getState().chopTree(t)
    expect(useGame.getState().stats.chop).toBe(CHOPS_PER_TREE)
    // 앞의 세 번 목재, 쓰러뜨릴 때 목재 세 개
    expect(useGame.getState().ground.filter((g) => g.itemId === 'wood')).toHaveLength(CHOPS_PER_TREE + 3)
    expect(useGame.getState().felled[t.id]).toEqual({ state: 'stump', day: useGame.getState().day })
    expect(runtime.fall?.id).toBe(t.id)
  })

  it('fells a tree on the last of the chops and leaves a stump that stops shakes', () => {
    const t = TREES.find((x) => x.kind === 'fruit')!
    for (let i = 0; i < FELL_CHOPS; i++) useGame.getState().chopTree(t)
    expect(useGame.getState().felled[t.id].state).toBe('stump')
    useGame.getState().shakeTree(t)
    expect(useGame.getState().stats.shake ?? 0).toBe(0)
  })

  it('keeps enough fruit trees standing that the shake quests can still be done', () => {
    const fruit = TREES.filter((t) => t.kind === 'fruit')
    const felled = Object.fromEntries(fruit.slice(0, fruit.length - MIN_FRUIT_STANDING).map((t) => [t.id, { state: 'stump' as const, day: useGame.getState().day }]))
    useGame.setState({ felled })
    const last = fruit[fruit.length - 1]
    for (let i = 0; i < FELL_CHOPS; i++) useGame.getState().chopTree(last)
    expect(useGame.getState().felled[last.id]).toBeUndefined()
    expect(useGame.getState().chopped[last.id]).toBe(FELL_CHOPS - 1)
  })

  it('digging up a stump leaves a sapling, and a stump only comes up once', () => {
    const t = TREES.find((x) => x.kind === 'pine')!
    useGame.setState({ felled: { [t.id]: { state: 'stump', day: useGame.getState().day } } })
    useGame.getState().digStump(t)
    expect(useGame.getState().felled[t.id]).toEqual({ state: 'sapling', day: useGame.getState().day })
    const before = useGame.getState().ground.length
    useGame.getState().digStump(t)
    expect(useGame.getState().ground.length).toBe(before)
  })

  it('digging a hole and filling it keeps the saved list small and capped', () => {
    const s = useGame.getState()
    expect(s.digHole(1, 1)).toBe(true)
    expect(useGame.getState().holes).toHaveLength(1)
    useGame.getState().fillHole(useGame.getState().holes[0].id)
    expect(useGame.getState().holes).toEqual([])
    for (let i = 0; i < MAX_HOLES; i++) useGame.getState().digHole(i * 2, 0)
    expect(useGame.getState().holes).toHaveLength(MAX_HOLES)
    // 앞선 알림이 쌓여 있으면 이번 알림이 뒤에 선다. 이 줄은 방금 알림만 본다.
    useGame.setState({ toast: null, toastQueue: [] })
    expect(useGame.getState().digHole(0, 40)).toBe(false)
    expect(useGame.getState().toast?.text).toContain('가득')
    expect(useGame.getState().holes).toHaveLength(MAX_HOLES)
  })

  it('a treasure dig leaves its hole until it is filled', () => {
    const spot = { id: 'd-dig-0', itemId: 'fossil', x: 3, z: 4 }
    useGame.getState().dig(spot)
    expect(useGame.getState().holes).toEqual([{ id: 'd-dig-0', x: 3, z: 4 }])
    expect(useGame.getState().dug).toEqual(['d-dig-0'])
  })

  it('holes and felled trees are saved', () => {
    useGame.setState({ holes: [{ id: 'h', x: 1, z: 2 }], felled: { 'tree-1': { state: 'sapling', day: '2026-05-01' } } })
    const saved = saveOf(useGame.getState()) as unknown as Record<string, unknown>
    expect(saved.holes).toEqual([{ id: 'h', x: 1, z: 2 }])
    expect(saved.felled).toEqual({ 'tree-1': { state: 'sapling', day: '2026-05-01' } })
  })

  it('a rock gives materials five times a day', () => {
    const r = ROCKS[0]
    for (let i = 0; i < HITS_PER_ROCK + 3; i++) useGame.getState().hitRock(r)
    const drops = useGame.getState().ground
    expect(drops).toHaveLength(HITS_PER_ROCK)
    for (const d of drops) expect(['stone', 'iron', 'gold']).toContain(d.itemId)
  })
})

describe('building houses', () => {
  const v = VILLAGERS.find((x) => x.id === 'guriguri')!

  it('refuses without materials and builds with them, consuming the cost', () => {
    expect(useGame.getState().build(v)).toBe(false)
    useGame.setState({ inventory: [{ id: 'wood', count: 12 }, { id: 'stone', count: 8 }, { id: 'iron', count: 3 }] })
    expect(useGame.getState().build(v)).toBe(true)
    const s = useGame.getState()
    expect(s.houses).toContain('guriguri')
    expect(countOf(s.inventory, 'wood')).toBe(2)
    expect(countOf(s.inventory, 'stone')).toBe(0)
    expect(s.stats['build:guriguri']).toBe(1)
    expect(useGame.getState().build(v)).toBe(false)
  })
})

describe('garden over a day change', () => {
  it('watered seeds grow overnight and blooms count toward quests', () => {
    useGame.setState({
      day: '2000-01-01',
      plants: [
        { id: 'a', x: 0, z: 0, color: '#fff', stage: 2, watered: false },
        { id: 'b', x: 1, z: 0, color: '#fff', stage: 0, watered: false },
      ],
    })
    useGame.getState().water('a')
    useGame.getState().water('a')
    expect(useGame.getState().stats.water).toBe(1)
    useGame.getState().syncClock()
    const s = useGame.getState()
    expect(s.plants.map((p) => p.stage)).toEqual([3, 0])
    expect(s.stats.bloom).toBe(1)
    expect(s.dailyBase.water).toBe(1)
  })
})

describe('house completion does not trap the player', () => {
  it('pushes the player out to the front of the new house', async () => {
    const { runAction } = await import('./actions')
    const { runtime } = await import('./runtime')
    const { canStand } = await import('../core/world')
    const { HOUSE_R } = await import('../core/villagers')
    const v = VILLAGERS.find((x) => x.id === 'mocha')!
    useGame.setState({ inventory: [{ id: 'wood', count: 10 }, { id: 'stone', count: 10 }, { id: 'iron', count: 5 }] })
    // 집터 한가운데 가까이 서서 짓는다.
    runtime.player.x = v.house.x + 0.4
    runtime.player.z = v.house.z
    runAction({ kind: 'build', label: '', villager: v })
    expect(useGame.getState().houses).toContain('mocha')
    expect(Math.hypot(runtime.player.x - v.house.x, runtime.player.z - v.house.z)).toBeGreaterThan(HOUSE_R + 0.3)
    expect(canStand(runtime.player.x, runtime.player.z)).toBe(true)
  })
})

describe('DIY, mileage and travel', () => {
  it('crafts a known recipe from materials and counts it', () => {
    useGame.setState({ recipes: ['log-stool'], inventory: [{ id: 'wood', count: 5 }] })
    useGame.getState().craftItem('log-stool')
    const s = useGame.getState()
    expect(countOf(s.inventory, 'log-stool')).toBe(1)
    expect(countOf(s.inventory, 'wood')).toBe(1)
    expect(s.stats.craft).toBe(1)
  })

  it('refuses unknown recipes', () => {
    useGame.setState({ recipes: [], inventory: [{ id: 'gold', count: 5 }, { id: 'stone', count: 9 }] })
    useGame.getState().craftItem('gold-acorn')
    expect(countOf(useGame.getState().inventory, 'gold-acorn')).toBe(0)
  })

  it('earns miles from milestones and trades them for a ticket and a bigger pocket', () => {
    useGame.setState({ miles: 0, milesClaimed: {}, pocket: 20 })
    const t = TREES.filter((x) => x.kind === 'fruit')
    for (let i = 0; i < 5; i++) useGame.getState().shakeTree(t[i])
    expect(useGame.getState().miles).toBe(100)
    useGame.setState({ miles: 1300 })
    useGame.getState().exchange('trip-ticket')
    useGame.getState().exchange('pocket')
    const s = useGame.getState()
    expect(countOf(s.inventory, 'trip-ticket')).toBe(1)
    expect(s.pocket).toBe(30)
    expect(s.miles).toBe(0)
  })

  it('a recipe card is learned on pickup instead of pocketed', () => {
    useGame.setState({ recipes: ['log-stool'], ground: [{ id: 'rc', itemId: 'recipe-card', x: 0, z: 2 }] })
    useGame.getState().pickGround('rc')
    const s = useGame.getState()
    expect(s.recipes.length).toBe(2)
    expect(countOf(s.inventory, 'recipe-card')).toBe(0)
  })

  it('the pelican takes a ticket and flies the player to the trip island and back', async () => {
    const { vi } = await import('vitest')
    const { runtime } = await import('./runtime')
    const { DOCKS } = await import('../core/world')
    const { onTrip } = await import('../core/island')
    vi.useFakeTimers()
    useGame.setState({ inventory: [{ id: 'trip-ticket', count: 1 }] })
    useGame.getState().talkPelican(DOCKS[0])
    expect(useGame.getState().dialog?.choice?.action).toBe('trip-go')
    useGame.getState().chooseDialog()
    expect(useGame.getState().traveling).toBe(true)
    vi.advanceTimersByTime(800)
    expect(onTrip(runtime.player.x)).toBe(true)
    expect(useGame.getState().island).toBe('trip')
    expect(countOf(useGame.getState().inventory, 'trip-ticket')).toBe(0)
    expect(useGame.getState().stats.trip).toBe(1)

    useGame.getState().talkPelican(DOCKS[1])
    expect(useGame.getState().dialog?.choice?.action).toBe('trip-back')
    useGame.getState().chooseDialog()
    vi.advanceTimersByTime(800)
    expect(onTrip(runtime.player.x)).toBe(false)
    expect(useGame.getState().island).toBe('home')
    vi.useRealTimers()
  })

  it('input during the travel fade is ignored, so a ticket is spent only once', async () => {
    const { vi } = await import('vitest')
    const { onKey } = await import('./controls')
    const { DOCKS } = await import('../core/world')
    vi.useFakeTimers()
    useGame.setState({ inventory: [{ id: 'trip-ticket', count: 2 }], bagOpen: false })
    useGame.getState().talkPelican(DOCKS[0])
    useGame.getState().chooseDialog()
    onKey('KeyE')
    onKey('KeyI')
    useGame.getState().talkPelican(DOCKS[0])
    vi.advanceTimersByTime(800)
    const s = useGame.getState()
    expect(countOf(s.inventory, 'trip-ticket')).toBe(1)
    expect(s.bagOpen).toBe(false)
    expect(s.dialog).toBeNull()
    vi.useRealTimers()
  })

  it('a fish that does not fit in a full pocket is reported as not caught', () => {
    const pocket = useGame.getState().pocket
    useGame.setState({ inventory: Array.from({ length: pocket }, () => ({ id: 'branch', count: 99 })) })
    expect(useGame.getState().catchFish('sea-bass')).toBe(false)
    useGame.setState({ inventory: [] })
    expect(useGame.getState().catchFish('sea-bass')).toBe(true)
  })

  it('opening a panel closes the bag', () => {
    useGame.setState({ bagOpen: true })
    useGame.getState().openPanel('quest')
    expect(useGame.getState().bagOpen).toBe(false)
    useGame.setState({ bagOpen: true })
    useGame.getState().openCloset(false)
    expect(useGame.getState().bagOpen).toBe(false)
  })

  it('without a ticket the pelican only explains', () => {
    useGame.setState({ inventory: [] })
    return import('../core/world').then(({ DOCKS }) => {
      useGame.getState().talkPelican(DOCKS[0])
      expect(useGame.getState().dialog?.choice).toBeNull()
    })
  })
})

describe('closet & letters', () => {
  it('buys clothes only at the stall, wears them, and toggles hats', () => {
    useGame.setState({ money: 1000, closet: ['shirt-sky'], wear: { hat: null, outfit: 'shirt-sky' }, closetShop: false })
    useGame.getState().buyWear('straw-hat')
    expect(useGame.getState().closet).not.toContain('straw-hat')

    useGame.getState().openCloset(true)
    useGame.getState().buyWear('straw-hat')
    let s = useGame.getState()
    expect(s.money).toBe(700)
    expect(s.wear.hat).toBe('straw-hat')
    s.putOn('straw-hat')
    expect(useGame.getState().wear.hat).toBeNull()
    useGame.setState({ money: 0 })
    useGame.getState().buyWear('shirt-berry')
    s = useGame.getState()
    expect(s.closet).not.toContain('shirt-berry')
    expect(s.wear.outfit).toBe('shirt-sky')
  })

  it('claims a letter gift once', () => {
    useGame.setState({ letters: [{ id: 'l1', from: 'mocha', fromName: '모카', day: '', text: '안녕', gift: 'peach', read: false, claimed: false }] })
    useGame.getState().claimLetter('l1')
    useGame.getState().claimLetter('l1')
    const s = useGame.getState()
    expect(countOf(s.inventory, 'peach')).toBe(1)
    expect(s.letters[0]).toMatchObject({ read: true, claimed: true })
  })

  it('a friend sends a morning letter when the day changes', () => {
    useGame.setState({ day: '2000-01-01', friendship: { [VILLAGERS[0].id]: 4 }, letters: [] })
    useGame.getState().syncClock()
    // 월요일에 실행되면 섬 별점 편지도 함께 오므로 주민 편지만 센다
    const friend = useGame.getState().letters.filter((l) => l.from !== 'committee')
    expect(friend).toHaveLength(1)
    expect(friend[0].from).toBe(VILLAGERS[0].id)
  })
})

describe('rain', () => {
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dayWith = (w: string) => {
    for (let i = 0; i < 400; i++) {
      const d = new Date(2026, 0, 1 + i, 12)
      if (weatherFor(keyOf(d)) === w) return d
    }
    throw new Error('no day')
  }

  it('waters every plant on a rainy day and new seeds come up watered', () => {
    vi.useFakeTimers()
    vi.setSystemTime(dayWith('rain'))
    useGame.setState({
      day: keyOf(dayWith('rain')),
      plants: [{ id: 'a', x: 0, z: 0, color: '#fff', stage: 1, watered: false }],
    })
    useGame.getState().syncClock()
    expect(useGame.getState().plants[0].watered).toBe(true)
    vi.useRealTimers()
  })

  it('leaves plants dry on a sunny day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(dayWith('sunny'))
    useGame.setState({ day: keyOf(dayWith('sunny')), plants: [{ id: 'a', x: 0, z: 0, color: '#fff', stage: 1, watered: false }] })
    useGame.getState().syncClock()
    expect(useGame.getState().plants[0].watered).toBe(false)
    vi.useRealTimers()
  })
})

describe('toast queue', () => {
  beforeEach(() => useGame.setState({ toast: null, toastQueue: [] }))

  it('shows overlapping notices in order, one at a time', () => {
    useGame.getState().notify('첫째')
    useGame.getState().notify('둘째')
    useGame.getState().notify('셋째')
    expect(useGame.getState().toast?.text).toBe('첫째')
    expect(useGame.getState().toastQueue.map((t) => t.text)).toEqual(['둘째', '셋째'])
    useGame.getState().dismissToast(useGame.getState().toast!.id)
    expect(useGame.getState().toast?.text).toBe('둘째')
    // 이미 지난 알림의 타이머는 현재 알림을 건드리지 않는다
    useGame.getState().dismissToast(-1)
    expect(useGame.getState().toast?.text).toBe('둘째')
  })

  it('drops the oldest waiting notice when too many pile up', () => {
    for (let i = 0; i < TOAST_QUEUE_MAX + 3; i++) useGame.getState().notify(`n${i}`)
    const q = useGame.getState().toastQueue.map((t) => t.text)
    expect(q).toHaveLength(TOAST_QUEUE_MAX)
    expect(q.at(-1)).toBe(`n${TOAST_QUEUE_MAX + 2}`)
  })

  it('keeps the move-in notice ahead of the achievement it triggers', () => {
    const v = VILLAGERS.find((x) => x.id === 'guriguri')!
    const inv = Object.entries(v.cost).map(([id, count]) => ({ id, count }))
    useGame.setState({ inventory: inv, houses: [], stats: {} })
    expect(useGame.getState().build(v)).toBe(true)
    // 과제 마일은 모아서 한 줄로 뜨므로, 이 자리에서 모인 것을 바로 띄운다
    flushMileToast()
    const texts = [useGame.getState().toast, ...useGame.getState().toastQueue].map((t) => t?.text ?? '')
    expect(texts[0]).toContain('이사 왔어요')
    expect(texts.some((t) => t.includes('섬 건축가'))).toBe(true)
  })
})

describe('a grown shop never traps the player', () => {
  it('moves a player who stood where the bigger shop now stands', () => {
    useGame.setState({ shop: { tier: 0, order: null }, inside: null, inHome: false, island: 'home' })
    runtime.player.x = 0
    runtime.player.z = -9
    useGame.setState({ shop: { tier: 2, order: null } })
    expect(canWalk(runtime.player.x, runtime.player.z)).toBe(true)
  })
})
