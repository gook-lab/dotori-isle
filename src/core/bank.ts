/**
 * 도토리 ATM — 저금통장, 하루 인출 한도, 달마다 붙는 작은 이자, 집 빚 갚기, 마일리지 상품.
 *
 * 지갑(money)과 통장(savings)은 따로 있다. 지갑은 상점에서 바로 쓰고, 통장은 모아 두는 곳이다.
 * 이자는 날짜 키로 세서 30일마다 한 번 붙는다. 같은 날이면 몇 번을 열어도 같다.
 *
 * 숫자 근거:
 * - 이자 0.5%/30일 은 연 6% 안팎의 단리로, 큰돈을 모아 두는 맛만 준다(상점 계산을 흔들지 않게 작게).
 * - 이자 상한 1000/달: 통장이 20만을 넘으면 더 붙지 않는다. 무한 복리로 경제가 뒤집히는 것을 막는다.
 * - 통장 한도 30만(기본)은 "조금씩 모은" 플레이어의 큰 잔고 상한이다. 마일리지로 20만씩 3번 늘린다.
 * - 하루 인출 3000(기본)은 상점 2단계 6000 의 절반이다. 한 번에 다 꺼내 사는 것을 막고 하루에 한 번 들르게 한다.
 *   마일리지로 2000씩 3번 늘린다.
 * - 도토리 쿠폰 1장은 500 도토리 값이다. 마일리지 400 → 500 도토리(1마일 ≈ 1.25 도토리).
 *   M 패널의 교환소(여행 티켓 300·레시피 400·주머니 1000·황금 도토리상 3000)와 겹치지 않게
 *   여기는 "도토리로 바꿔 주는" 상품만 둔다. 통장 한도·인출 한도는 M 패널에 없다.
 */

import { addDays, BAD_AMOUNT, BAD_DAY, dayDiff, dayIndex, isNonNegativeAmount, isWholeAmount, type Result } from './economy'
import { applyPayment } from './home'

export const INTEREST_RATE = 0.005
export const INTEREST_PERIOD_DAYS = 30
export const INTEREST_CAP = 1000
/** 이자 한도를 마일리지 상품으로 한 번 늘릴 때 더해지는 양 */
export const INTEREST_CAP_STEP = 1000
export const SAVINGS_BASE_CAP = 300_000
export const SAVINGS_CAP_STEP = 200_000
export const WITHDRAW_BASE = 3000
export const WITHDRAW_STEP = 2000
/** 마일리지로 한도를 늘리는 횟수 상한. 두 상품 모두 3번이다. */
export const LIMIT_UPGRADE_MAX = 3
export const COUPON_VALUE = 500
/** 하루에 마일로 살 수 있는 쿠폰 장 수. 쿠폰 묶음도 장 수로 센다. */
export const COUPON_DAILY_MAX = 2

export interface BankState {
  /** 통장 잔고 */
  savings: number
  /** 이자를 마지막으로 계산한 날. 이 날부터 30일 단위로 센다. */
  day: string
  /** 오늘(withdrawnDay) 뺀 금액 */
  withdrawnDay: string
  withdrawnToday: number
  /** 마일리지로 늘린 횟수 */
  capUpgrades: number
  limitUpgrades: number
  /** 마일리지 상품을 산 횟수(상품 id 별). 예전 저장에는 없어서 없으면 0 이다. */
  perks?: Record<string, number>
  /** 그날 마일로 산 쿠폰 장 수. 날이 바뀌면 0 이다. 예전 저장에는 없다. */
  coupons?: { day: string; n: number }
}

export function createBank(day: string): BankState {
  return { savings: 0, day, withdrawnDay: day, withdrawnToday: 0, capUpgrades: 0, limitUpgrades: 0 }
}

export function savingsCap(state: BankState): number {
  return SAVINGS_BASE_CAP + state.capUpgrades * SAVINGS_CAP_STEP
}

export function withdrawLimit(state: BankState): number {
  return WITHDRAW_BASE + state.limitUpgrades * WITHDRAW_STEP
}

