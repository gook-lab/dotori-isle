import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expandCost } from '../core/houseExpand'
import { GIFT_PROJECTS_2 } from '../core/islandGift'
import { useGame } from './store'

// 한 아침에 알림이 몰릴 때(섬 2차 완성, 집 증축 완성, 집 감사 편지, 결산 편지, 예금 만기, 상점 재개장)
// 토스트는 세 개까지이고, 예금 만기와 결산은 휴대폰 목록으로만 밀려나지 않아야 한다.
const DAY = '2026-10-31'
const MORNING = new Date('2026-11-01T08:00:00')

function setUp(extra: Record<string, unknown> = {}) {
  useGame.setState({
    day: DAY,
    money: 0,
    toast: null,
    toastQueue: [],
    letters: [],
    noticeLog: [],
    shop: { tier: 2, order: null },
    home: { stage: 5, loan: 0, order: null },
    houses: ['mocha', 'bomi'],
    houseExpand: { villagerId: 'mocha', fund: expandCost('mocha'), ready: '2026-11-01' },
    expanded: [],
    houseThanks: { id: 'bomi', day: DAY },
    islandAcorn: { built: 0, fund: GIFT_PROJECTS_2[0].cost, ready: '2026-11-01' },
    islandThanksDay: null,
    deposit: { principal: 1000, days: 3, start: '2026-10-29', due: '2026-11-01' },
    shopMonth: { month: '2026-10', total: 12000, items: {}, settled: false },
    ...extra,
  })
  // 장터 소식 같은 새 열림은 상태가 바뀌는 순간 바로 뜬다. 이 테스트는 아침 묶음만 보려고 미리 비운다.
  useGame.setState({ toast: null, toastQueue: [], noticeLog: [] })
}

/** 토스트에 뜬 글과, 휴대폰 목록(알림 기록)에 남은 글. 알림 기록에는 토스트로 뜬 글도 함께 들어간다. */
function shownOf() {
  const s = useGame.getState()
  const toasts = [s.toast?.text ?? '', ...s.toastQueue.map((t) => t.text)].filter(Boolean)
  const phone = s.noticeLog.map((n) => n.text)
  return { toasts, phone }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MORNING)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('아침 알림 몰림: 세 개 상한과 순위', () => {
  it('결산·예금·섬 2차 완성·집 증축 완성·집 감사 편지가 한 아침에 몰리면 토스트는 셋이고, 결산과 예금은 토스트에 든다', () => {
    setUp()
    useGame.getState().syncClock()
    const { toasts, phone } = shownOf()
    expect(toasts).toHaveLength(3)
    expect(toasts.some((t) => t.includes('결산 편지'))).toBe(true)
    expect(toasts.some((t) => t.includes('3일 예금이'))).toBe(true)
    expect(toasts.some((t) => t.includes(GIFT_PROJECTS_2[0].name))).toBe(true)
    // 나머지 증축 완성은 휴대폰 목록에 남는다
    expect(phone.some((t) => t.includes('모카네 집 현관에 차양이 달렸어요'))).toBe(true)
  })

  it('편지 도착은 여러 통이어도 한 줄로 묶이고, 결산이 있으면 결산 줄이 앞에 선다', () => {
    setUp()
    useGame.getState().syncClock()
    const arrivals = [...new Set(shownOf().phone)].filter((t) => t.startsWith('📮'))
    expect(arrivals).toHaveLength(1)
    expect(arrivals[0]).toContain('결산 편지')
  })

  it('상점 재개장이 같은 아침이어도 결산과 예금 만기는 토스트에 남는다', () => {
    setUp({ shop: { tier: 1, order: { to: 2, day: '2026-10-30' } } })
    useGame.getState().syncClock()
    const { toasts } = shownOf()
    expect(toasts).toHaveLength(3)
    expect(toasts.some((t) => t.includes('큰 가게 문을 열었어요'))).toBe(true)
    expect(toasts.some((t) => t.includes('결산 편지'))).toBe(true)
    expect(toasts.some((t) => t.includes('3일 예금이'))).toBe(true)
  })
})

describe('아침 알림 네 개 이상: 넘친 1순위는 이어 붙인다', () => {
  it('재개장·집 완성·결산·예금이 몰리고 예금 안내를 이미 봤으면, 예금은 결산 토스트 뒤에 이어 붙는다', () => {
    setUp({
      shop: { tier: 1, order: { to: 2, day: '2026-10-30' } },
      home: { stage: 1, loan: 0, order: { to: 2, day: '2026-10-30' } },
      seenHints: ['deposit'],
    })
    useGame.getState().syncClock()
    const { toasts } = shownOf()
    expect(toasts).toHaveLength(3)
    expect(toasts[0]).toContain('큰 가게 문을 열었어요')
    expect(toasts[1]).toContain('큰 집이 완성됐어요')
    expect(toasts[2]).toContain('결산 편지')
    expect(toasts[2]).toContain('예금이 끝나')
  })

  it('예금 안내를 처음 보면 이어 붙인 글이 60자를 넘어 예금은 휴대폰 목록으로 간다', () => {
    setUp({
      shop: { tier: 1, order: { to: 2, day: '2026-10-30' } },
      home: { stage: 1, loan: 0, order: { to: 2, day: '2026-10-30' } },
    })
    useGame.getState().syncClock()
    const { toasts, phone } = shownOf()
    expect(toasts.some((t) => t.includes('예금이 만기됐어요'))).toBe(false)
    expect(phone.some((t) => t.includes('예금'))).toBe(true)
  })
})
