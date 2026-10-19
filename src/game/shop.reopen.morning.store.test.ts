import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

// 큰 가게 공사(10-29 맡김, 10-31 재개장)와 집 완성(10-30 맡김, 10-31 완성)이 같은 아침에 겹치는 경우
const ORDER_DAY = '2026-10-29'

beforeEach(() => {
  useGame.setState({
    money: 3000,
    day: ORDER_DAY,
    shop: { tier: 1, order: { to: 2, day: ORDER_DAY } },
    home: { stage: 1, loan: 0, order: { to: 2, day: '2026-10-30' } },
    inventory: [],
    toast: null,
    toastQueue: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('재개장 아침 알림 순서', () => {
  it('큰 가게 문 연 알림이 먼저, 집 완성, 점장 편지 알림 순으로 줄 선다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    const s = useGame.getState()
    expect(s.shop.tier).toBe(2)
    expect(s.home.stage).toBe(2)
    const shown = [s.toast?.text ?? '', ...s.toastQueue.map((t) => t.text)].filter((t) => /🏪|🏡|📮/.test(t))
    expect(shown).toEqual([
      '🏪 큰 가게 문을 열었어요! 🏅 200마일',
      expect.stringContaining('🏡 '),
      expect.stringContaining('📮'),
    ])
  })

  it('집 완성과 섬 가꾸기 완성이 같은 아침이면 한 줄로 합쳐 토스트를 하나 아낀다', () => {
    useGame.setState({ shop: { tier: 2, order: null }, islandGift: { built: 0, fund: 3000, ready: '2026-10-31' } })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    const s = useGame.getState()
    const shown = [s.toast?.text ?? '', ...s.toastQueue.map((t) => t.text)]
    const build = shown.filter((t) => t.includes('🏡') || t.includes('🏗'))
    expect(build).toHaveLength(1)
    expect(build[0]).toContain('🏡')
    expect(build[0]).toContain('🏗')
    expect(build[0]).toContain(' · ')
  })

  it('같은 아침에 집만 완성되면 완성 알림이 그대로 뜬다', () => {
    useGame.setState({ shop: { tier: 2, order: null } })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    expect(useGame.getState().toast?.text).toContain('🏡')
  })
})
