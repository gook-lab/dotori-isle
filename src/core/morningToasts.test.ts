import { describe, expect, it } from 'vitest'
import { festivalOn, nextDay } from './festivals'
import { MERGE_MAX_CHARS, MORNING_TOAST_MAX, planMorningToasts, type MorningNotice } from './morningToasts'

const n = (text: string, rank: number, extra: Partial<MorningNotice> = {}): MorningNotice => ({ text, rank, ...extra })

describe('아침 알림 토스트 고르기', () => {
  it('세 개 이하면 전부 토스트로 뜨고 휴대폰 목록은 비어 있다', () => {
    const list = [n('a', 2), n('b', 0), n('c', 1)]
    const { toasts, phone } = planMorningToasts(list)
    expect(toasts.map((x) => x.text)).toEqual(['a', 'b', 'c'])
    expect(phone).toEqual([])
  })

  it('다섯 개면 중요한 세 개만 토스트로 띄우고 나머지는 휴대폰 목록으로 보낸다', () => {
    const list = [n('편지', 2), n('이자', 5), n('상점', 0), n('집', 1), n('꽃', 4)]
    const { toasts, phone } = planMorningToasts(list)
    expect(toasts.map((x) => x.text)).toEqual(['편지', '상점', '집'])
    expect(phone.map((x) => x.text)).toEqual(['이자', '꽃'])
  })

  it('토스트는 입력 순서를 지킨다. 상점 재개장 → 집 완성 → 편지', () => {
    const list = [n('상점', 0, { build: true }), n('집', 1, { build: true }), n('편지', 2), n('이자', 9)]
    expect(planMorningToasts(list).toasts.map((x) => x.text)).toEqual(['상점', '집', '편지'])
  })

  it('순위가 같으면 먼저 들어간 알림이 토스트에 남는다', () => {
    const list = [n('첫째', 3), n('둘째', 3), n('셋째', 3), n('넷째', 3)]
    const { toasts, phone } = planMorningToasts(list)
    expect(toasts.map((x) => x.text)).toEqual(['첫째', '둘째', '셋째'])
    expect(phone.map((x) => x.text)).toEqual(['넷째'])
  })

  it('front·build 표시는 그대로 넘긴다', () => {
    const { toasts } = planMorningToasts([n('공사', 0, { build: true, front: true })])
    expect(toasts[0]).toMatchObject({ build: true, front: true })
  })

  it('max 를 주면 그 수만큼만 토스트로 남는다', () => {
    const list = [n('a', 0), n('b', 1)]
    // 밀려난 1순위는 남은 토스트 뒤에 이어 붙는다
    expect(planMorningToasts(list, 1).toasts.map((x) => x.text)).toEqual(['a · b'])
    expect(planMorningToasts(list, 0).toasts).toEqual([])
    expect(planMorningToasts(list, 0).phone.map((x) => x.text)).toEqual(['a', 'b'])
    expect(MORNING_TOAST_MAX).toBe(3)
  })
})

/** 보통 플레이어의 아침 알림 원천. 날짜만으로 정해지는 것과 매일 생기는 것을 섞었다. */
function morningSources(day: string, index: number): MorningNotice[] {
  const out: MorningNotice[] = []
  out.push(n('편지가 왔어요', 2))
  out.push(n('꽃이 활짝 피었어요', 4))
  if (index % 7 === 0) out.push(n('예금이 만기됐어요', 2, { front: true }))
  if (index % 30 === 0) out.push(n('통장에 이자가 붙었어요', 5))
  const fest = festivalOn(day)
  if (fest) out.push(n(`${fest.name}이에요`, 3))
  if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) out.push(n('송이가 상했어요', 6))
  return out
}

describe('넘친 1순위 알림 이어 붙이기', () => {
  it('네 개인데 넘친 알림이 순위 1이면 세 번째 토스트 뒤에 " · "로 이어 붙인다', () => {
    const list = [n('상점', 0), n('집', 1), n('공사', 1), n('섬', 1)]
    const { toasts, phone } = planMorningToasts(list)
    expect(toasts.map((x) => x.text)).toEqual(['상점', '집', '공사 · 섬'])
    expect(phone).toEqual([])
  })

  it('이어 붙인 글이 60자를 넘으면 합치지 않고 휴대폰 목록으로 보낸다', () => {
    const long = '가'.repeat(MERGE_MAX_CHARS)
    const list = [n('상점', 0), n('집', 1), n('공사', 1), n(long, 1)]
    const { toasts, phone } = planMorningToasts(list)
    expect(toasts.map((x) => x.text)).toEqual(['상점', '집', '공사'])
    expect(phone.map((x) => x.text)).toEqual([long])
  })

  it('순위 2 이상이 넘치면 지금처럼 휴대폰 목록으로만 간다', () => {
    const list = [n('상점', 0), n('집', 1), n('공사', 1), n('편지', 2)]
    const { toasts, phone } = planMorningToasts(list)
    expect(toasts.map((x) => x.text)).toEqual(['상점', '집', '공사'])
    expect(phone.map((x) => x.text)).toEqual(['편지'])
  })

  it('합친 알림의 공사·우선 표시는 마지막 토스트의 것을 따른다', () => {
    const list = [n('상점', 0), n('집', 1), n('공사', 1, { build: true }), n('섬', 1, { front: true })]
    const { toasts } = planMorningToasts(list)
    expect(toasts[2]).toMatchObject({ text: '공사 · 섬', build: true })
    expect(toasts[2].front).toBeUndefined()
  })
})

describe('아침 알림 30일 시뮬레이션', () => {
  const START = '2026-10-19'
  const days: { day: string; total: number; toasts: number; phone: number }[] = []
  let day = START
  for (let i = 0; i < 30; i++) {
    const list = morningSources(day, i)
    const { toasts, phone } = planMorningToasts(list)
    days.push({ day, total: list.length, toasts: toasts.length, phone: phone.length })
    day = nextDay(day)
  }

  it('어떤 아침에도 토스트는 세 개를 넘지 않는다', () => {
    expect(Math.max(...days.map((d) => d.toasts))).toBeLessThanOrEqual(MORNING_TOAST_MAX)
  })

  it('네 개를 넘는 아침의 나머지는 모두 휴대폰 목록으로 간다', () => {
    for (const d of days) expect(d.toasts + d.phone).toBe(d.total)
  })

  it('보통 날에는 네 개를 넘지 않는다', () => {
    expect(days.filter((d) => d.total > 4)).toEqual([])
    expect(Math.max(...days.map((d) => d.total))).toBe(4)
  })

  it('상점 재개장·집 완성·기부 완성·생일이 한 아침에 겹치면 세 개만 뜨고 나머지는 휴대폰으로 간다', () => {
    const stacked = [
      n('🏪 큰 가게 문을 열었어요!', 0, { build: true }),
      n('🏡 집이 완성됐어요!', 1, { build: true }),
      n('📮 편지가 왔어요', 2),
      n('🏦 예금이 만기됐어요', 2, { front: true }),
      n('🏗 꽃길 벤치가 완성됐어요', 3, { front: true }),
      n('🎂 오늘은 내 생일이에요', 4),
      ...morningSources(START, 1),
    ]
    const { toasts, phone } = planMorningToasts(stacked)
    expect(toasts.map((x) => x.text)).toEqual(['🏪 큰 가게 문을 열었어요!', '🏡 집이 완성됐어요!', '📮 편지가 왔어요'])
    expect(phone).toHaveLength(stacked.length - 3)
  })
})
