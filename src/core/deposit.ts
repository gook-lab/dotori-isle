/**
 * ATM 정기 예금. 지갑의 도토리를 정해진 날수 동안 묶어 두고, 만기 날 아침에 원금과 이자를 통장에 넣는다.
 *
 * - 한 번에 한 건만 맡길 수 있다. 상품은 3일(이자 2%, 상한 100)과 7일(이자 6%, 상한 300) 두 가지다.
 * - 원금은 1 이상 5000 이하의 정수이고, 맡기는 순간 지갑에서 빠진다.
 * - 만기 입금은 통장 한도를 무시한다. 한도 때문에 원금을 잃지 않게 하려는 것이다.
 * - 이자는 맡길 때 정해지므로 며칠 늦게 와도 한 번만 붙는다. 만기가 지나면 그날 아침 자동으로 정산된다.
 * - 중도 해지는 원금만 통장으로 돌아오고 이자는 없다. 만기가 지난 예금은 해지할 수 없다.
 *
 * 저장은 `deposit` 한 칸에 맡긴 건 하나(없으면 null)만 남긴다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { addDays, dayDiff, dayIndex, BAD_AMOUNT, BAD_DAY, isWholeAmount, type Result } from './economy'
import { FIRST_HINTS } from './firstHints'

export const DEPOSIT_MAX = 5000

export interface DepositTerm {
  days: number
  /** 이자율(원금 기준) */
  rate: number
  /** 이자 상한 */
  cap: number
}

export const DEPOSIT_TERMS: readonly DepositTerm[] = [
  { days: 3, rate: 0.02, cap: 100 },
  { days: 7, rate: 0.06, cap: 300 },
]

export interface FixedDeposit {
  principal: number
  days: number
  /** 맡긴 날 */
  start: string
  /** 만기 날(start + days). 이 날 아침에 정산한다. */
  due: string
}

export const termOf = (days: number): DepositTerm | null => DEPOSIT_TERMS.find((t) => t.days === days) ?? null

/** 원금에 붙을 이자. 소수는 내림하고 상한을 넘지 않는다. */
export function depositInterest(principal: number, days: number): number {
  const t = termOf(days)
  if (!t) return 0
  return Math.min(Math.floor(principal * t.rate), t.cap)
}

/** 지갑에서 맡기기. 한 건만 가능하고, 원금 상한과 지갑 잔고를 지켜야 한다. */
export function openDeposit(current: FixedDeposit | null, money: number, amount: number, days: number, day: string): Result<{ deposit: FixedDeposit; money: number }> {
  if (dayIndex(day) === null) return { ok: false, reason: BAD_DAY }
  if (!isWholeAmount(amount)) return { ok: false, reason: BAD_AMOUNT }
  if (current) return { ok: false, reason: '정기 예금은 한 건만 맡길 수 있어요. 만기를 기다리거나 중도 해지해 주세요' }
  if (!termOf(days)) return { ok: false, reason: '3일이나 7일짜리 예금만 있어요' }
  if (amount > DEPOSIT_MAX) return { ok: false, reason: `예금은 한 번에 도토리 ${DEPOSIT_MAX.toLocaleString()}개까지 맡길 수 있어요` }
  if (amount > money) return { ok: false, reason: '가진 도토리가 모자라요' }
  const due = addDays(day, days)
  if (due === null) return { ok: false, reason: BAD_DAY }
  return { ok: true, deposit: { principal: amount, days, start: day, due }, money: money - amount }
}

/** 만기 정산. 만기 날이 됐으면 원금과 이자를 돌려주고 예금을 비운다. 아니면 그대로 둔다. */
export function settleDeposit(dep: FixedDeposit | null, day: string): { deposit: FixedDeposit | null; payout: number; interest: number } {
  if (!dep) return { deposit: null, payout: 0, interest: 0 }
  const left = dayDiff(day, dep.due)
  if (left === null || left > 0) return { deposit: dep, payout: 0, interest: 0 }
  const interest = depositInterest(dep.principal, dep.days)
  return { deposit: null, payout: dep.principal + interest, interest }
}

/** 중도 해지: 원금만 통장으로 돌아간다. 만기가 지났으면 해지할 수 없다. */
export function breakDeposit(dep: FixedDeposit | null, day: string): Result<{ principal: number }> {
  if (!dep) return { ok: false, reason: '맡긴 예금이 없어요' }
  const left = dayDiff(day, dep.due)
  if (left === null) return { ok: false, reason: BAD_DAY }
  if (left <= 0) return { ok: false, reason: '만기된 예금은 해지할 수 없어요. 만기 날 아침에 통장으로 들어가요' }
  return { ok: true, principal: dep.principal }
}

/** 저장에서 읽은 예금을 검증한다. 맞지 않으면 null(예금 없음). 만기일은 맡긴 날과 날수로 다시 확인한다. */
export function cleanDeposit(v: unknown): FixedDeposit | null {
  if (!v || typeof v !== 'object') return null
  const { principal, days, start, due } = v as Record<string, unknown>
  if (!isWholeAmount(principal) || principal > DEPOSIT_MAX) return null
  if (typeof days !== 'number' || !termOf(days)) return null
  if (typeof start !== 'string' || typeof due !== 'string' || dayIndex(start) === null) return null
  if (addDays(start, days) !== due) return null
  return { principal, days, start, due }
}

/**
 * 정기 예금 만기 아침 토스트. 처음 만기 한 번만 입출금 탭 안내 꼬리를 붙이고, 그 뒤에는 짧게 알린다.
 * first 는 firstHintOnce(seenHints, 'deposit') 로 정한다(이미 본 안내는 다시 붙이지 않는다).
 */
export function depositMaturedLine(days: number, interest: number, first: boolean): string {
  if (!first) return `💰 ${days}일 예금이 끝나 이자 도토리 ${interest.toLocaleString()}개가 통장에 들어왔어요`
  return `🏦 ${days}일 예금이 만기됐어요. 이자 도토리 ${interest.toLocaleString()}개를 더해 통장에 넣었어요. ${FIRST_HINTS.deposit}`
}
