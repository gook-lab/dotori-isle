import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

// 짓기를 맡긴 날(10-29)의 다음 날 아침에 집이 완성된다
const ORDER_DAY = '2026-10-29'

beforeEach(() => {
  useGame.setState({
    day: ORDER_DAY,
    home: { stage: 0, loan: 2500, order: { to: 1, day: ORDER_DAY } },
    toast: null,
    toastQueue: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const morningAfterOrder = () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-30T08:00:00'))
  useGame.getState().syncClock()
}

describe('집 완성 알림', () => {
  it('대출이 남아 있으면 완성 알림에 ATM 에서 갚는 곳을 덧붙인다', () => {
    morningAfterOrder()
    const s = useGame.getState()
    expect(s.home.stage).toBe(1)
    expect(s.toast?.text).toContain('작은 집이 완성됐어요!')
    expect(s.toast?.text).toContain('대출 도토리 2,500개는 도토리 상점 안 ATM에서 갚아요')
  })

  it('대출이 없으면 완성 알림만 뜬다', () => {
    useGame.setState({ home: { stage: 0, loan: 0, order: { to: 1, day: ORDER_DAY } } })
    morningAfterOrder()
    const text = useGame.getState().toast?.text ?? ''
    expect(text).toContain('작은 집이 완성됐어요!')
    expect(text).not.toContain('ATM')
  })
})
