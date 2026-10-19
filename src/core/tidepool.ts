/**
 * 남쪽 바닷가 물웅덩이: 모래와 바위 사이에 얕은 웅덩이 세 개. 웅덩이마다 게나 불가사리가 하루에 한두 마리 든다.
 * 자리와 생물은 날짜 씨앗으로 뽑아서 새로고침해도 같다. 순수 계산만 한다.
 */
import type { BugSpawn } from './daily'
import { heightAt, radiusAt } from './island'
import { hashString, mulberry32, pickWeighted } from './rng'
import { TIDE_TABLE } from './items'

export interface TidePool {
  x: number
  z: number
  /** 웅덩이 반지름 */
  r: number
}

/** 남쪽 바닷가 가운데 각도(라디안, 화면에서 아래쪽 = +z) */
export const TIDE_CENTER = Math.PI / 2 - 0.5
/** 웅덩이 세 개가 놓이는 각도 간격 */
const POOL_ANGLES = [-0.14, 0.02, 0.16]

/** 물웅덩이 자리: 물가 가까운 모래 띠 안쪽에 놓는다 */
export function tidePools(): TidePool[] {
  return POOL_ANGLES.map((d, i) => {
    const th = TIDE_CENTER + d
    const R = radiusAt(th) * 0.93
    return { x: Math.cos(th) * R, z: Math.sin(th) * R, r: 1.1 + (i % 2) * 0.2 }
  })
}

export const TIDE_POOLS = tidePools()

/** 하루치 물웅덩이 생물. 웅덩이마다 1~2마리이고, 웅덩이 안에서만 움직인다. */
export function tideBugs(key: string, pools: readonly TidePool[] = TIDE_POOLS): BugSpawn[] {
  const rng = mulberry32(hashString(`tide:${key}`))
  const out: BugSpawn[] = []
  pools.forEach((pool, pi) => {
    const n = 1 + Math.floor(rng() * 2)
    for (let k = 0; k < n; k++) {
      const sp = pickWeighted(TIDE_TABLE, rng).id
      out.push({ id: `${key}-tide-${pi}-${k}`, x: pool.x, z: pool.z, day: sp, night: sp, seed: rng() * 100, pool })
    }
  })
  return out
}

/** 웅덩이 안에서의 생물 위치: 시간의 함수이고, 웅덩이 반지름의 절반 안을 맴돈다 */
export function tidePosition(pool: TidePool, seed: number, t: number): [number, number, number] {
  const x = pool.x + Math.sin(t * 0.25 + seed) * pool.r * 0.5
  const z = pool.z + Math.cos(t * 0.2 + seed * 1.3) * pool.r * 0.5
  return [x, heightAt(pool.x, pool.z) + 0.06, z]
}
