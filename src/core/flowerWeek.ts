/**
 * 봄 "꽃 심기 주간": 4월 1~7일. 꽃씨를 심으면 마일을 조금 더 주고, 물을 주면 그보다 적게 준다.
 * 하루 보너스에는 상한이 있어서 봄 한 주에 받는 양이 정해져 있다(연간 마일 예산을 흔들지 않게).
 * 저장은 `flowerWeek` 한 칸(선택 필드)이고, 없거나 맞지 않으면 처음 상태로 본다.
 */

import type { Letter } from './letters'
import { formatMiles } from './miles'

/** 주간 중 하루에 받는 보너스 마일 상한 */
export const FLOWER_DAY_CAP = 10
/** 꽃씨 한 개를 심을 때의 보너스 마일 */
export const FLOWER_PLANT_MILES = 2
/** 꽃 한 송이에 물을 줄 때의 보너스 마일 */
export const FLOWER_WATER_MILES = 1

export interface FlowerWeekState {
  /** 보너스를 받은 날 키. 다른 날이면 오늘 받은 양은 0이다. */
  day: string | null
  /** 그 날 받은 보너스 마일 */
  miles: number
}

export const NEW_FLOWER_WEEK: FlowerWeekState = { day: null, miles: 0 }

/** 4월 1~7일이면 꽃 심기 주간이다. */
export function flowerWeekOn(day: string): boolean {
  return day.slice(5, 7) === '04' && Number(day.slice(8, 10)) <= 7
}

/** 주간 첫날(4월 1일)인지. 아침 편지는 이날 한 번만 보낸다. */
export function flowerWeekStart(day: string): boolean {
  return day.slice(5) === '04-01'
}

/** 오늘 이미 받은 보너스 마일 */
function todayMiles(state: FlowerWeekState, day: string): number {
  return state.day === day ? state.miles : 0
}

/**
 * 꽃을 심거나(plant) 물을 준(water) 뒤 보너스를 계산한다. count 는 심은 씨앗 수나 물 준 꽃 수다.
 * 상한을 넘으면 남은 만큼만 준다. 주간이 아니면 0이다.
 */
export function flowerBonus(state: FlowerWeekState, kind: 'plant' | 'water', count: number, day: string): { state: FlowerWeekState; miles: number } {
  if (!flowerWeekOn(day) || count <= 0) return { state, miles: 0 }
  const per = kind === 'plant' ? FLOWER_PLANT_MILES : FLOWER_WATER_MILES
  const have = todayMiles(state, day)
  const miles = Math.min(Math.max(0, FLOWER_DAY_CAP - have), per * count)
  return { state: { day, miles: have + miles }, miles }
}

/** 상점 창이 아니라 HUD 의 한 줄. 주간이 아니면 null 이다. */
export function flowerWeekLine(state: FlowerWeekState, day: string): string | null {
  if (!flowerWeekOn(day)) return null
  const have = todayMiles(state, day)
  if (have >= FLOWER_DAY_CAP) return `🌷 꽃 심기 주간 · 오늘 보너스를 다 받았어요`
  return `🌷 꽃 심기 주간 · 오늘 ${have}/${formatMiles(FLOWER_DAY_CAP)}`
}

/** 저장에서 읽은 값을 검증한다. 날짜가 맞지 않거나 상한을 넘으면 처음 상태다. */
export function cleanFlowerWeek(v: unknown): FlowerWeekState {
  if (typeof v !== 'object' || v === null) return NEW_FLOWER_WEEK
  const o = v as Record<string, unknown>
  const day = typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : null
  const miles = typeof o.miles === 'number' && Number.isInteger(o.miles) && o.miles >= 0 && o.miles <= FLOWER_DAY_CAP ? o.miles : 0
  return day === null ? NEW_FLOWER_WEEK : { day, miles }
}

/** 주간 첫날 아침 편지 한 통. 날짜로 id 를 정해 하루에 한 통이다. */
export function flowerWeekLetter(day: string): Letter {
  return {
    id: `flower-week-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: `4월 첫째 주는 꽃 심기 주간이에요. 꽃씨를 심으면 ${formatMiles(FLOWER_PLANT_MILES)}, 물을 주면 ${formatMiles(FLOWER_WATER_MILES)}을 더 받아요. 하루에 ${formatMiles(FLOWER_DAY_CAP)}까지예요.`,
    gift: null,
    read: false,
    claimed: false,
  }
}
