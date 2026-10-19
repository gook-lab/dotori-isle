/**
 * 가게 결산의 날. 달마다 가게 판매 합계를 따로 누적해 달의 마지막 날 아침에 점장 편지로 알려 준다.
 * 가게 장부(salesLedger)는 최근 14일만 남으므로 한 달 합계는 여기서 따로 쌓는다.
 * 결산은 어제까지 판 것을 본다. 마지막 날 아침을 놓치면 다음 달 첫 아침에 지난달 것을 보낸다.
 * 날짜 키와 금액만 다루는 순수 함수다. 저장 값은 선택 필드라 예전 저장에는 결산 기록이 없다.
 */

import { ITEMS, josa } from './items'
import { shiftDay, type Sale } from './salesLedger'
import type { Letter } from './letters'

/** 이번 달 판매 누계. month 는 'YYYY-MM', items 는 물건 id 별 판매 도토리. settled 는 그 달 결산을 이미 보냈는지. */
export interface ShopMonth {
  month: string
  total: number
  items: Record<string, number>
  settled: boolean
}

/** 보너스 마일 구간. 판매 합계가 기준 이상이면 그 마일을 준다(큰 구간부터 본다). */
export const MONTH_BONUS: readonly { min: number; miles: number }[] = [
  { min: 60000, miles: 100 },
  { min: 30000, miles: 50 },
  { min: 10000, miles: 20 },
]

const MONTH_RE = /^\d{4}-\d{2}$/

export const monthOf = (day: string): string => day.slice(0, 7)

/** 그 날이 달의 마지막 날인가. 다음 날이 다른 달이면 마지막 날이다. */
export function isMonthEnd(day: string): boolean {
  return monthOf(shiftDay(day, 1)) !== monthOf(day)
}

/** 오늘 팔린 것을 이번 달 누계에 더한다. 달이 바뀌었으면 새 달부터 센다. 팔린 게 없으면 같은 값을 돌려준다. */
export function addMonthSales(cur: ShopMonth | null | undefined, day: string, sales: readonly Sale[]): ShopMonth | null {
  const lines = sales.filter((s) => s.amount > 0)
  if (lines.length === 0) return cur ?? null
  const month = monthOf(day)
  const base: ShopMonth = cur && cur.month === month ? cur : { month, total: 0, items: {}, settled: false }
  const items = { ...base.items }
  for (const s of lines) items[s.id] = (items[s.id] ?? 0) + s.amount
  return { month, total: base.total + lines.reduce((a, s) => a + s.amount, 0), items, settled: base.settled }
}

/** 판매 합계에 따른 보너스 마일. 구간에 못 미치면 0 이다. */
export function monthBonus(total: number): number {
  return MONTH_BONUS.find((b) => total >= b.min)?.miles ?? 0
}

/** 아침에 결산 편지를 보낼 때인가. 지난달이거나, 이번 달 마지막 날이면서 아직 안 보냈고 판 것이 있어야 한다. */
export function shouldSettle(tally: ShopMonth | null | undefined, today: string): boolean {
  if (!tally || tally.settled || tally.total <= 0) return false
  const now = monthOf(today)
  if (tally.month < now) return true
  return tally.month === now && isMonthEnd(today)
}

/** 판매 합계가 가장 큰 물건 한 개(같으면 id 순). 판 물건이 없으면 null. */
export function topMonthItem(items: Readonly<Record<string, number>>): { id: string; amount: number } | null {
  const [top] = Object.entries(items)
    .filter(([id, amount]) => amount > 0 && ITEMS[id] !== undefined)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return top ? { id: top[0], amount: top[1] } : null
}

/** 결산 편지 한 통과 보너스 마일. 판매 합계를 적고, 가장 많이 팔린 물건과 보너스 마일을 알려 준다. */
export function settleMonth(tally: ShopMonth, today: string): { letter: Letter; bonus: number; tally: ShopMonth } {
  const bonus = monthBonus(tally.total)
  const top = topMonthItem(tally.items)
  const [, mm] = tally.month.split('-')
  const until = isMonthEnd(today) ? '어제까지' : '말일까지'
  const head = `${Number(mm)}월 가게 장부를 정리했어요. 1일부터 ${until} 도토리 ${tally.total.toLocaleString()}개를 팔았어요.`
  const best = top ? ` 가장 많이 팔린 건 ${ITEMS[top.id].icon} ${josa(ITEMS[top.id].name, '이에요', '예요')}.` : ''
  const reward = bonus > 0 ? ` 보너스로 ${bonus.toLocaleString()}마일을 넣어 뒀어요.` : ' 다음 달에는 더 많이 팔아 봐요.'
  const letter: Letter = {
    id: `shop-month-${tally.month}`,
    from: 'shopkeeper',
    fromName: '점장',
    day: today,
    text: `${head}${best}${reward} 늘 찾아 주셔서 고마워요!`,
    gift: null,
    read: false,
    claimed: false,
  }
  return { letter, bonus, tally: { ...tally, settled: true } }
}

/** 불러온 결산 누계 검사. 달 형식이나 금액이 틀리면 버리고, 모르는 물건 줄은 뺀다. settled 가 없으면 아직 안 보낸 것으로 본다. */
export function cleanShopMonth(v: unknown): ShopMonth | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Partial<Record<keyof ShopMonth, unknown>>
  if (typeof o.month !== 'string' || !MONTH_RE.test(o.month)) return null
  if (typeof o.total !== 'number' || !Number.isFinite(o.total) || o.total < 0) return null
  const items: Record<string, number> = {}
  if (o.items && typeof o.items === 'object') {
    for (const [id, amount] of Object.entries(o.items as Record<string, unknown>)) {
      if (ITEMS[id] && typeof amount === 'number' && Number.isFinite(amount) && amount > 0) items[id] = amount
    }
  }
  return { month: o.month, total: o.total, items, settled: o.settled === true }
}
