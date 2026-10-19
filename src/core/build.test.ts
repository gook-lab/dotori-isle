import { describe, expect, it } from 'vitest'
import { isBuildToast, shopDaysLeft, shopPendingText } from './build'

describe('공사 알림 갈래', () => {
  it('groups construction, completion, and reopening toasts together', () => {
    expect(isBuildToast('🚧 가게 공사를 시작했어요. 내일은 문을 닫고 모레 새 간판을 달아요')).toBe(true)
    expect(isBuildToast('🏗️ 집 짓기를 맡겼어요. 대출 2,500개는 ATM에서 갚아요. 내일 아침 완성돼요')).toBe(true)
    expect(isBuildToast('🏡 작은 집이 완성됐어요!')).toBe(true)
    expect(isBuildToast('🏪 가게 문을 열었어요! 마일리지 +100')).toBe(true)
  })

  it('leaves other toasts alone', () => {
    expect(isBuildToast('📮 모카에게서 편지가 왔어요')).toBe(false)
    expect(isBuildToast('🌰 도토리 200개를 받았어요')).toBe(false)
  })
})

describe('상점 공사 남은 날', () => {
  it('counts two days on the order day and one the day after', () => {
    expect(shopDaysLeft('2026-10-19', '2026-10-19')).toBe(2)
    expect(shopDaysLeft('2026-10-19', '2026-10-20')).toBe(1)
  })

  it('is zero once the shop reopens', () => {
    expect(shopDaysLeft('2026-10-19', '2026-10-21')).toBe(0)
    expect(shopDaysLeft('2026-10-19', '2026-10-25')).toBe(0)
  })

  it('returns zero for a bad day key', () => {
    expect(shopDaysLeft('nope', '2026-10-19')).toBe(0)
  })
})

describe('공사 중 안내 문구', () => {
  it('says 모레 on the first day and 내일 on the second', () => {
    expect(shopPendingText('가게', 2)).toBe('🚧 가게 공사 중이에요. 모레 새 간판을 달아요')
    expect(shopPendingText('큰 가게', 1)).toBe('🚧 큰 가게 공사 중이에요. 내일 새 간판을 달아요')
  })
})
