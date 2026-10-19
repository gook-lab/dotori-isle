/**
 * 여름 밤 반딧불이: 여름 저녁 일곱 시부터 열한 시 전까지, 맑거나 흐린 날 풀숲 둘레에 깜빡인다.
 * 자리는 덤불에서 정하고, 깜빡임은 개체마다 위상이 달라 한꺼번에 켜지지 않는다. 순수 함수라 테스트로 고정한다.
 */

import type { Season } from './season'

/** 위치 한 점. 매 프레임 쓰는 자리는 out 인자로 같은 객체를 넘긴다. */
export type Vec3 = { x: number; y: number; z: number }
import type { Weather } from './weather'

export const FIREFLY_COUNT = 16
/** 잡힌 반딧불이가 사라져 있는 초. 지나면 다른 덤불에서 다시 나온다. */
export const FIREFLY_GONE_S = 8

/** 반딧불이가 날아다니는지: 여름, 저녁 19시부터 23시 전, 비·눈이 아닐 때 */
export function fireflyOn(season: Season, hour: number, weather: Weather): boolean {
  return season === 'summer' && hour >= 19 && hour < 23 && weather !== 'rain' && weather !== 'snow'
}

/** 한 마리가 빛나는 세기(0~1). 짧은 빛이 주기적으로 한 번씩 켜졌다 꺼진다. */
export function fireflyGlow(seed: number, t: number): number {
  const s = Math.sin(t * 1.7 + seed * 6.28)
  return Math.max(0, s) ** 8
}

/** 덤불 둘레에서 떠도는 자리. anchor 는 덤불 중심, seed 는 개체마다 다른 값(0~1). out 을 주면 그 객체에 쓴다(매 프레임 할당 방지). */
export function fireflyPos(anchor: { x: number; z: number }, seed: number, t: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const a = seed * Math.PI * 2 + t * 0.25
  const r = 0.8 + Math.sin(t * 0.4 + seed * 9) * 0.5
  out.x = anchor.x + Math.cos(a) * r
  out.y = 0.7 + Math.sin(t * 0.6 + seed * 5) * 0.25 + seed * 0.6
  out.z = anchor.z + Math.sin(a) * r
  return out
}

/** 개체 i 의 씨앗 값(0~1). 같은 i 는 늘 같은 떠돌이 모양이다. */
export const fireflySeed = (i: number) => (i * 0.618) % 1

/** 개체 i 가 지금 머무는 덤불 번호. shift 가 바뀌면(잡힌 뒤) 다른 덤불에서 다시 나온다. */
export function fireflyAnchorIndex(i: number, shift: number, bushCount: number): number {
  return bushCount ? (i * 7 + shift * 3) % bushCount : 0
}

/** 개체 i 의 위치. bushes 는 덤불 목록(x, z). out 을 주면 그 객체에 쓴다. */
export function fireflyPlace(i: number, shift: number, bushes: readonly { x: number; z: number }[], t: number, out?: Vec3): Vec3 {
  const anchor = bushes[fireflyAnchorIndex(i, shift, bushes.length)]
  return fireflyPos(anchor, fireflySeed(i), t, out)
}

/** 잡혀서 잠깐 사라진 개체인지. gone.until 이 지나면 다시 나온다. */
export const fireflyHidden = (gone: { until: number } | undefined, t: number) => gone !== undefined && t < gone.until

/** 잠자리채 반경 안의 가장 가까운 보이는 반딧불이 번호. 없으면 null. */
export function fireflyNearest(
  px: number,
  pz: number,
  bushes: readonly { x: number; z: number }[],
  gone: Readonly<Record<number, { until: number; shift: number }>>,
  t: number,
  reach: number,
): number | null {
  let best: number | null = null
  let bestD = reach * reach
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const g = gone[i]
    if (fireflyHidden(g, t)) continue
    const { x, z } = fireflyPlace(i, g?.shift ?? 0, bushes, t)
    const d = (x - px) ** 2 + (z - pz) ** 2
    if (d < bestD) {
      best = i
      bestD = d
    }
  }
  return best
}

/** 여름 밤에는 기존 밤 벌레 풀의 구슬 반딧불이를 이 장면의 반딧불이로 대체한다(두 개가 겹쳐 보이지 않게) */
export const replacedByFireflies = (species: string, on: boolean) => on && species === 'firefly'
