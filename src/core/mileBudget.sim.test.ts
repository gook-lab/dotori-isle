import { describe, expect, it } from 'vitest'
import { ATM_PRODUCTS } from './bank'
import { DEX_BONUS } from './dexReward'
import { NAP_MILES } from './furnitureActions'
import { HOME_SETS, SET_MILES } from './homeScore'
import { newMiles } from './miles'
import { ZONE_MILES } from './museum'
import { TODO_REWARD } from './todo'
import { WEEKLY_MILES } from './weekly'

// 보통 플레이어가 하루에 늘리는 통계 양. 과제 단계는 이 값으로 newMiles 를 돌려 셈한다.
const RATE: Record<string, number> = { shake: 4, chop: 2, rock: 2, dig: 0.3, bug: 0.5, fish: 0.5, plant: 0.5, water: 1, talk: 1.5, give: 0.2, craft: 0.2, build: 0.05, trip: 0.05, recruit: 0.05, 'fish-fresh': 0.1, rustle: 2, earn: 400 }

/**
 * 날짜별 마일 수입. 과제 단계는 실제 newMiles 로 셈하고, 나머지는 보통 빈도를 가정한다.
 * 가정: 할 일 세 개(매일), 오늘의 부탁 한 개(매일 100), 첫 잠(매일 10), 이야기 장 1·7·21일째,
 * 도감 완성 14일째(물고기)·21일째(벌레), 주간 목표 두 개(7일마다), 집 꾸미기 점수 20(7일마다),
 * 박물관 기증 두 건(10일 이후 7일마다 40), 전시관 구역 완성 28일째.
 */
function income(days: number) {
  const out: { day: number; total: number }[] = []
  let claimed: Record<string, number> = {}
  let total = 0
  for (let d = 1; d <= days; d++) {
    const stats: Record<string, number> = {}
    for (const k of Object.keys(RATE)) stats[k] = Math.floor(RATE[k] * d)
    const m = newMiles(stats, claimed)
    claimed = m.claimed
    let gain = m.miles + TODO_REWARD * 3 + 100 + NAP_MILES
    if (d === 1) gain += 100
    if (d === 7) gain += 200
    if (d === 14) gain += DEX_BONUS
    if (d === 21) gain += 300 + DEX_BONUS
    if (d % 7 === 0) gain += WEEKLY_MILES * 2 + 20
    if (d >= 10 && d % 7 === 0) gain += 40
    if (d === 28) gain += ZONE_MILES
    total += gain
    out.push({ day: d, total })
  }
  return out
}

const CAPPED = ATM_PRODUCTS.filter((p) => p.max !== null)
/** 쿠폰(상한 없음)을 뺀 교환 목록을 전부 사는 데 드는 마일 */
const LIST_TOTAL = CAPPED.reduce((a, p) => a + p.cost * (p.max ?? 0), 0)
const run = income(90)
const at = (day: number) => run[day - 1].total
/** 누적 수입이 처음으로 이 금액을 넘는 날 */
const reachDay = (amount: number) => run.find((r) => r.total >= amount)?.day ?? null

describe('마일 수입과 ATM 교환 목록 시뮬레이션', () => {
  it('누적 수입 체크포인트 — 1일째 240, 7일째 3,080, 30일째 13,220', () => {
    expect([at(1), at(7), at(30)]).toEqual([240, 3080, 13220])
  })

  it('가장 싼 상품(120)은 첫날부터 살 수 있어서 살 게 없는 구간은 없다', () => {
    const cheapest = Math.min(...ATM_PRODUCTS.map((p) => p.cost))
    expect(cheapest).toBe(120)
    expect(at(1)).toBeGreaterThanOrEqual(cheapest)
  })

  it('가구 세트 여섯 개를 모두 완성해도 세트 마일은 30이다(세트마다 한 번 5)', () => {
    expect(HOME_SETS.length * SET_MILES).toBe(30)
  })

  it('쿠폰을 뺀 교환 목록은 47일째에 다 채운다 (섬 고유 가구 전에는 25일째)', () => {
    expect(LIST_TOTAL).toBe(15820)
    expect(reachDay(LIST_TOTAL)).toBe(47)
    expect(reachDay(LIST_TOTAL - (1200 + 1800 + 2400))).toBe(25)
  })
})
