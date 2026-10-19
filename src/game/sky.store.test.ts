import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

const NIGHT = '2026-10-19'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  useGame.setState({ day: NIGHT, letters: [], wishNight: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wishing on meteor nights', () => {
  it('a wish is recorded once per night', () => {
    useGame.getState().makeWish()
    expect(useGame.getState().wishNight).toBe(NIGHT)
    useGame.getState().makeWish()
    expect(useGame.getState().wishNight).toBe(NIGHT)
  })

  it('the next morning brings the pelican letter with a small gift', () => {
    useGame.getState().makeWish()
    useGame.setState({ day: NIGHT })
    const [y, m, d] = NIGHT.split('-').map(Number)
    vi.setSystemTime(new Date(y, m - 1, d + 1, 8))
    useGame.getState().syncClock()
    const letter = useGame.getState().letters.find((l) => l.id === `wish-${NIGHT}`)
    expect(letter).toBeDefined()
    expect(letter!.gift).toBe('flower-seed')
    expect(letter!.from).toBe('pelican')
  })

  it('no letter when no wish was made', () => {
    const [y, m, d] = NIGHT.split('-').map(Number)
    vi.setSystemTime(new Date(y, m - 1, d + 1, 8))
    useGame.getState().syncClock()
    expect(useGame.getState().letters.some((l) => l.id.startsWith('wish-'))).toBe(false)
  })
})
