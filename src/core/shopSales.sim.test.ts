import { describe, expect, it } from 'vitest'
import { BUG_TABLE, FISH_TABLE, ITEM_LIST, ITEMS, SHELL_TABLE } from './items'
import { nextDay } from './festivals'
import { SHOP_TIERS } from './shopTiers'
import { songiWeekOf, songiWeekQuotes } from './songi'

// 보통 플레이어가 하루에 상점에 파는 양. 상점 게이트(판매 누적)에 드는 날을 센다.
// 가정(하루 행동 예산, 바꿀 때는 이 표만 고친다):
// - 나무 흔들기: 하루 6그루, 그루마다 복숭아 3개(열매 나무 기준). 오렌지는 여행 나무라 셈하지 않는다.
// - 낚시: 하루 4마리. 종은 FISH_TABLE 가중치로 고르고, 낮·밤 구분은 하지 않는다(평균).
// - 벌레: 하루 6마리. BUG_TABLE 가중치 평균.
// - 조개 줍기: 하루 8개. SHELL_TABLE 가중치 평균.
// - 해산물(잠수): 8일째부터 하루 1개, 해산물 평균.
// - 송이: 일요일마다 30개를 사서 그 주 시세 평균(12칸)에 판다. 사는 값은 판매에 넣지 않는다.
// 이 표에 없는 수입(잡화·나무 베기·돌·꽃·도감 보상)은 뺀다. 빠진 만큼 실제는 조금 더 빠르다.
const BUDGET = { shakeTrees: 6, peachPerTree: 3, fish: 4, bugs: 6, shells: 8, seafoodFrom: 8, seafood: 1, songiPieces: 30 }
const START = '2026-10-19' // 월요일. 일요일은 7일째.

/** 종류 안에서 가중치 평균 가격 */
function weightedPrice(rows: readonly { id: string; weight: number }[]): number {
  const total = rows.reduce((a, r) => a + r.weight, 0)
  return rows.reduce((a, r) => a + ITEMS[r.id].price * r.weight, 0) / total
}

const AVG = {
  fish: weightedPrice(FISH_TABLE),
  bug: weightedPrice(BUG_TABLE),
  shell: weightedPrice(SHELL_TABLE),
  seafood: ITEM_LIST.filter((i) => i.kind === 'seafood').reduce((a, i) => a + i.price, 0) / ITEM_LIST.filter((i) => i.kind === 'seafood').length,
}

/** 그날 상점에 파는 양(도토리). 예산에 scale 을 곱해 민감도를 본다(1 = 위 가정 그대로). */
function soldOn(day: string, dayNo: number, scale = 1): number {
  let sold = BUDGET.shakeTrees * scale * BUDGET.peachPerTree * ITEMS.peach.price
  sold += (BUDGET.fish * AVG.fish + BUDGET.bugs * AVG.bug + BUDGET.shells * AVG.shell) * scale
  if (dayNo >= BUDGET.seafoodFrom) sold += BUDGET.seafood * AVG.seafood * scale
  if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) {
    const week = songiWeekOf(day)
    const quotes = week ? songiWeekQuotes(week) : []
    const mean = quotes.length ? quotes.reduce((a, b) => a + b, 0) / quotes.length : 0
    sold += BUDGET.songiPieces * scale * mean
  }
  return Math.round(sold)
}

const DAYS = 200
function simulate(scale = 1) {
  const out: { day: number; sold: number; cum: number }[] = []
  let key = START
  let cum = 0
  for (let d = 1; d <= DAYS; d++) {
    const sold = soldOn(key, d, scale)
    cum += sold
    out.push({ day: d, sold, cum })
    key = nextDay(key)
  }
  return out
}
const run = simulate()

const avgOf = (rows: { sold: number }[]) => Math.round(rows.reduce((a, r) => a + r.sold, 0) / rows.length)
/** 누적 판매가 처음으로 gate 를 넘는 날(1일째 기준). 넘지 못하면 null */
const reachDay = (rows: { day: number; cum: number }[], gate: number) => rows.find((r) => r.cum >= gate)?.day ?? null

// 게이트: 판매 조건과 공사비 가운데 큰 값. 구매 조건과 현금 조건은 판매 조건 뒤에서 함께 채워져 판매가 먼저 막는다.
const GATE = SHOP_TIERS.slice(1).map((t) => Math.max(t.unlock.sold, t.upgradeCost))

describe('하루 판매 시뮬레이션 — 상점 게이트 도달일', () => {
  it('평균 판매 체크포인트: 1일째·1~7일·1~30일 (도토리/일)', () => {
    expect({ day1: run[0].sold, week1: avgOf(run.slice(0, 7)), month1: avgOf(run.slice(0, 30)) }).toEqual({ day1: 1840, week1: 2194, month1: 2338 })
  })

  it('게이트 도달일: 가게·큰 가게·백화점', () => {
    expect({ gates: GATE, reach: GATE.map((g) => reachDay(run, g)) }).toEqual({ gates: [1500, 10000, 30000], reach: [1, 6, 14] })
  })

  it('민감도: 예산을 절반·4분의 1로 줄이면', () => {
    const rows = [0.5, 0.25, 0.2].map((k) => { const r = simulate(k); return { k, day1: r[0].sold, month1: avgOf(r.slice(0, 30)), reach: GATE.map((g) => reachDay(r, g)) } })
    expect(rows).toEqual([
      { k: 0.5, day1: 920, month1: 1169, reach: [2, 10, 27] },
      { k: 0.25, day1: 460, month1: 584, reach: [4, 19, 51] },
      { k: 0.2, day1: 368, month1: 467, reach: [5, 22, 63] },
    ])
  })
})
