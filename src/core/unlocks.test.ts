import { describe, expect, it } from 'vitest'
import { MUSEUM_DEX } from './museum'
import { ctxOf, daysSinceStart, introLetter, lockedSystem, newlyOpened, nextUnlock, nextUnlockHint, SYSTEMS, systemOpen, type UnlockCtx } from './unlocks'

const TUE = '2026-03-10' // 화요일
const SAT = '2026-03-14' // 토요일(장날)

const ctx = (over: Partial<UnlockCtx> = {}): UnlockCtx => ({
  day: TUE,
  islandStart: TUE,
  questsDone: [],
  dexCount: 0,
  stats: { sold: 0, spent: 0, questsDone: [] },
  ...over,
})

describe('첫날 열림', () => {
  it('opens nothing on the first day with no quests done', () => {
    expect(SYSTEMS.filter((s) => s.open(ctx()))).toEqual([])
    expect(newlyOpened(ctx(), [])).toEqual([])
  })

  it('counts days from the island start, never below zero', () => {
    expect(daysSinceStart({ day: TUE, islandStart: TUE })).toBe(0)
    expect(daysSinceStart({ day: '2026-03-13', islandStart: TUE })).toBe(3)
    expect(daysSinceStart({ day: TUE, islandStart: null })).toBe(0)
    expect(daysSinceStart({ day: '2026-03-01', islandStart: TUE })).toBe(0)
  })
})

describe('기능별 조건', () => {
  it('opens the ATM once the treasure quest is done, with no day requirement', () => {
    expect(systemOpen('atm', ctx())).toBe(false)
    expect(systemOpen('atm', ctx({ questsDone: ['dig'] }))).toBe(true)
  })

  // 날짜 조건은 섬에 온 지 n 일째인 날로 잰다(TUE 가 시작일)
  const dayN = (n: number, over: Partial<UnlockCtx>) => ctx({ day: `2026-03-${10 + n}`, ...over })

  it('opens the island works after the garden quest and two days', () => {
    expect(systemOpen('infra', dayN(1, { questsDone: ['garden'] }))).toBe(false)
    expect(systemOpen('infra', dayN(2, { questsDone: ['garden'] }))).toBe(true)
    expect(systemOpen('infra', dayN(9, { questsDone: [] }))).toBe(false)
  })

  it('opens the ladder after the garden quest and four days', () => {
    expect(systemOpen('ladder', dayN(3, { questsDone: ['garden'] }))).toBe(false)
    expect(systemOpen('ladder', dayN(4, { questsDone: ['garden'] }))).toBe(true)
  })

  it('opens home consultation after the materials quest and three days', () => {
    expect(systemOpen('home', dayN(2, { questsDone: ['materials'] }))).toBe(false)
    expect(systemOpen('home', dayN(3, { questsDone: ['materials'] }))).toBe(true)
    expect(systemOpen('home', dayN(9, { questsDone: ['garden'] }))).toBe(false)
  })

  it('opens the photo mode after the blossom quest and five days', () => {
    expect(systemOpen('photo', dayN(4, { questsDone: ['blossom'] }))).toBe(false)
    expect(systemOpen('photo', dayN(5, { questsDone: ['blossom'] }))).toBe(true)
  })

  it('opens the museum at the museum dex count', () => {
    expect(systemOpen('museum', ctx({ dexCount: MUSEUM_DEX - 1 }))).toBe(false)
    expect(systemOpen('museum', ctx({ dexCount: MUSEUM_DEX }))).toBe(true)
  })

  it('upgrades the stall to a shop on the shop-tier-1 conditions, and the big shop on tier 2', () => {
    expect(systemOpen('shop-1', ctx({ stats: { sold: 1000, spent: 0, questsDone: [] } }))).toBe(false)
    expect(systemOpen('shop-1', ctx({ stats: { sold: 999, spent: 0, questsDone: ['materials'] } }))).toBe(false)
    expect(systemOpen('shop-1', ctx({ stats: { sold: 1000, spent: 0, questsDone: ['materials'] }, questsDone: ['materials'] }))).toBe(true)
    expect(systemOpen('shop-2', ctx({ stats: { sold: 10000, spent: 1500, questsDone: ['newcomer-guriguri'] } }))).toBe(true)
    expect(systemOpen('shop-2', ctx({ stats: { sold: 10000, spent: 0, questsDone: ['newcomer-guriguri'] } }))).toBe(false)
  })

  it('opens the market on the first market day and stays open after it', () => {
    expect(systemOpen('market', ctx({ day: TUE }))).toBe(false)
    expect(systemOpen('market', ctx({ day: SAT }))).toBe(true)
    // 토요일을 지난 월요일에도 장터는 열려 있다
    expect(systemOpen('market', ctx({ day: '2026-03-16', islandStart: TUE }))).toBe(true)
  })

  it('does not open the market before the first Saturday after the island start', () => {
    expect(systemOpen('market', ctx({ day: '2026-03-13', islandStart: TUE }))).toBe(false)
  })
})

