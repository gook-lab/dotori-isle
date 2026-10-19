/**
 * 주민 집들이 방문: 이사 온 주민이 가끔(대략 일주일에 한 번) 내 방에 놀러 온다.
 * 방 가구 하나를 골라 쓰고, 나갈 때 방 인테리어를 보고 한마디 남긴다.
 * 날짜로 정해지는 순수 함수라 같은 날엔 언제나 같은 결과다.
 */

import { homeUse, homeUseLabel, type HomeUse } from './furnitureActions'
import { GLOWING, ITEMS, josa } from './items'
import type { Placed } from './placement'
import { hashString, mulberry32, type Rng } from './rng'

/** 하루에 방문이 있을 확률. 1/7 이면 평균 일주일에 한 번이다. */
export const VISIT_CHANCE = 1 / 7
/** 방문 연출 시간(초): 들어와 걷기, 가구 쓰기, 나가 걷기 */
export const VISIT_WALK = 3
export const VISIT_USE = 10
export const VISIT_TOTAL = VISIT_WALK * 2 + VISIT_USE

/** 방문객이 쓰는 가구 종류. 불빛은 켜고 끄는 것이라 빼고, 우체통은 편지함을 연다. */
const VISIT_USES: readonly HomeUse[] = ['sit', 'tea', 'pet', 'open', 'poke', 'polish', 'scope', 'wave', 'chill']

/** 오늘 놀러 오는 주민. 이사 온 주민이 없거나 방문이 없는 날이면 null. */
export function visitorFor(day: string, residents: readonly string[]): string | null {
  if (residents.length === 0) return null
  const rng = mulberry32(hashString(`visit:${day}`))
  if (rng() >= VISIT_CHANCE) return null
  return residents[Math.floor(rng() * residents.length)]
}

export interface VisitSpot {
  /** 가구 id(방 안에서 고유) */
  id: string
  itemId: string
  x: number
  z: number
  use: HomeUse
}

/** 방문객이 고를 가구 하나. 쓸 수 있는 가구가 없으면 null. */
export function pickSpot(placed: readonly Placed[], rng: Rng): VisitSpot | null {
  const usable = placed.flatMap((p) => {
    const use = homeUse(p.itemId)
    return use && VISIT_USES.includes(use) ? [{ id: p.id, itemId: p.itemId, x: p.x, z: p.z, use }] : []
  })
  if (usable.length === 0) return null
  return usable[Math.floor(rng() * usable.length)]
}

/** 방문객이 가구를 쓸 때 하는 말 한 줄 */
export function visitGreeting(name: string, spot: VisitSpot | null): string {
  if (!spot) return `${josa(name, '이', '가')} 집들이를 하러 왔어요! 구경만 하고 가요`
  const item = ITEMS[spot.itemId]?.name ?? '가구'
  return `${name} 등장! ${homeUseLabel(spot.use, item)}`
}

/** 나갈 때 방을 보고 하는 한마디. 가구 수와 어떤 분위기인지에 따라 달라진다. */
export function interiorComment(name: string, placed: readonly Placed[]): string {
  const n = placed.length
  if (n === 0) return `${name}: 방이 텅 비었네요. 가구를 하나씩 놓아 보세요`
  if (placed.some((p) => GLOWING.has(p.itemId))) return `${name}: 불빛이 따뜻해서 방이 포근해요`
  if (placed.some((p) => p.itemId === 'flowerpot' || p.itemId === 'blossom-arch')) return `${name}: 화분이 있어서 방이 살아 있는 것 같아요`
  if (placed.some((p) => p.itemId === 'telescope' || p.itemId === 'mailbox')) return `${name}: 창가 자리가 마음에 들어요`
  if (n >= 6) return `${name}: 가구가 많아서 아늑하고 풍성해요`
  return `${name}: 소박하고 정돈된 방이네요`
}

/** 이 거리(방 기준 미터) 안에서 E 를 누르면 방문객과 이야기한다 */
export const VISIT_TALK_REACH = 1.6
/** 방문객이 플레이어 몸에서 이만큼 떨어져 걷는다. 안으로 들어오면 옆으로 비켜 간다. */
export const VISIT_AVOID_R = 0.7
/** 문이 열리고 닫히며 몸이 커지고 작아지는 시간(초). 페이드 대신 크기로 나타내고 사라진다. */
export const VISIT_FADE = 0.3

/** 방문객과 나누는 짧은 대화. 같은 순서로 세 가지가 돈다(n 은 대화 횟수). */
export function visitTalk(name: string, n: number): string[] {
  const variants = [
    [`${name}: 집들이에 불러 줘서 고마워요!`, `${name}: 방이 참 좋네요. 가구 배치를 보니 손이 많이 갔겠어요`],
    [`${name}: 이 자리에 앉으니까 편해요.`, `${name}: 다음에는 제가 과자를 가져올게요!`],
    [`${name}: 섬 생활은 어때요?`, `${name}: 저는 이 방이 제일 좋아요. 또 와도 돼요?`],
  ]
  return variants[Math.abs(n) % variants.length]
}

/** 방문 상태. 연출 시각은 runtime 쪽 시작 시각(초)으로 잰다. */
export interface VisitState {
  villagerId: string
  spot: VisitSpot | null
  /** 방문이 시작한 시각(초) */
  start: number
}

/** 시작한 지 t 초일 때의 단계 */
export function visitPhase(t: number, spot: VisitSpot | null): 'walk-in' | 'use' | 'walk-out' | 'done' {
  if (t < VISIT_WALK) return 'walk-in'
  // 쓸 가구가 없으면 쓰는 단계 없이 바로 나간다
  if (spot && t < VISIT_WALK + VISIT_USE) return 'use'
  if (t < (spot ? VISIT_TOTAL : VISIT_WALK * 2)) return 'walk-out'
  return 'done'
}
