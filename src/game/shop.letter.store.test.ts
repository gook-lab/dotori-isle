import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays } from '../core/economy'
import { NEW_SHOP } from '../core/shopTiers'
import { useGame } from './store'

const fresh = useGame.getState()
const D0 = '2026-03-10'

/** 날짜를 옮기고 시계를 한 번 맞춘다. 실제 앱이 30초마다 하는 일과 같다. */
function goTo(day: string) {
  vi.setSystemTime(new Date(`${day}T12:00:00`))
  useGame.getState().syncClock()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${D0}T12:00:00`))
  useGame.setState({ ...fresh, day: D0, letters: [], shop: { ...NEW_SHOP, tier: 1, order: { to: 2, day: D0 } }, miles: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('단계가 오를 때 점장 편지', () => {
  it('큰 가게 문을 여는 날 편지가 한 통 들어오고, 다시 불러도 늘지 않는다', () => {
    goTo(addDays(D0, 2)!)
    const ids = useGame.getState().letters.map((l) => l.id)
    expect(ids).toEqual(['shop-tier-2'])
    goTo(addDays(D0, 3)!)
    expect(useGame.getState().letters.filter((l) => l.id === 'shop-tier-2')).toHaveLength(1)
  })

  it('편지의 선물은 claimLetter 로 받을 수 있다', () => {
    goTo(addDays(D0, 2)!)
    useGame.getState().claimLetter('shop-tier-2')
    const l = useGame.getState().letters.find((x) => x.id === 'shop-tier-2')
    expect(l?.claimed).toBe(true)
  })

  it('공사 중이 아니면 편지가 오지 않는다', () => {
    useGame.setState({ shop: { tier: 1, order: null } })
    goTo(addDays(D0, 2)!)
    expect(useGame.getState().letters.some((l) => l.id.startsWith('shop-tier-'))).toBe(false)
  })
})
