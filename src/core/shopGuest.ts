/**
 * 도토리 상점 손님. 낮(10~18시) 사이 주민 가운데 하루에 0~2명이 상점 안에서 진열대를 구경한다.
 * 그 시간 동안 섬 바깥의 그 주민은 숨는다. 누가 언제 오는지와 손님의 걸음·말은 여기서 정하고, 그리기는 scene 이 맡는다.
 * 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { withTic } from './chat'
import { isBirthday } from './birthdays'
import { hashString } from './rng'
import type { Species, VillagerDef } from './villagers'

/** 손님이 오는 시간대(시작 포함, 끝 제외) */
export const GUEST_FROM = 10
export const GUEST_TO = 18
/** 하루 손님 수의 상한 */
export const GUEST_MAX = 2
/** 손님이 말을 걸었을 때 말풍선이 떠 있는 시간(ms) */
export const GUEST_SAY_MS = 2000

/**
 * 오늘 상점에 와 있는 주민 id. 시간대 밖이거나 후보가 없으면 빈 배열이다.
 * 같은 날·같은 후보면 늘 같다. 하루 손님 수는 0~2명 가운데 날짜 시드로 정한다.
 * 생일인 주민은 그날 후보에서 뺀다. 생일 주인공이 광장에서 찾기 어려우면 안 된다.
 */
export function shopGuestIds(day: string, hour: number, ids: readonly string[]): string[] {
  if (hour < GUEST_FROM || hour >= GUEST_TO) return []
  const pool = ids.filter((id) => !isBirthday(id, day))
  if (pool.length === 0) return []
  const count = hashString(`shopguest:${day}`) % (GUEST_MAX + 1)
  const order = [...pool].sort((a, b) => hashString(`${day}:${a}`) - hashString(`${day}:${b}`))
  return order.slice(0, Math.min(count, order.length))
}

/** 손님의 자리(방 가운데 기준). 진열대 앞 바닥 가운데 띠를 천천히 오간다. 계산대와 전시 자리는 피한다. */
export function shopGuestSpot(index: number, t: number): { x: number; z: number; facing: number; bowing: boolean } {
  const phase = index * 2.3
  const x = 2.2 * Math.sin(t * 0.18 + phase)
  const z = 1.4 + 0.6 * Math.sin(t * 0.25 + phase * 1.7)
  const dx = 2.2 * 0.18 * Math.cos(t * 0.18 + phase)
  const dz = 0.6 * 0.25 * Math.cos(t * 0.25 + phase * 1.7)
  // 가끔 멈춰 고개를 숙여 진열을 본다
  const bowing = Math.sin(t * 0.9 + phase * 3) > 0.85
  return { x, z, facing: Math.atan2(dx, dz), bowing }
}

/** 종류(성격)별 쇼핑 대사 두 줄. 같은 종류의 주민은 같은 말투를 쓰고, 말끝 버릇(tic)은 주민마다 붙인다. */
const SHOP_LINES: Record<Species, readonly [string, string]> = {
  cat: ['이 가구 색이 참 예쁘네요. 살까 말까 고민 중이에요.', '오늘은 뭘 살지 정하지 못했어요. 조금만 더 볼게요.'],
  rabbit: ['앗, 이거 귀엽다! 그런데 주머니에 자리가 있을까요?', '뭘 살지 깡충깡충 고민하는 중이에요.'],
  penguin: ['여기 물건은 다 좋아 보여요. 어떤 게 제일 좋을까요?', '차근차근 골라 볼게요. 서두를 필요는 없죠.'],
  mole: ['작은 물건도 많네요. 한 번 더 보고 결정할게요.', '음, 아직 고르는 중이에요. 천천히요.'],
  hedgehog: ['이것저것 만져 보는 중이에요. 뭘 살지 정해야 할 텐데요.', '가격표를 다시 보고 있어요. 고민이 많아요.'],
  bear: ['든든한 게 있으면 좋겠는데요. 뭘 살지 고민이에요.', '이 자리가 편해서 오래 보고 있어요.'],
  squirrel: ['도토리는 얼마나 있었더라. 살 게 많아서 고민이에요!', '이것도 저것도 갖고 싶어요. 어떡하죠?'],
  chestnut: ['진열이 바뀌었네요. 새로 나온 건 뭘까요?', '오늘은 천천히 골라서 가 볼게요.'],
  otter: ['물에 어울리는 것도 있을까요? 조금 더 둘러볼게요.', '마음에 드는 게 있는데 가격이 고민이에요.'],
}

/** 손님이 말을 걸면 하는 쇼핑 대사 한 줄. 같은 날이면 같은 줄을 고른다. */
export function shopGuestLine(v: Pick<VillagerDef, 'id' | 'species' | 'tic'>, day: string): string {
  const pair = SHOP_LINES[v.species]
  const line = pair[hashString(`${day}:${v.id}`) % pair.length]
  return withTic(line, v.tic)
}