/**
 * 밀린 이자를 붙인다. 30일이 지난 횟수만큼 한 번씩 계산하고, 남은 날은 다음에 이어 센다.
 * 날짜가 거꾸로 가거나 잘못된 키면 아무것도 하지 않는다.
 */
export function accrueInterest(state: BankState, day: string): BankState {
  const diff = dayDiff(state.day, day)
  if (diff === null || diff < INTEREST_PERIOD_DAYS) return state
  const periods = Math.floor(diff / INTEREST_PERIOD_DAYS)
  let savings = state.savings
  const cap = savingsCap(state)
  for (let i = 0; i < periods; i++) {
    // 반올림 없이 내림한다. 이자는 항상 정수 도토리다.
    const interest = Math.min(Math.floor(savings * INTEREST_RATE), interestCap(state))
    savings = Math.min(savings + interest, cap)
  }
  const next = addDays(state.day, periods * INTEREST_PERIOD_DAYS)
  return { ...state, savings, day: next ?? state.day }
}

/**
 * 다음 이자까지 남은 날과 그때 붙을 이자의 어림값. 지금 잔고와 한도로 계산하므로 실제 금액은 그날 잔고에 따라 달라진다.
 * 이자 날짜는 accrueInterest 와 같은 기준(마지막 계산일 + 30일 단위)이다.
 */
export function nextInterest(state: BankState, day: string): { days: number; amount: number } | null {
  const s = accrueInterest(state, day)
  const diff = dayDiff(s.day, day)
  if (diff === null) return null
  const days = INTEREST_PERIOD_DAYS - Math.max(0, diff)
  const room = Math.max(0, savingsCap(s) - s.savings)
  const amount = Math.min(Math.floor(s.savings * INTEREST_RATE), interestCap(s), room)
  return { days, amount }
}

/** 오늘 인출 기록. 날이 바뀌었으면 0 으로 본다. */
function usedToday(state: BankState, day: string): number {
  return state.withdrawnDay === day ? state.withdrawnToday : 0
}

/** 지금 실제로 뺄 수 있는 돈: 잔고와 오늘 남은 인출 한도 중 작은 쪽. 잔고가 0 이면 0 이다. */
export function withdrawableNow(state: BankState, day: string): number {
  return Math.max(0, Math.min(state.savings, withdrawLimit(state) - usedToday(state, day)))
}

/** 지갑 → 통장. 통장 한도를 넘으면 실패한다. 이자는 먼저 붙인다. */
export function deposit(state: BankState, money: number, amount: number, day: string): Result<{ state: BankState; money: number }> {
  if (dayIndex(day) === null) return { ok: false, reason: BAD_DAY }
  if (!isNonNegativeAmount(money)) return { ok: false, reason: '도토리 금액이 잘못됐어요' }
  if (!isWholeAmount(amount)) return { ok: false, reason: BAD_AMOUNT }
  if (amount > money) return { ok: false, reason: '가진 도토리가 모자라요' }
  const s = accrueInterest(state, day)
  const cap = savingsCap(s)
  if (s.savings + amount > cap) {
    return { ok: false, reason: `통장 한도는 도토리 ${cap.toLocaleString()}개예요. 도토리 ${(cap - s.savings).toLocaleString()}개까지만 넣을 수 있어요` }
  }
  return { ok: true, state: { ...s, savings: s.savings + amount }, money: money - amount }
}

/** 통장 → 지갑. 하루 인출 한도와 통장 잔고를 모두 지켜야 한다. */
export function withdraw(state: BankState, amount: number, day: string): Result<{ state: BankState; gained: number }> {
  if (dayIndex(day) === null) return { ok: false, reason: BAD_DAY }
  if (!isWholeAmount(amount)) return { ok: false, reason: BAD_AMOUNT }
  const s = accrueInterest(state, day)
  if (amount > s.savings) return { ok: false, reason: '통장에 그만큼 없어요' }
  const limit = withdrawLimit(s)
  const left = limit - usedToday(s, day)
  if (left <= 0) return { ok: false, reason: '오늘 인출 한도를 다 썼어요. 내일 다시 와요' }
  if (amount > left) return { ok: false, reason: `오늘은 도토리 ${left.toLocaleString()}개까지 뺄 수 있어요` }
  return {
    ok: true,
    gained: amount,
    state: { ...s, savings: s.savings - amount, withdrawnDay: day, withdrawnToday: usedToday(s, day) + amount },
  }
}