describe('소개 편지', () => {
  it('introduces each newly opened system once', () => {
    const c = ctx({ questsDone: ['dig'] })
    const first = newlyOpened(c, [])
    expect(first.map((s) => s.id)).toEqual(['atm'])
    expect(newlyOpened(c, ['atm'])).toEqual([])
  })

  it('writes the intro letter from the committee with the system name', () => {
    const atm = SYSTEMS.find((s) => s.id === 'atm')!
    const l = introLetter(atm, TUE)
    expect(l.id).toBe('intro-atm')
    expect(l.from).toBe('committee')
    expect(l.text.startsWith(`${atm.name} 소식이에요.`)).toBe(true)
    expect(l.gift).toBeNull()
    expect(l.read).toBe(false)
  })
})

describe('다음 열림', () => {
  it('points at the first system in schedule order that is still closed', () => {
    expect(nextUnlock(ctx())?.id).toBe('atm')
    expect(nextUnlock(ctx({ questsDone: ['dig'] }))?.id).toBe('infra')
  })

  it('gives a hint for the next unlock, and nothing once everything is open', () => {
    expect(nextUnlockHint(ctx())).toContain('도토리 ATM')
    const all = ctx({ questsDone: ['dig', 'garden', 'materials', 'blossom', 'newcomer-guriguri'], dexCount: MUSEUM_DEX, stats: { sold: 10000, spent: 1500, questsDone: ['materials', 'newcomer-guriguri'] }, islandStart: TUE, day: '2026-03-20' })
    expect(nextUnlock(all)).toBeNull()
    expect(nextUnlockHint(all)).toBeNull()
  })

  it('reads the save shape for the stats it needs', () => {
    const c = ctxOf({ day: TUE, islandStart: TUE, questsDone: ['dig'], dex: { 'sea-bass': 1 }, stats: { earn: 1200, spent: 3 } })
    expect(c.stats).toEqual({ sold: 1200, spent: 3, questsDone: ['dig'] })
    expect(c.dexCount).toBe(1)
  })
})

describe('잠긴 시설 안내', () => {
  it('잠긴 기능은 이름과 이유(hint)를 돌려주고, 열리면 null 이다', () => {
    const locked = lockedSystem('home', ctx({ day: TUE, islandStart: TUE }))
    expect(locked?.name).toBe('집 상담')
    expect(locked?.hint).toContain('사흘이 지나면')
    expect(lockedSystem('home', ctx({ day: '2026-03-13', islandStart: TUE, questsDone: ['materials'] }))).toBeNull()
  })

  it('ATM 도 같은 방식으로 이유를 알려 준다', () => {
    expect(lockedSystem('atm', ctx())?.hint).toContain('땅속 보물 찾기')
    expect(lockedSystem('atm', ctx({ questsDone: ['dig'] }))).toBeNull()
  })
})
