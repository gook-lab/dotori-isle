import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

// 맡긴 날(10-29) 공사 → 다음 날(10-30)은 문 닫힘 → 두 날 뒤(10-31) 재개장
const ORDER_DAY = '2026-10-29'

beforeEach(() => {
  useGame.setState({
    money: 3000,
    day: ORDER_DAY,
    shop: { tier: 0, order: { to: 1, day: ORDER_DAY } },
    inventory: [{ id: 'peach', count: 2 }],
    toast: null,
    toastQueue: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const dayAt = (iso: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
  useGame.getState().syncClock()
}

describe('상점 재개장 알림', () => {
  it('두 날 뒤 아침에 새 단계로 바뀌고 "문을 열었어요" 알림이 뜬다', () => {
    dayAt('2026-10-31T08:00:00')
    const s = useGame.getState()
    expect(s.shop).toEqual({ tier: 1, order: null })
    expect(s.toast?.text).toContain('🏪 가게 문을 열었어요!')
  })

  it('공사 중인 날에는 아직 옛 단계이고 재개장 알림도 없다', () => {
    dayAt('2026-10-30T08:00:00')
    const s = useGame.getState()
    expect(s.shop.tier).toBe(0)
    expect(s.toast?.text ?? '').not.toContain('문을 열었어요')
  })
})

describe('상점 공사 중 판매', () => {
  it('문 닫은 날에는 모두 팔기가 막히고 도토리가 그대로다', () => {
    dayAt('2026-10-30T10:00:00')
    useGame.getState().sellAll()
    const s = useGame.getState()
    expect(s.money).toBe(3000)
    expect(s.inventory).toEqual([{ id: 'peach', count: 2 }])
    expect(s.toast?.text).toContain('공사 중이라 문을 닫았어요')
  })

  it('문 닫은 날에는 고른 칸 팔기도 막힌다', () => {
    dayAt('2026-10-30T10:00:00')
    useGame.getState().sellPicked([0])
    expect(useGame.getState().money).toBe(3000)
  })

  it('재개장 날에는 다시 팔 수 있다', () => {
    dayAt('2026-10-31T10:00:00')
    useGame.getState().sellAll()
    expect(useGame.getState().money).toBeGreaterThan(3000)
  })
})