/**
 * 통장에서 집 빚 갚기. 빚보다 많이 내면 빚만큼만 빠진다(applyPayment 와 같은 규칙).
 * 통장에 갚을 만큼이 없으면 실패한다. 인출 한도는 세지 않는다(빚 갚기는 인출이 아니다).
 */
export function repayLoan(state: BankState, loan: number, amount: number, day: string): Result<{ state: BankState; loan: number; paid: number }> {
  if (dayIndex(day) === null) return { ok: false, reason: BAD_DAY }
  const s = accrueInterest(state, day)
  const r = applyPayment(loan, amount)
  if (!r.ok) return r
  if (s.savings < r.paid) return { ok: false, reason: '통장에 갚을 만큼이 없어요' }
  return { ok: true, state: { ...s, savings: s.savings - r.paid }, loan: r.balance, paid: r.paid }
}

export interface AtmProduct {
  id: string
  name: string
  icon: string
  cost: number
  note: string
  /** 한 번만 살 수 있는 것이 아니면 상한 */
  max: number | null
  /** 사면 주머니에 넣어 주는 물건(없으면 한도 같은 업그레이드) */
  grant?: { itemId: string; count: number }
}

/**
 * ATM 마일리지 상품. M 패널과 겹치지 않게 "도토리로 바꿔 주는" 것과 ATM 전용 한도만 둔다.
 * 쿠폰은 items.ts 에 `acorn-coupon`(price 500)으로 추가한 뒤 주머니에 넣는다.
 */
export const ATM_PRODUCTS: readonly AtmProduct[] = [
  { id: 'coupon', name: '도토리 쿠폰', icon: '🎟️', cost: 400, note: `상점에 팔면 도토리 ${COUPON_VALUE.toLocaleString()}개예요`, max: null },
  { id: 'savings-cap', name: '통장 한도 늘리기', icon: '📗', cost: 1500, note: `통장 한도가 도토리 ${SAVINGS_CAP_STEP.toLocaleString()}개 늘어나요`, max: LIMIT_UPGRADE_MAX },
  { id: 'withdraw-limit', name: '하루 인출 늘리기', icon: '💳', cost: 600, note: `하루에 도토리 ${WITHDRAW_STEP.toLocaleString()}개 더 뺄 수 있어요`, max: LIMIT_UPGRADE_MAX },
  { id: 'interest-cap', name: '이자 한도 늘리기', icon: '🐿️', cost: 800, note: `한 번에 붙는 이자 한도가 도토리 ${INTEREST_CAP_STEP.toLocaleString()}개 늘어나요`, max: 3 },
  { id: 'seed-pack', name: '꽃씨 묶음', icon: '🌱', cost: 120, note: '꽃씨 5개가 주머니에 들어가요', max: 6, grant: { itemId: 'flower-seed', count: 5 } },
  { id: 'wood-pack', name: '목재 묶음', icon: '🪵', cost: 200, note: '목재 10개가 주머니에 들어가요', max: 5, grant: { itemId: 'wood', count: 10 } },
  { id: 'coupon-pack', name: '도토리 쿠폰 묶음', icon: '🎫', cost: 750, note: '쿠폰 2장이 주머니에 들어가요', max: null, grant: { itemId: 'acorn-coupon', count: 2 } },
  // 섬 고유 가구: 마일로만 받는다. 한 번씩만 살 수 있다.
  { id: 'acorn-cushion', name: '도토리 방석', icon: '🌰', cost: 1200, note: '주머니에 도토리 방석이 들어가요 (한 번만)', max: 1, grant: { itemId: 'acorn-cushion', count: 1 } },
  { id: 'acorn-vase', name: '도토리 꽃병', icon: '🏺', cost: 1800, note: '주머니에 도토리 꽃병이 들어가요 (한 번만)', max: 1, grant: { itemId: 'acorn-vase', count: 1 } },
  { id: 'acorn-lantern', name: '도토리 등불', icon: '🏮', cost: 2400, note: '주머니에 도토리 등불이 들어가요 (한 번만)', max: 1, grant: { itemId: 'acorn-lantern', count: 1 } },
]

