/**
 * 주민 집 증축 기부. 내 집을 5단계까지 짓고 나면, 이미 지은 주민 집을 한 채씩 넓히도록 도토리를 기부한다.
 * - 한 번에 한 집만 증축한다. 값(주민마다 5,000~8,000)이 차면 그다음 날 아침에 완성된다.
 * - 완성되면 그 집 현관에 차양이 달리고 알림 한 줄이 뜬다. 효과는 작게 둔다(장식 한 가지).
 * - 기부는 주민과 대화할 때 선택지 하나로 한다. 한 번 누를 때 1,000개씩(남은 값이나 지갑이 적으면 그만큼) 낸다.
 * 순수 함수라 React·Three 에 의존하지 않는다. 저장은 `houseExpand`(진행 중인 한 집)와 `expanded`(끝낸 집 목록) 두 칸(선택 필드)이다.
 */

import { addDays, dayDiff, dayIndex, isWholeAmount, type Result } from './economy'
import { hashString } from './rng'
import { VILLAGERS } from './villagers'

/** 증축을 열 내 집 단계(집 5단계 = 지하실 증축까지 끝난 집) */
export const HOUSE_EXPAND_STAGE = 5
/** 주민당 증축 값: 최소값과 단계 폭. 값은 주민 id 로 정해져 늘 같다(4단계: 5,000 ~ 8,000). */
export const EXPAND_MIN = 5000
export const EXPAND_STEP = 1000
export const EXPAND_STEPS = 4

/** 한 번 누를 때 보태는 도토리. 남은 값이 더 적으면 그만큼만 보탠다. */
export const HOUSE_TAP = 1000

/** 진행 중인 한 집: 주민 id, 모은 도토리, 완성되는 날(값이 차면 다음 날, 아니면 null) */
export interface HouseExpand {
  villagerId: string
  fund: number
  ready: string | null
}

/** 주민 한 집의 증축 값(도토리) */
export function expandCost(villagerId: string): number {
  return EXPAND_MIN + (hashString(`house-expand:${villagerId}`) % EXPAND_STEPS) * EXPAND_STEP
}

/** 증축할 수 있는 집인가: 내 집 단계가 충분하고, 그 주민 집이 지어져 있고, 아직 증축하지 않았다. */
export function expandable(homeStage: number, houses: readonly string[], expanded: readonly string[], villagerId: string): boolean {
  return homeStage >= HOUSE_EXPAND_STAGE && houses.includes(villagerId) && !expanded.includes(villagerId)
}

/** 대화 선택지에 띄울 남은 값. 증축할 수 없으면 null. 다른 집이 진행 중이면 그 집만 보인다. */
export function expandOffer(
  homeStage: number,
  houses: readonly string[],
  expanded: readonly string[],
  current: HouseExpand | null,
  villagerId: string,
): { remaining: number } | null {
  if (!expandable(homeStage, houses, expanded, villagerId)) return null
  if (current && current.villagerId !== villagerId) return null
  if (current?.ready) return null
  const fund = current?.villagerId === villagerId ? current.fund : 0
  const remaining = expandCost(villagerId) - fund
  return remaining > 0 ? { remaining } : null
}

/**
 * 기부. 지갑(money)이 모자라거나 남은 값(cost − fund)을 넘으면 실패한다. 값이 차면 다음 날을 완성일로 적는다.
 * 다른 집이 진행 중이면 실패한다.
 */
export function donateHouse(
  current: HouseExpand | null,
  money: number,
  amount: number,
  day: string,
  villagerId: string,
): Result<{ state: HouseExpand; money: number; done: boolean }> {
  if (current && current.villagerId !== villagerId) return { ok: false, reason: '다른 집을 먼저 증축하고 있어요' }
  if (current?.ready) return { ok: false, reason: '이 집은 내일 아침에 완성돼요' }
  if (dayIndex(day) === null) return { ok: false, reason: '날짜가 잘못됐어요' }
  if (!isWholeAmount(amount) || amount <= 0) return { ok: false, reason: '도토리는 1 이상으로 내 주세요' }
  if (amount > money) return { ok: false, reason: '도토리가 모자라요' }
  const fund = current?.villagerId === villagerId ? current.fund : 0
  const cost = expandCost(villagerId)
  if (amount > cost - fund) return { ok: false, reason: '이 집에는 그만큼 더 낼 필요가 없어요' }
  const next = fund + amount
  const done = next >= cost
  const ready = done ? addDays(day, 1) : null
  return { ok: true, state: { villagerId, fund: next, ready }, money: money - amount, done }
}

