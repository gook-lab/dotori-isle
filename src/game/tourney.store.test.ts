import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEW_SHOP } from '../core/shopTiers'
import { TOURNEY_LEN_MS } from '../core/tourney'
import { runtime } from './runtime'
import { migrateSave, useGame } from './store'

const SUN = '2026-03-15'
const fresh = useGame.getState()

/** 일요일 오전 열 시로 맞춘다(currentHour 는 로컬 시각을 쓴다) */
function atSunday(hour: number) {
  vi.setSystemTime(new Date(2026, 2, 15, hour, 0, 0))
}

beforeEach(() => {
  vi.useFakeTimers()
  atSunday(10)
  runtime.tourney = null
  useGame.setState({ ...fresh, day: SUN, money: 0, inventory: [], pocket: 20, tourney: { points: 0, lastDay: null }, shop: NEW_SHOP })
})

afterEach(() => {
  runtime.tourney = null
  vi.useRealTimers()
})

describe('낚시 대회 판', () => {
  it('does not start outside the Sunday window', () => {
    atSunday(8)
    useGame.getState().startTourney()
    expect(runtime.tourney).toBeNull()
  })

  it('starts inside the window and only once that day', () => {
    useGame.getState().startTourney()
    expect(runtime.tourney?.day).toBe(SUN)
    expect(useGame.getState().tourney.lastDay).toBe(SUN)
    useGame.getState().startTourney()
    expect(runtime.tourney?.count).toBe(0)
  })

  it('ends after three minutes and gives points for the catches', () => {
    useGame.getState().startTourney()
    runtime.tourney = { ...runtime.tourney!, count: 9 }
    vi.advanceTimersByTime(TOURNEY_LEN_MS)
    useGame.getState().finishTourney()
    expect(runtime.tourney).toBeNull()
    expect(useGame.getState().tourney).toEqual({ points: 2, lastDay: SUN })
  })

  it('ends early when the window closes, keeping the catches so far', () => {
    useGame.getState().startTourney()
    runtime.tourney = { ...runtime.tourney!, count: 4 }
    atSunday(18)
    useGame.getState().finishTourney()
    expect(runtime.tourney).toBeNull()
    expect(useGame.getState().tourney.points).toBe(1)
  })

  it('keeps the run going while time and the window last', () => {
    useGame.getState().startTourney()
    useGame.getState().finishTourney()
    expect(runtime.tourney).not.toBeNull()
  })
})

describe('대회 포인트 바꾸기', () => {
  it('trades points for a prize furniture item', () => {
    useGame.setState({ tourney: { points: 3, lastDay: SUN } })
    useGame.getState().exchangeTourney('tourney-trophy')
    expect(useGame.getState().inventory.map((x) => x.id)).toEqual(['tourney-trophy'])
    expect(useGame.getState().tourney.points).toBe(0)
  })

  it('refuses when the points are short, and keeps them', () => {
    useGame.setState({ tourney: { points: 1, lastDay: SUN } })
    useGame.getState().exchangeTourney('tourney-trophy')
    expect(useGame.getState().inventory).toEqual([])
    expect(useGame.getState().tourney.points).toBe(1)
  })
})

describe('대회 기록 옮기기', () => {
  it('keeps the saved points and last day', () => {
    expect(migrateSave({ day: SUN, tourney: { points: 5, lastDay: SUN } }).tourney).toEqual({ points: 5, lastDay: SUN })
  })

  it('starts a new save with no points', () => {
    expect(migrateSave({ day: SUN }).tourney).toEqual({ points: 0, lastDay: null })
  })

  it('대회 끝 알림은 큐를 건너뛰고 바로 뜨고, 밀린 알림은 큐 맨 앞에 남는다', () => {
    useGame.setState({ toast: { id: 1, text: '지난 알림' }, toastQueue: [{ id: 2, text: '기다리는 알림' }] })
    useGame.getState().notify('🏁 대회 끝!', true)
    const s = useGame.getState()
    expect(s.toast?.text).toBe('🏁 대회 끝!')
    expect(s.toastQueue.map((t) => t.text)).toEqual(['지난 알림', '기다리는 알림'])
  })
})