/** 마일리지 상품을 몇 번 샀는지. 저장값이 잘못됐으면 0 으로 본다. */
export function perkCount(state: BankState, id: string): number {
  const n = state.perks?.[id]
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

/** 지금 이자 한도: 기본 한도에 마일리지로 늘린 만큼 더한다. */
export function interestCap(state: BankState): number {
  return INTEREST_CAP + perkCount(state, 'interest-cap') * INTEREST_CAP_STEP
}

export interface AtmPurchase {
  state: BankState
  miles: number
  /** 주머니에 넣을 물건(쿠폰·꽃씨·목재 묶음) */
  grant: { itemId: string; count: number } | null
}

/** 오늘 더 살 수 있는 쿠폰 장 수 */
export function couponsLeft(state: BankState, day: string): number {
  const used = state.coupons?.day === day ? state.coupons.n : 0
  return Math.max(0, COUPON_DAILY_MAX - used)
}

/** 불러온 쿠폰 기록 검사. 날짜나 장 수가 틀리면 버린다(그날 산 것 없음으로 본다). */
export function cleanCoupons(v: unknown): { day: string; n: number } | undefined {
  if (!v || typeof v !== 'object') return undefined
  const { day, n } = v as Record<string, unknown>
  if (typeof day !== 'string' || dayIndex(day) === null) return undefined
  if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > COUPON_DAILY_MAX) return undefined
  return { day, n: n as number }
}

/** 마일리지로 ATM 상품 사기. 마일이 모자라거나 상한을 넘으면 실패한다. 쿠폰은 하루 장 수 상한을 함께 본다. */
export function buyAtmProduct(state: BankState, miles: number, productId: string, day: string): Result<AtmPurchase> {
  if (!isNonNegativeAmount(miles)) return { ok: false, reason: '마일이 잘못됐어요' }
  const p = ATM_PRODUCTS.find((x) => x.id === productId)
  if (!p) return { ok: false, reason: '없는 상품이에요' }
  if (miles < p.cost) return { ok: false, reason: '마일이 모자라요' }
  if (p.id === 'savings-cap') {
    if (state.capUpgrades >= LIMIT_UPGRADE_MAX) return { ok: false, reason: '통장 한도는 이미 최대예요' }
    return { ok: true, state: { ...state, capUpgrades: state.capUpgrades + 1 }, miles: miles - p.cost, grant: null }
  }
  if (p.id === 'withdraw-limit') {
    if (state.limitUpgrades >= LIMIT_UPGRADE_MAX) return { ok: false, reason: '인출 한도는 이미 최대예요' }
    return { ok: true, state: { ...state, limitUpgrades: state.limitUpgrades + 1 }, miles: miles - p.cost, grant: null }
  }
  const coupon = p.id === 'coupon' ? { itemId: 'acorn-coupon', count: 1 } : p.grant?.itemId === 'acorn-coupon' ? p.grant : null
  if (coupon) {
    const left = couponsLeft(state, day)
    if (coupon.count > left) return { ok: false, reason: left === 0 ? '오늘 쿠폰은 다 샀어요. 내일 다시 살 수 있어요' : `오늘은 쿠폰 ${left}장까지만 살 수 있어요` }
    const used = (state.coupons?.day === day ? state.coupons.n : 0) + coupon.count
    return { ok: true, state: { ...state, coupons: { day, n: used } }, miles: miles - p.cost, grant: coupon }
  }
  // 나머지 상품은 상한을 세고, 같은 자리에 횟수를 적는다
  const done = perkCount(state, p.id)
  if (p.max !== null && done >= p.max) return { ok: false, reason: '이 상품은 이미 최대예요' }
  const next = { ...state, perks: { ...state.perks, [p.id]: done + 1 } }
  return { ok: true, state: next, miles: miles - p.cost, grant: p.grant ?? null }
}
