import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countOf } from '../core/inventory'
import { migrateSave, useGame } from './store'

const EMPTY_FESTIVAL = { day: null, n: 0, offered: [], claimed: [] }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  useGame.setState({ day: '2026-07-13', letters: [], inventory: [], festival: EMPTY_FESTIVAL, night: false, stats: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

/** 날짜가 넘어가는 아침을 흉내 낸다. */
function morningOf(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  vi.setSystemTime(new Date(y, m - 1, d, 8))
  useGame.getState().syncClock()
}

describe('festival eve letter and morning', () => {
  it('sends the committee letter the day before a festival', () => {
    morningOf('2026-07-14')
    const eve = useGame.getState().letters.find((l) => l.id === 'festival-eve-2026-07-15')
    expect(eve).toBeDefined()
    expect(eve!.fromName).toBe('섬 가꾸기 위원회')
    expect(eve!.text).toContain('불꽃놀이')
  })

  it('no eve letter when tomorrow is an ordinary day', () => {
    morningOf('2026-07-10')
    expect(useGame.getState().letters.some((l) => l.id.startsWith('festival-eve-'))).toBe(false)
  })
})

describe('summer fireworks task', () => {
  it('sitting down at night on the festival day finishes it and mails the lantern', () => {
    useGame.setState({ day: '2026-07-15', night: true })
    useGame.getState().sat('chair')
    const s = useGame.getState()
    expect(s.festival.claimed).toEqual(['2026-07-15'])
    const reward = s.letters.find((l) => l.id === 'festival-reward-2026-07-15')
    expect(reward?.gift).toBe('paper-lantern')
    expect(reward?.claimed).toBe(false)
  })

  it('sitting in daylight does not count', () => {
    useGame.setState({ day: '2026-07-15', night: false })
    useGame.getState().sat('chair')
    expect(useGame.getState().festival.claimed).toEqual([])
  })

  it('a finished festival does not reward twice', () => {
    useGame.setState({ day: '2026-07-15', night: true })
    useGame.getState().sat('chair')
    useGame.getState().sat('chair')
    expect(useGame.getState().letters.filter((l) => l.id === 'festival-reward-2026-07-15')).toHaveLength(1)
  })
})

describe('fireworks watching', () => {
  it('watching at night on the summer festival counts as the sit task', () => {
    useGame.setState({ day: '2026-07-15', night: true })
    useGame.getState().watchFireworks()
    expect(useGame.getState().festival.claimed).toEqual(['2026-07-15'])
  })

  it('watching in daylight does nothing', () => {
    useGame.setState({ day: '2026-07-15', night: false })
    useGame.getState().watchFireworks()
    expect(useGame.getState().festival.claimed).toEqual([])
  })
})

describe('autumn harvest offers', () => {
  beforeEach(() => {
    useGame.setState({ day: '2026-10-15', inventory: [{ id: 'peach', count: 3 }, { id: 'wood', count: 2 }] })
  })

  it('three fruits to the host complete the festival', () => {
    const s = useGame.getState()
    s.festivalOffer('peach')
    s.festivalOffer('peach')
    expect(useGame.getState().festival.claimed).toEqual([])
    useGame.getState().festivalOffer('peach')
    const after = useGame.getState()
    expect(countOf(after.inventory, 'peach')).toBe(0)
    expect(after.festival.claimed).toEqual(['2026-10-15'])
    expect(after.letters.find((l) => l.id === 'festival-reward-2026-10-15')?.gift).toBe('harvest-scarecrow')
  })

  it('a non-fruit is refused and kept', () => {
    useGame.getState().festivalOffer('wood')
    expect(countOf(useGame.getState().inventory, 'wood')).toBe(2)
    expect(useGame.getState().festival.n).toBe(0)
  })

  it('offers do nothing without an offer festival today', () => {
    useGame.setState({ day: '2026-10-16' })
    useGame.getState().festivalOffer('peach')
    expect(countOf(useGame.getState().inventory, 'peach')).toBe(3)
  })
})

describe('festival progress per day', () => {
  it('progress from another day does not carry over', () => {
    useGame.setState({ day: '2026-07-15', night: true, festival: { day: '2026-07-14', n: 0, offered: [], claimed: [] } })
    useGame.getState().sat('chair')
    expect(useGame.getState().festival.claimed).toEqual(['2026-07-15'])
  })
})

describe('migrateSave for the festival field', () => {
  it('fills an empty record for old saves', () => {
    expect(migrateSave({ money: 1 }).festival).toEqual(EMPTY_FESTIVAL)
  })

  it('drops a broken record and keeps a valid one', () => {
    expect(migrateSave({ festival: { day: 'nope', n: 1, offered: [], claimed: [] } }).festival).toEqual(EMPTY_FESTIVAL)
    const ok = { day: '2026-10-15', n: 2, offered: ['peach'], claimed: [] }
    expect(migrateSave({ festival: ok }).festival).toEqual(ok)
  })
})
