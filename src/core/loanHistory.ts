/**
 * 대출 상환 기록. 얼마를 빌렸고(짓기를 맡길 때), 얼마를 갚았고(지갑·통장), 최근 상환 3건이 무엇인지 남긴다.
 * 빚 잔액(home.loan)과는 따로 둔다. 잔액은 갚을 때마다 줄고, 이 기록은 누적과 최근 목록만 보여 준다.
 * 저장은 선택 필드라 예전 저장에는 없다. 없으면 빈 기록이다.
 */

import { dayIndex, isNonNegativeAmount, isWholeAmount } from './economy'
import { homeDef, type HomeState } from './home'

export const LOAN_RECENT = 3

export interface LoanPayment {
  day: string
  amount: number
  from: 'pocket' | 'savings'
}

export interface LoanHistory {
  /** 지금까지 빌린 총액 */
  borrowed: number
  /** 지금까지 갚은 총액 */
  paid: number
  /** 최근 상환, 새 것이 앞에 온다. 최대 LOAN_RECENT 건. */
  recent: LoanPayment[]
}

export const EMPTY_LOAN_HISTORY: LoanHistory = { borrowed: 0, paid: 0, recent: [] }

const FROM: readonly LoanPayment['from'][] = ['pocket', 'savings']

function cleanPayment(v: unknown): LoanPayment | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  if (typeof p.day !== 'string' || dayIndex(p.day) === null) return null
  if (!isWholeAmount(p.amount)) return null
  if (!FROM.includes(p.from as LoanPayment['from'])) return null
  return { day: p.day, amount: p.amount, from: p.from as LoanPayment['from'] }
}

/** 저장에서 읽은 기록을 검증한다. 틀린 값은 빈 값으로 본다. 누적 갚은 금액은 빌린 금액을 넘지 않는다. */
export function cleanLoanHistory(v: unknown): LoanHistory {
  if (!v || typeof v !== 'object') return EMPTY_LOAN_HISTORY
  const h = v as Record<string, unknown>
  const borrowed = isNonNegativeAmount(h.borrowed) ? h.borrowed : 0
  const paid = isNonNegativeAmount(h.paid) ? Math.min(h.paid, borrowed) : 0
  const recent = Array.isArray(h.recent) ? h.recent.map(cleanPayment).filter((p): p is LoanPayment => p !== null).slice(0, LOAN_RECENT) : []
  return { borrowed, paid, recent }
}

/**
 * 기록이 없는 예전 저장에서 기록을 만든다. 지금 빚(loan)이 있으면 그 빚을 잡은 단계의 대출 금액을 빌린 총액으로,
 * 나머지를 갚은 금액으로 본다. 최근 상환은 알 수 없으니 비운다. 빚이 0 이거나 단계 금액보다 크면(표와 안 맞으면) 만들지 않는다.
 */
export function legacyLoanHistory(home: HomeState): LoanHistory {
  if (home.loan <= 0) return EMPTY_LOAN_HISTORY
  // 짓기를 맡긴 중이면 빚은 그 목표 단계 것이고, 아니면 지금 단계 것이다.
  const borrowed = homeDef(home.order ? home.order.to : home.stage).loan
  if (borrowed <= 0 || home.loan > borrowed) return EMPTY_LOAN_HISTORY
  return { borrowed, paid: borrowed - home.loan, recent: [] }
}

/** 짓기를 맡기며 빌린 대출을 더한다. */
export function recordBorrow(h: LoanHistory, amount: number): LoanHistory {
  if (!isWholeAmount(amount)) return h
  return { ...h, borrowed: h.borrowed + amount }
}

/** 상환 한 건을 남긴다. 실제로 갚은 금액(paid)을 넣는다. */
export function recordPayment(h: LoanHistory, day: string, amount: number, from: LoanPayment['from']): LoanHistory {
  if (!isWholeAmount(amount) || dayIndex(day) === null) return h
  const recent = [{ day, amount, from }, ...h.recent].slice(0, LOAN_RECENT)
  return { ...h, paid: h.paid + amount, recent }
}
