import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { NEW_FLOWER_WEEK } from '../core/flowerWeek'

beforeEach(() => {
  useGame.setState({ day: '2026-03-31', flowerWeek: NEW_FLOWER_WEEK, letters: [], toast: null, toastQueue: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

const at = (iso: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
  useGame.getState().syncClock()
}

describe('꽃 심기 주간 편지', () => {
  it('4월 1일 아침에 위원회 편지가 한 통 온다', () => {
    at('2026-04-01T08:00:00')
    expect(useGame.getState().letters.filter((l) => l.id === 'flower-week-2026-04-01')).toHaveLength(1)
  })

  it('둘째 날에는 다시 오지 않는다', () => {
    at('2026-04-02T08:00:00')
    expect(useGame.getState().letters.some((l) => l.id.startsWith('flower-week'))).toBe(false)
  })
})
