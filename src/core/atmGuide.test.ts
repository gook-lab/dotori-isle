import { describe, expect, it } from 'vitest'
import { ATM_MILES_SOURCE, atmDefaultTab } from './atmGuide'
import { lockedSystem, type UnlockCtx } from './unlocks'

describe('ATM 처음 열기', () => {
  it('빚이 있으면 대출 갚기 탭을, 그 밖에는 입출금 탭을 먼저 연다', () => {
    expect(atmDefaultTab(2500)).toBe('loan')
    expect(atmDefaultTab(0)).toBe('io')
  })

  it('마일리지 안내는 업적·할 일·주간 목표를 적는다', () => {
    expect(ATM_MILES_SOURCE).toContain('업적')
    expect(ATM_MILES_SOURCE).toContain('오늘의 할 일')
    expect(ATM_MILES_SOURCE).toContain('주간 목표')
  })

  it('잠긴 ATM 은 이유를 알려 준다: 땅속 보물 찾기를 깨면 열린다', () => {
    const locked: UnlockCtx = { day: '2026-10-19', islandStart: '2026-10-01', questsDone: [], dexCount: 0, stats: { sold: 0, spent: 0, questsDone: [] } }
    const atm = lockedSystem('atm', locked)
    expect(atm?.hint).toContain('땅속 보물 찾기')
    expect(lockedSystem('atm', { ...locked, questsDone: ['dig'], stats: { ...locked.stats, questsDone: ['dig'] } })).toBeNull()
  })
})
