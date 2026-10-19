/**
 * 섬 곳곳의 작은 발견거리. 플레이어가 걸어다니다 우연히 찾는 상호작용 여섯 곳이다.
 * 위치는 고정이고, 결과는 굴림값(0~1)을 받는 순수 함수로 정한다. 하루에 한 번만 되며 저장하지 않는다(runtime).
 */

import { hashString } from './rng'

export type DiscoveryId = 'pebble' | 'echo' | 'well' | 'rock' | 'stump' | 'hollow'

export interface DiscoverySpot {
  id: DiscoveryId
  x: number
  z: number
  /** E 안내에 쓰는 동작 이름 */
  label: string
}

/** 모래밭 물가 · 언덕 꼭대기 · 광장 우물 · 바위 · 그루터기 · 나무 구멍 */
export const DISCOVERIES: DiscoverySpot[] = [
  { id: 'pebble', x: 54.6, z: 31.5, label: '조약돌 던지기' },
  { id: 'echo', x: -31, z: 14, label: '언덕에서 외치기' },
  { id: 'well', x: 10, z: 22, label: '우물에 동전 던지기' },
  { id: 'rock', x: 12.1, z: -7, label: '바위 밑 들춰 보기' },
  { id: 'stump', x: 7, z: 12.1, label: '나이테 세어 보기' },
  { id: 'hollow', x: -12.1, z: -7, label: '나무 구멍 들여다보기' },
]

/** E 를 누를 수 있는 거리(반지름) */
export const DISCOVERY_REACH = 1.8
/** 우물에 던지는 동전(도토리) 값 */
export const WISH_COST = 1
/** 우물 소원이 이루어질 확률과 그때 받는 도토리 */
export const WISH_GIFT_CHANCE = 0.01
export const WISH_GIFT_ACORNS = 50
/** 메아리가 돌아오는 횟수 */
export const ECHO_CALLS = 3

/** 가장 가까운 발견거리 안의 자리. 없으면 null. */
export function discoveryNear(x: number, z: number, reach = DISCOVERY_REACH): DiscoverySpot | null {
  let best: DiscoverySpot | null = null
  let bestD = reach * reach
  for (const s of DISCOVERIES) {
    const d = (s.x - x) ** 2 + (s.z - z) ** 2
    if (d < bestD) {
      best = s
      bestD = d
    }
  }
  return best
}

/** 하루에 한 번만 된다. 마지막으로 한 날이 오늘이 아니면 가능하다. */
export const canDiscover = (lastDay: string | undefined, day: string) => lastDay !== day

/** 나이테로 본 나무 나이(20~60살, 5살 간격). 같은 자리는 늘 같은 나이다. */
export function treeAge(id: string): number {
  return 20 + (hashString(`ring:${id}`) % 9) * 5
}

/** 물수제비 튀는 횟수: 1~6번 */
export const pebbleBounces = (roll: number) => 1 + Math.min(5, Math.floor(roll * 6))

/** 바위 밑에서 나오는 작은 친구. 절반쯤 뭔가 나온다. */
export function critterAt(roll: number): 'crab' | 'pillbug' | null {
  if (roll < 0.25) return 'crab'
  if (roll < 0.5) return 'pillbug'
  return null
}

/** 우물 소원이 이루어졌는지 */
export const wishGift = (roll: number) => roll < WISH_GIFT_CHANCE

export interface Outcome {
  /** 화면에 띄울 한두 줄 */
  text: string
  /** 소리: 효과음 이름 */
  sound: 'splash' | 'pop' | 'coin' | 'pick' | 'chop'
  /** 물수제비가 튀는 횟수(물결을 그리는 데 쓴다) */
  bounces?: number
  /** 메아리 횟수 */
  echoes?: number
  /** 동전(도토리) 값을 먼저 치러야 하는 양 */
  cost?: number
  /** 도토리를 받는 양 */
  acorns?: number
}

/** 발견거리 하나를 쓴 결과. roll 은 0~1 의 무작위 값이다. */
export function outcomeOf(id: DiscoveryId, roll: number): Outcome {
  switch (id) {
    case 'pebble': {
      const bounces = pebbleBounces(roll)
      return { text: `돌이 ${bounces}번 통통 튀었어요`, sound: 'splash', bounces }
    }
    case 'echo':
      return { text: `야호! 메아리가 ${ECHO_CALLS}번 돌아왔어요`, sound: 'pop', echoes: ECHO_CALLS }
    case 'well':
      if (wishGift(roll)) return { text: `소원이 이루어졌어요! 도토리 ${WISH_GIFT_ACORNS.toLocaleString()}개가 떠올랐어요`, sound: 'coin', cost: WISH_COST, acorns: WISH_GIFT_ACORNS }
      return { text: '동전이 풍덩, 소원을 빌었어요', sound: 'coin', cost: WISH_COST }
    case 'rock': {
      const c = critterAt(roll)
      if (c === 'crab') return { text: '바위 밑에서 게가 쏙 나왔어요', sound: 'pick' }
      if (c === 'pillbug') return { text: '공벌레가 동그랗게 말렸어요', sound: 'pick' }
      return { text: '바위 밑은 축축하기만 해요', sound: 'pick' }
    }
    case 'stump':
      return { text: `나이테를 세어 보니 이 나무는 ${treeAge(id)}살쯤이에요`, sound: 'chop' }
    case 'hollow':
      return { text: '다람쥐 둥지에서 도토리 하나를 찾았어요', sound: 'pick', acorns: 1 }
  }
}
