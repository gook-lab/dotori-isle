import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTER_RECIPES } from '../core/recipes'
import { migrateSave, useGame } from './store'

const SUN = '2026-10-18'
const MON = '2026-10-19'
const NEXT_MON = '2026-10-26'
const WEEK = '2026-10-12' // 2026-10-18(일)이 속한 주의 월요일

/** 가구 4종·이웃 2명·상점 1단계로 두면 점수 56점(3★)이 된다(나무 15점은 전부 서 있다고 본다) */
const DECENT = {
  placed: [
    { id: 'p1', itemId: 'chair', x: 0, z: 0, rot: 0 },
    { id: 'p2', itemId: 'lamp', x: 1, z: 0, rot: 0 },
    { id: 'p3', itemId: 'table', x: 2, z: 0, rot: 0 },
    { id: 'p4', itemId: 'flowerpot', x: 3, z: 0, rot: 0 },
  ],
  houses: ['mocha', 'bomi'],
  shop: { tier: 1 as const, order: null },
}

/** 날짜가 넘어가는 아침을 흉내 낸다. 시스템 날짜만 바꾸고 syncClock 을 부른다. */
function morningOf(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  vi.setSystemTime(new Date(y, m - 1, d, 8))
  useGame.getState().syncClock()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  useGame.setState({ day: SUN, letters: [], recipes: [...STARTER_RECIPES], miles: 0, placed: [], houses: [], plants: [], holes: [], ground: [], felled: {}, museum: [], goldCan: false, rating: { day: null, stars: 0, rewarded: 0, since: '2026-10-10' }, shop: { tier: 0, order: null } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('island rating on Monday mornings', () => {
  it('sends the committee letter once a week, on the first open of that week', () => {
    useGame.setState({ day: '2026-10-17' }) // 토요일에 열다가
    morningOf(SUN) // 일요일이 그 주 첫 접속: 주의 월요일(10-12) 키로 편지가 온다
    let s = useGame.getState()
    const letter = s.letters.find((l) => l.id === `rating-${WEEK}`)
    expect(letter).toBeDefined()
    expect(letter!.fromName).toBe('섬 가꾸기 위원회')
    expect(letter!.text).toContain('★')
    expect(s.rating.day).toBe(WEEK)
    // 같은 주에 다시 열어도 편지는 한 통이다
    useGame.setState({ day: SUN })
    morningOf('2026-10-14') // 같은 주 수요일
    s = useGame.getState()
    expect(s.letters.filter((l) => l.id.startsWith('rating-'))).toHaveLength(1)
    // 다음 주 월요일에는 새 편지
    useGame.setState({ day: MON })
    morningOf(NEXT_MON)
    expect(useGame.getState().letters.some((l) => l.id === `rating-${NEXT_MON}`)).toBe(true)
  })

  it('a first open midweek still gets that week letter', () => {
    morningOf('2026-10-21') // 수요일
    expect(useGame.getState().letters.some((l) => l.id === `rating-${MON}`)).toBe(true)
  })

  it('grants the recipe once at three stars and does not repeat it the next Monday', () => {
    useGame.setState({ ...DECENT, day: SUN })
    morningOf(MON)
    let s = useGame.getState()
    expect(s.rating.stars).toBe(3)
    expect(s.rating.rewarded).toBe(3)
    expect(s.recipes).toContain('log-bench')
    expect(s.letters.find((l) => l.id === `rating-${MON}`)!.text).toContain('새 DIY 레시피')
    const count = s.recipes.length
    useGame.setState({ day: MON })
    morningOf(NEXT_MON)
    s = useGame.getState()
    expect(s.recipes.length).toBe(count)
    expect(s.letters.find((l) => l.id === `rating-${NEXT_MON}`)!.text).not.toContain('새 DIY 레시피')
  })

  it('falls back to miles when every recipe is already known', () => {
    useGame.setState({ ...DECENT, day: SUN, recipes: ['log-stool', 'wooden-box', 'log-bench', 'stone-lantern', 'iron-lamp', 'gold-acorn'] })
    morningOf(MON)
    expect(useGame.getState().miles).toBe(150)
  })
})

describe('migrateSave for the rating fields', () => {
  it('fills defaults for old saves', () => {
    const s = migrateSave({ money: 5 })
    expect(s.rating).toEqual({ day: null, stars: 0, rewarded: 0, since: null })
    expect(s.goldCan).toBe(false)
  })

  it('drops a broken reward level and keeps a valid one', () => {
    expect(migrateSave({ rating: { day: MON, stars: 4, rewarded: 4 } }).rating).toEqual({ day: null, stars: 0, rewarded: 0, since: null })
    expect(migrateSave({ rating: { day: MON, stars: 4, rewarded: 3 } }).rating).toEqual({ day: MON, stars: 4, rewarded: 3, since: null })
  })
})

describe('first rating letter for a new player', () => {
  it('waits until play day 3 when no letter has arrived yet', () => {
    // 2026-10-19(월)에 처음 시작했다: 시작일 기록 뒤 이틀이 지나야 첫 편지가 온다
    useGame.setState({ day: MON, rating: { day: null, stars: 0, rewarded: 0, since: MON } })
    morningOf('2026-10-20')
    expect(useGame.getState().letters.some((l) => l.id.startsWith('rating-'))).toBe(false)
    morningOf('2026-10-21')
    expect(useGame.getState().letters.some((l) => l.id === `rating-${MON}`)).toBe(true)
  })
})
