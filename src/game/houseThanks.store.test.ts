import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expandCost } from '../core/houseExpand'
import { useGame } from './store'

// 증축은 10-31 아침에 끝나고, 감사 편지는 그다음 날(11-01) 아침에 한 통 온다
beforeEach(() => {
  useGame.setState({
    money: 0,
    day: '2026-10-30',
    home: { stage: 5, loan: 0, order: null },
    houses: ['mocha'],
    expanded: [],
    houseExpand: { villagerId: 'mocha', fund: expandCost('mocha'), ready: '2026-10-31' },
    houseThanks: null,
    letters: [],
    toast: null,
    toastQueue: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('주민 집 증축 감사 편지', () => {
  it('완성 아침에는 기록만 남기고, 다음 날 아침에 주민이 한 통 보낸다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    let s = useGame.getState()
    expect(s.expanded).toEqual(['mocha'])
    expect(s.houseThanks).toEqual({ id: 'mocha', day: '2026-10-31' })
    expect(s.letters.some((l) => l.id === 'house-thanks-mocha')).toBe(false)

    vi.setSystemTime(new Date('2026-11-01T08:00:00'))
    useGame.getState().syncClock()
    s = useGame.getState()
    expect(s.letters.filter((l) => l.id.startsWith('house-thanks-')).map((l) => l.id)).toEqual(['house-thanks-mocha'])
    expect(s.houseThanks).toBeNull()
  })

  it('같은 주민 편지는 한 번만 온다. 다음 아침에 다시 열어도 늘지 않는다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    vi.setSystemTime(new Date('2026-11-01T08:00:00'))
    useGame.getState().syncClock()
    vi.setSystemTime(new Date('2026-11-02T08:00:00'))
    useGame.getState().syncClock()
    expect(useGame.getState().letters.filter((l) => l.id === 'house-thanks-mocha')).toHaveLength(1)
  })
})