/**
 * 아침마다 부른다. 완성일이 되었으면 그 집을 증축 목록에 넣고 진행 중 칸을 비운다.
 * 완성된 집 id 를 돌려준다(없으면 null).
 */
export function completeHouseExpand(
  current: HouseExpand | null,
  expanded: readonly string[],
  day: string,
): { current: HouseExpand | null; expanded: string[]; done: string | null } {
  if (!current?.ready) return { current, expanded: [...expanded], done: null }
  const left = dayDiff(day, current.ready)
  if (left === null || left > 0) return { current, expanded: [...expanded], done: null }
  return { current: null, expanded: expanded.includes(current.villagerId) ? [...expanded] : [...expanded, current.villagerId], done: current.villagerId }
}

/** 완성 알림 한 줄 */
export function expandDoneLine(villagerId: string): string {
  const name = VILLAGERS.find((v) => v.id === villagerId)?.name ?? villagerId
  return `🏠 ${name}네 집 현관에 차양이 달렸어요`
}

/** 한 번 누를 때 실제로 보태는 도토리: 탭 값과 남은 값 중 작은 쪽, 지갑이 모자라면 지갑만큼 */
export function houseTapAmount(remaining: number, money: number): number {
  return Math.max(0, Math.min(HOUSE_TAP, remaining, money))
}

/** 대화 선택지 글: 한 번에 보태는 양과 남은 도토리를 보여 준다 */
export function expandChoiceLabel(villagerId: string, remaining: number): string {
  const name = VILLAGERS.find((v) => v.id === villagerId)?.name ?? villagerId
  const tap = Math.min(HOUSE_TAP, remaining)
  return `🏠 ${name}네 집 증축 돕기 · 도토리 ${tap.toLocaleString()}개 (남은 도토리 ${remaining.toLocaleString()}개)`
}

/** 불러온 진행 칸 검사. 주민 id·값·날짜가 맞지 않으면 버린다. */
export function cleanHouseExpand(v: unknown): HouseExpand | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Partial<Record<keyof HouseExpand, unknown>>
  if (typeof o.villagerId !== 'string' || !VILLAGERS.some((x) => x.id === o.villagerId)) return null
  const id = o.villagerId
  if (!Number.isInteger(o.fund) || (o.fund as number) < 0 || (o.fund as number) > expandCost(id)) return null
  if (!(o.ready === null || (typeof o.ready === 'string' && dayIndex(o.ready) !== null))) return null
  return { villagerId: id, fund: o.fund as number, ready: o.ready as string | null }
}

/** 증축을 끝낸 집의 감사 편지 기록: 주민 id 와 완성 아침 날짜. 다음 날 아침에 한 번 보내고 비운다. */
export interface HouseThanks {
  id: string
  day: string
}

/** 불러온 감사 편지 기록 검사. 모르는 주민이나 날짜가 맞지 않으면 null(없음). */
export function cleanHouseThanks(v: unknown): HouseThanks | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Partial<Record<keyof HouseThanks, unknown>>
  if (typeof o.id !== 'string' || !VILLAGERS.some((x) => x.id === o.id)) return null
  if (typeof o.day !== 'string' || dayIndex(o.day) === null) return null
  return { id: o.id, day: o.day }
}

/** 불러온 증축 완료 목록 검사. 모르는 주민과 중복은 뺀다. */
export function cleanExpanded(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const id of v) if (typeof id === 'string' && VILLAGERS.some((x) => x.id === id) && !out.includes(id)) out.push(id)
  return out
}
