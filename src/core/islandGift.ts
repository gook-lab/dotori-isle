/**
 * 섬 가꾸기 기부. 마일을 모아 섬 공공시설을 하나씩 들인다. 순서와 값과 자리는 여기서만 정한다.
 *
 * - 기부는 마을회관 접수대에서 한다. 마일을 조금씩 나눠 낼 수 있고, 값이 찰 때까지 쌓인다.
 * - 값이 차면 그다음 날 아침에 완성되어 섬에 나타난다. 완성 전에는 더 낼 수 없다.
 * - 저장은 `islandGift` 한 칸(선택 필드)이다. 없으면 처음 상태, 맞지 않으면 처음 상태로 본다.
 */

import { addDays, dayDiff, dayIndex, isWholeAmount, type Result } from './economy'
import { isWalkable, byWater } from './island'
import { blockedByProps } from './world'
import { flatRing, onStepSpot } from './tiers'
import { formatMiles } from './miles'
import { josa } from './items'

export interface GiftProject {
  id: string
  name: string
  icon: string
  /** 마일 값 */
  cost: number
  /** 자리를 찾을 출발점(섬 좌표). 가까운 평지를 골라 쓴다. */
  anchor: { x: number; z: number }
}

/** 앞에서부터 차례로 들인다. 이름은 섬 고유 이름이다. */
export const GIFT_PROJECTS: readonly GiftProject[] = [
  { id: 'flower-bench', name: '꽃길 벤치', icon: '🪑', cost: 3000, anchor: { x: -6, z: 6 } },
  { id: 'plaza-fountain', name: '광장 물분수', icon: '⛲', cost: 4000, anchor: { x: -9, z: -17 } },
  { id: 'pebble-bridge', name: '조약돌 징검다리', icon: '🪨', cost: 5000, anchor: { x: -20, z: -4 } },
  { id: 'lighthouse-glow', name: '등대 불빛', icon: '🗼', cost: 6000, anchor: { x: 40, z: -24 } },
]

/**
 * 2차 섬 가꾸기: 1차를 다 들이면 열린다. 값은 도토리(money)로 낸다. 따뜻한 모금 1.2배는 적용하지 않는다.
 * 앞에서부터 차례로 들인다.
 */
export const GIFT_PROJECTS_2: readonly GiftProject[] = [
  { id: 'lighthouse-lamps', name: '등대 산책로 가로등', icon: '💡', cost: 10000, anchor: { x: 38, z: -18 } },
  { id: 'beach-parasol', name: '해변 파라솔', icon: '⛱️', cost: 15000, anchor: { x: -20, z: 47 } },
  { id: 'hill-pavilion', name: '서쪽 언덕 전망 정자', icon: '🛖', cost: 20000, anchor: { x: -12, z: -30 } },
  { id: 'plaza-clock', name: '광장 시계탑', icon: '🕰️', cost: 30000, anchor: { x: 8, z: -6 } },
]

export interface IslandGiftState {
  /** 완성한 시설 수. GIFT_PROJECTS 의 앞에서부터 이만큼 섬에 있다. */
  built: number
  /** 지금 시설에 모은 마일 */
  fund: number
  /** 값이 찬 날 다음 날(완성되는 아침). 아직 아니면 null. */
  ready: string | null
}

export const NEW_ISLAND_GIFT: IslandGiftState = { built: 0, fund: 0, ready: null }

/** 지금 차례의 시설(모두 끝났으면 null). list 를 주지 않으면 1차 목록이다. */
export function currentGift(state: IslandGiftState, list: readonly GiftProject[] = GIFT_PROJECTS): GiftProject | null {
  return list[state.built] ?? null
}

/** 저장에서 읽은 기부 상태를 검증한다. 맞지 않으면 처음 상태다. */
export function cleanIslandGift(v: unknown, list: readonly GiftProject[] = GIFT_PROJECTS): IslandGiftState {
  if (!v || typeof v !== 'object') return NEW_ISLAND_GIFT
  const { built, fund, ready } = v as Record<string, unknown>
  if (typeof built !== 'number' || !Number.isInteger(built) || built < 0 || built > list.length) return NEW_ISLAND_GIFT
  const cost = list[built]?.cost ?? 0
  if (typeof fund !== 'number' || !isWholeAmount(fund) || fund > cost) return NEW_ISLAND_GIFT
  if (ready !== null && (typeof ready !== 'string' || dayIndex(ready) === null)) return NEW_ISLAND_GIFT
  return { built, fund, ready: ready as string | null }
}

/**
 * 따뜻한 모금 주간: 12월 1~7일. 이 주에는 기부한 마일이 1.2배로 적립된다.
 * 기부 패널의 표시값과 실제 적립은 모두 아래 fundedAmount 와 fundRoom 만 쓴다.
 */
export function warmFundOn(day: string): boolean {
  return day.slice(5, 7) === '12' && Number(day.slice(8, 10)) <= 7
}

/** 기간 첫날(12월 1일)인지. 아침 편지는 이날 한 번만 보낸다. */
export function warmFundStart(day: string): boolean {
  return day.slice(5) === '12-01'
}

/** 기부한 마일이 쌓이는 값: 따뜻한 모금 주간이면 1.2배를 내림한 정수(6/5), 아니면 그대로. 정수 곱셈이라 부동소수점 오차가 없다. */
export function fundedAmount(amount: number, day: string): number {
  return warmFundOn(day) ? Math.floor((amount * 6) / 5) : amount
}

