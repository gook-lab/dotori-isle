import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { NEW_ISLAND_GIFT } from '../core/islandGift'

beforeEach(() => {
  useGame.setState({ day: '2026-11-30', islandGift: NEW_ISLAND_GIFT, miles: 5000, letters: [], toast: null, toastQueue: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

const at = (iso: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
  useGame.getState().syncClock()
}

describe('따뜻한 모금 편지와 기부 적립', () => {
  it('12월 1일 아침에 위원회 편지가 한 통 온다', () => {
    at('2026-12-01T08:00:00')
    const warm = useGame.getState().letters.filter((l) => l.id === 'warm-fund-2026-12-01')
    expect(warm).toHaveLength(1)
    expect(warm[0].fromName).toBe('섬 가꾸기 위원회')
  })

  it('둘째 날에는 편지가 다시 오지 않는다', () => {
    at('2026-12-02T08:00:00')
    expect(useGame.getState().letters.some((l) => l.id.startsWith('warm-fund'))).toBe(false)
  })

  it('섬 가꾸기가 모두 끝났으면 주간이어도 편지를 보내지 않는다', () => {
    useGame.setState({ islandGift: { built: 99, fund: 0, ready: null } })
    at('2026-12-01T08:00:00')
    expect(useGame.getState().letters.some((l) => l.id.startsWith('warm-fund'))).toBe(false)
  })

  it('기부는 표시한 1.2배로 적립되고, 알림에 적립 값이 붙는다', () => {
    useGame.setState({ day: '2026-12-02' })
    useGame.getState().donateGift(100)
    const s = useGame.getState()
    expect(s.islandGift?.fund).toBe(120)
    expect(s.miles).toBe(4900)
    expect(s.toast?.text).toContain('적립 120마일')
  })
})
