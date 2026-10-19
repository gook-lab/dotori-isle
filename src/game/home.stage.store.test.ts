import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

describe('집 완성 알림', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 19, 12))
    useGame.setState({
      day: '2026-10-19',
      home: { stage: 0, loan: 2500, order: { to: 1, day: '2026-10-19' } },
      toast: { id: 1, text: '편지 알림' },
      toastQueue: [{ id: 2, text: '다른 알림' }],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('다음 날 아침 완성되면, 쌓인 알림보다 먼저 완성 알림이 뜬다', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 6))
    useGame.getState().syncClock()
    const s = useGame.getState()
    expect(s.home.stage).toBe(1)
    expect(s.home.order).toBeNull()
    // 대출이 남아 있으니 ATM 안내가 뒤에 붙는다(home.completion.store.test.ts 에서 따로 확인)
    expect(s.toast?.text).toContain('🏡 작은 집이 완성됐어요!')
    expect(s.toastQueue.map((t) => t.text)).toContain('편지 알림')
  })
})
