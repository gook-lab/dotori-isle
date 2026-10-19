import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

beforeEach(() => {
  useGame.setState({ money: 3000, deposit: null, day: '2026-10-29', bank: { savings: 0, day: '2026-10-29', withdrawnDay: '2026-10-29', withdrawnToday: 0, capUpgrades: 0, limitUpgrades: 0 } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('정기 예금 저장 흐름', () => {
  it('맡기면 지갑에서 빠지고 예금 한 건이 생긴다', () => {
    useGame.getState().depositOpen(1000, 3)
    const s = useGame.getState()
    expect(s.money).toBe(2000)
    expect(s.deposit).toEqual({ principal: 1000, days: 3, start: '2026-10-29', due: '2026-11-01' })
  })

  it('두 건은 맡기지 못하고 지갑도 그대로다', () => {
    useGame.getState().depositOpen(1000, 3)
    useGame.getState().depositOpen(500, 7)
    expect(useGame.getState().money).toBe(2000)
  })

  it('만기 날 아침에 원금과 이자를 통장에 넣고, 통장 한도를 무시한다', () => {
    useGame.getState().depositOpen(1000, 3)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T08:00:00'))
    useGame.getState().syncClock()
    const s = useGame.getState()
    expect(s.deposit).toBeNull()
    expect(s.bank.savings).toBe(1020)
    expect(s.toast?.text).toContain('3일 예금이 만기됐어요. 이자 도토리 20개를 더해 통장에 넣었어요')
  })

  it('중도 해지는 원금만 통장으로 돌아가고 예금이 비워진다', () => {
    useGame.getState().depositOpen(1000, 7)
    useGame.getState().depositBreak()
    const s = useGame.getState()
    expect(s.deposit).toBeNull()
    expect(s.bank.savings).toBe(1000)
  })
})