/** 남은 값(left)을 넘지 않게 한 번에 낼 수 있는 가장 큰 마일. 따뜻한 모금 주간에는 1.2배로 쌓여도 남은 값을 넘지 않는 마일이다. */
export function fundRoom(left: number, day: string): number {
  return warmFundOn(day) ? Math.floor((left * 5 + 4) / 6) : left
}

/**
 * 마을회관 접수대의 한 줄 이름. 1차가 남아 있으면 따뜻한 모금 주간일 때만 바뀐다.
 * 1차를 다 들이고 2차가 남아 있으면 도토리 기부 이름을 보여 준다.
 */
export function receptionLabel(state: IslandGiftState, day: string, acorn: IslandGiftState = NEW_ISLAND_GIFT): string {
  if (currentGift(state) === null && currentGift(acorn, GIFT_PROJECTS_2) !== null) return '접수대 · 섬 가꾸기 2차 (도토리)'
  return warmFundOn(day) && currentGift(state) !== null ? '접수대 · 따뜻한 모금 1.2배 기부' : '접수대에 말 걸기'
}

/**
 * 기부. 가진 값(miles, 2차는 도토리)이 모자라거나 한 번에 낼 수 있는 값(fundRoom)을 넘으면 실패한다. 값이 차면 다음 날을 완성일로 적는다.
 * list 와 warm 을 주지 않으면 1차(마일, 따뜻한 모금 적용)다. 2차는 list=GIFT_PROJECTS_2, warm=false 로 부른다.
 */
export function donateGift(
  state: IslandGiftState,
  miles: number,
  amount: number,
  day: string,
  list: readonly GiftProject[] = GIFT_PROJECTS,
  warm = true,
): Result<{ state: IslandGiftState; miles: number; done: boolean; credited: number }> {
  const cur = currentGift(state, list)
  if (!cur) return { ok: false, reason: '섬 가꾸기가 모두 끝났어요' }
  if (state.ready) return { ok: false, reason: '이 시설은 내일 아침에 완성돼요' }
  if (!isWholeAmount(amount) || amount <= 0) return { ok: false, reason: '마일은 1 이상으로 내 주세요' }
  if (amount > miles) return { ok: false, reason: '마일이 모자라요' }
  const room = warm ? fundRoom(cur.cost - state.fund, day) : cur.cost - state.fund
  if (amount > room) return { ok: false, reason: `이 시설에는 ${formatMiles(room)}까지만 기부할 수 있어요` }
  const credited = warm ? fundedAmount(amount, day) : amount
  const fund = state.fund + credited
  const done = fund >= cur.cost
  const next = addDays(day, 1)
  if (done && next === null) return { ok: false, reason: '날짜가 잘못됐어요' }
  return { ok: true, state: { ...state, fund, ready: done ? next : null }, miles: miles - amount, done, credited }
}

/** 아침마다 부른다. 완성일이 되었으면 시설 하나를 들이고 다음 차례로 넘긴다. 완성된 시설이 있으면 그 id 도 돌려준다. */
export function morningGift(state: IslandGiftState, day: string, list: readonly GiftProject[] = GIFT_PROJECTS): { state: IslandGiftState; built: GiftProject | null } {
  if (!state.ready) return { state, built: null }
  const left = dayDiff(day, state.ready)
  if (left === null || left > 0) return { state, built: null }
  const cur = currentGift(state, list)
  if (!cur) return { state, built: null }
  return { state: { built: state.built + 1, fund: 0, ready: null }, built: cur }
}

/** 완성된 아침 알림 한 줄. 1차·2차 같은 문장을 쓰고, 이름 끝 글자의 받침에 맞춰 조사를 고른다. */
export function giftBuiltText(name: string): string {
  return `🏗 ${josa(name, '이', '가')} 완성됐어요! 섬에 나타났어요`
}

/** 진행 상황 한 줄. 예: 🏗 꽃길 벤치 1,200/3,000마일 · 다음 광장 물분수 */
export function giftLine(state: IslandGiftState, list: readonly GiftProject[] = GIFT_PROJECTS, fmt: (n: number) => string = formatMiles): string {
  const cur = currentGift(state, list)
  if (!cur) return `🏗 섬 가꾸기를 모두 마쳤어요 (${list.length}/${list.length})`
  const tail = list[state.built + 1] ? ` · 다음 ${list[state.built + 1].name}` : ''
  if (state.ready) return `🏗 ${cur.name} 완성! 내일 아침에 섬에 나타나요${tail}`
  return `🏗 ${cur.name} ${state.fund.toLocaleString()}/${fmt(cur.cost)}${tail}`
}

/**
 * 시설이 설 자리인지: 평지이고 걸을 수 있으며 물에서 떨어져 있고, 다른 물건과 겹치지 않는다.
 * boardSpot 과 같은 기준이다(flatRing · isWalkable · byWater · blockedByProps).
 */
export function giftSiteOk(x: number, z: number): boolean {
  return flatRing(x, z, 0.8) && isWalkable(x, z) && !byWater(x, z, 1) && !blockedByProps(x, z, 1.2) && !onStepSpot(x, z)
}

/** 출발점 근처에서 가장 가까운 자리. 찾지 못하면 null(테스트가 막는다). */
export function giftSite(anchor: { x: number; z: number }): { x: number; z: number } | null {
  for (let r = 0; r < 12; r += 0.5) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const x = anchor.x + Math.cos(a) * r
      const z = anchor.z + Math.sin(a) * r
      if (giftSiteOk(x, z)) return { x, z }
    }
  }
  return null
}
