/**
 * 주민 옷 바꿔 입기: 플레이어가 옷장의 옷을 주민에게 선물하면, 다음 날부터 그 주민은 그 옷을 입고 나온다.
 * 주민마다 좋아하는 색 계열(tone)과 옷 종류(kind)가 있어서, 맞으면 크게 기뻐하고 한 가지만 맞아도 조금 기뻐한다.
 * 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { giftPoints, type Taste } from './gifts'
import { WEAR_BY_ID } from './wardrobe'
import { josa } from './items'

/** 색 계열: 따뜻한 색, 차가운 색, 연두(싱그러운) 색, 흰·연한 색 */
export type Tone = 'warm' | 'cool' | 'fresh' | 'pale'
/** 옷 종류: 셔츠 계열과 수영복 */
export type WearKind = 'shirt' | 'swim'

/** 주민 입맛: 좋아하는 색 계열과 옷 종류. 없으면 그쪽은 따지지 않는다. */
export interface WearTaste {
  tone?: Tone
  kind?: WearKind
}

/** 옷 색(#rrggbb)을 색 계열로 나눈다. 채도가 낮거나 아주 밝으면 연한 색이다. */
export function toneOf(hex: string): Tone {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  if (s < 0.25 || l > 0.9) return 'pale'
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h < 70 || h >= 330) return 'warm'
  if (h < 170) return 'fresh'
  return 'cool'
}

export const wearKind = (wearId: string): WearKind => (wearId === 'swim-suit' ? 'swim' : 'shirt')

/** 주민 입맛에 옷이 얼마나 맞는지. 색과 종류가 다 맞으면 love, 한쪽만 맞으면 like, 아니면 neutral. */
export function wearTaste(taste: WearTaste | undefined, wearId: string): Taste {
  const w = WEAR_BY_ID[wearId]
  if (!w || !taste) return 'neutral'
  // 주민이 따지는 것(색 계열, 종류)마다 맞는지 본다. 따지는 게 없으면 중립이다.
  const checks = [
    ...(taste.tone !== undefined ? [taste.tone === toneOf(w.color)] : []),
    ...(taste.kind !== undefined ? [taste.kind === wearKind(wearId)] : []),
  ]
  const hits = checks.filter(Boolean).length
  if (checks.length && hits === checks.length) return 'love'
  if (hits > 0) return 'like'
  return 'neutral'
}

/** 선물을 받은 뒤의 반응: 점수와 대사 줄 */
export interface WearReaction {
  points: number
  taste: Taste
  lines: string[]
}

export function wearReaction(v: { name: string; tic: string; wearTaste?: WearTaste }, wearId: string): WearReaction {
  const name = WEAR_BY_ID[wearId]?.name ?? '옷'
  const taste = wearTaste(v.wearTaste, wearId)
  const line = {
    love: `${name} 최고야${v.tic}! 내 취향에 딱 맞아. 내일 이거 입고 나갈게!`,
    like: `${name} 고마워${v.tic}. 내일 한번 입어 볼게.`,
    neutral: `응, ${josa(name, '이구나', '구나')}. 잘 받아 둘게. 내일 입어 볼게.`,
  }[taste === 'dislike' ? 'neutral' : taste]
  return { points: giftPoints(taste, false), taste, lines: [line] }
}

/** 지금 날짜에 주민이 입고 있는 옷. 선물한 날의 다음 날부터 입는다. */
export function wornOutfit(entry: { outfit: string; day: string } | undefined, day: string): string | null {
  return entry && entry.day < day ? entry.outfit : null
}

/** 옷을 입고 나온 주민이 건네는 말 두세 줄. 취향에 따라 다르다. */
export function wornLines(v: { name: string; tic: string }, wearId: string, taste: Taste): string[] {
  const name = WEAR_BY_ID[wearId]?.name ?? '옷'
  if (taste === 'love') return [`오늘은 네가 준 ${name} 입었어${v.tic}! 너무 잘 어울리지?`, '내 색이라 기분이 좋아']
  if (taste === 'like') return [`네가 준 ${name} 입고 왔어${v.tic}`, '입어 보니까 편하고 좋다']
  return [`${name} 입고 나왔어${v.tic}`, '잘 받았다고 생각하면서 입는 중이야']
}
