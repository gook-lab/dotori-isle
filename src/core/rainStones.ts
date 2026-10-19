import { hashString, mulberry32 } from './rng'

/**
 * 비 오는 날의 반짝이는 조약돌. 비가 씻어 준 해변 돌 가운데 빛나는 것을 줍는다.
 * 줍는 길은 조개와 같다(daily.ts 의 layout.shells, collected). 저장 필드는 따로 두지 않는다.
 * 벌레(달팽이)·물고기 표는 건드리지 않는다. 순수 함수라 React·Three 에 의존하지 않는다.
 */

export const RAIN_STONE_ID = 'rain-pebble'
/** 하루에 깔리는 조약돌 수의 상한 */
export const RAIN_STONE_MAX = 3
const RAIN_STONE_MIN = 2
const TRIES = 80

/** 비 오는 날의 조약돌 수(2~3). 맑거나 흐리거나 눈 오는 날은 0이다. */
export function rainStoneCount(key: string, rain: boolean): number {
  if (!rain) return 0
  const rng = mulberry32(hashString(`rain-stone:${key}`))
  return RAIN_STONE_MIN + (rng() < 0.5 ? 0 : 1)
}

/**
 * 조약돌 자리를 뽑는다. spot 은 (각도, 거리 비율)을 받아 놓을 수 있는 자리면 좌표를, 안 되면 null 을 돌려준다.
 * 시드를 따로 써서 섬의 다른 난수 순서를 바꾸지 않는다. 자리를 다 못 찾으면 있는 만큼만 돌려준다.
 */
export function rainStoneSpawns(
  key: string,
  rain: boolean,
  spot: (theta: number, d: number) => { x: number; z: number } | null,
): { id: string; itemId: string; x: number; z: number }[] {
  const want = rainStoneCount(key, rain)
  const rng = mulberry32(hashString(`rain-stone-spot:${key}`))
  const out: { id: string; itemId: string; x: number; z: number }[] = []
  for (let attempt = 0; attempt < TRIES && out.length < want; attempt++) {
    const theta = rng() * Math.PI * 2
    const d = 0.87 + rng() * 0.08
    const p = spot(theta, d)
    if (!p) continue
    out.push({ id: `${key}-rain-${out.length}`, itemId: RAIN_STONE_ID, x: p.x, z: p.z })
  }
  return out
}
