/**
 * 가게 장부. 날마다 상점에 판 도토리 합계와 물건별 합계를 적어 최근 14일만 보관한다.
 * 플레이어에게는 가게가 자라는 감각을 보여 주고, 개발 쪽에는 실제 하루 판매 기록이 된다.
 * 날짜 키와 금액만 다루는 순수 함수다. 저장 값은 선택 필드라 예전 저장에는 장부가 없다.
 */

import { dayIndex } from './economy'
import { ITEMS } from './items'
import { slotValue, type Slot } from './inventory'

/** 보관하는 날 수 */
export const SALES_DAYS = 14
/** 가게 탭에 보여 주는 날 수 */
export const SALES_WEEK = 7
/** 많이 판 물건을 몇 개까지 보여 주는지 */
export const SALES_TOP = 3

/** 하루치 기록. items 는 물건 id 별 판매 도토리. */
export interface SalesDay {
  day: string
  total: number
  items: Record<string, number>
}

export interface Sale {
  id: string
  amount: number
}

/** 팔린 칸들을 물건별 판매 금액으로 바꾼다. 시세(songi)는 송이 칸에만 쓴다. */
export function saleLines(sold: readonly Slot[], songi = 0): Sale[] {
  return sold.map((s) => ({ id: s.id, amount: slotValue(s, songi) })).filter((x) => x.amount > 0)
}

/** 날짜 키를 n 일 뒤로 민다(음수면 앞으로). 잘못된 키면 그대로 돌려준다. */
export function shiftDay(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 장부를 날짜 오름차순으로 정리하고 최근 SALES_DAYS 일만 남긴다. */
function trim(days: SalesDay[]): SalesDay[] {
  return [...days].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).slice(-SALES_DAYS)
}

/** 오늘 팔린 물건을 장부에 더한다. 금액이 0 이하인 줄은 무시하고, 아무것도 없으면 같은 배열을 돌려준다. */
export function addSales(days: readonly SalesDay[], day: string, sales: readonly Sale[]): SalesDay[] {
  const lines = sales.filter((s) => s.amount > 0)
  if (lines.length === 0) return days as SalesDay[]
  const add = lines.reduce((a, s) => a + s.amount, 0)
  const cur = days.find((d) => d.day === day)
  const items = { ...(cur?.items ?? {}) }
  for (const s of lines) items[s.id] = (items[s.id] ?? 0) + s.amount
  const next: SalesDay = { day, total: (cur?.total ?? 0) + add, items }
  return trim([...days.filter((d) => d.day !== day), next])
}

/** 최근 7일 막대: 오늘을 맨 뒤에 두고, 판 날이 없으면 0 으로 채운다. */
export function weekTotals(days: readonly SalesDay[], today: string): { day: string; total: number }[] {
  return Array.from({ length: SALES_WEEK }, (_, i) => {
    const day = shiftDay(today, i - (SALES_WEEK - 1))
    return { day, total: days.find((d) => d.day === day)?.total ?? 0 }
  })
}

/** 오늘과 어제의 차이. 어제 기록이 없으면 오늘 합계 그대로다. */
export function vsYesterday(days: readonly SalesDay[], today: string): number {
  const now = days.find((d) => d.day === today)?.total ?? 0
  const prev = days.find((d) => d.day === shiftDay(today, -1))?.total ?? 0
  return now - prev
}

/** 최근 7일에 가장 많이 팔린 물건 상위 n개(금액 내림차순). */
export function topItems(days: readonly SalesDay[], today: string, n = SALES_TOP): { id: string; amount: number }[] {
  const start = shiftDay(today, -(SALES_WEEK - 1))
  const sum: Record<string, number> = {}
  for (const d of days) {
    if (d.day < start || d.day > today) continue
    for (const [id, amount] of Object.entries(d.items)) sum[id] = (sum[id] ?? 0) + amount
  }
  return Object.entries(sum)
    .filter(([id, amount]) => amount > 0 && ITEMS[id] !== undefined)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([id, amount]) => ({ id, amount }))
}

/** 불러온 장부 검사. 날짜가 틀리거나 금액이 음수인 줄은 버리고, 같은 날은 하나로 합치지 않고 뒤의 것을 쓴다. */
export function cleanSalesLedger(v: unknown): SalesDay[] {
  if (!Array.isArray(v)) return []
  const out: SalesDay[] = []
  for (const x of v) {
    if (!x || typeof x !== 'object') continue
    const o = x as Partial<Record<keyof SalesDay, unknown>>
    if (typeof o.day !== 'string' || dayIndex(o.day) === null) continue
    if (typeof o.total !== 'number' || !Number.isFinite(o.total) || o.total < 0) continue
    const items: Record<string, number> = {}
    if (o.items && typeof o.items === 'object') {
      for (const [id, amount] of Object.entries(o.items as Record<string, unknown>)) {
        if (ITEMS[id] && typeof amount === 'number' && Number.isFinite(amount) && amount > 0) items[id] = amount
      }
    }
    out.push({ day: o.day, total: o.total, items })
  }
  const byDay = new Map(out.map((d) => [d.day, d]))
  return trim([...byDay.values()])
}
