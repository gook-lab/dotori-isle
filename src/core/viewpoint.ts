/**
 * 절벽 위 전망 벤치. 서쪽 언덕 윗면 북서쪽 가장자리 안쪽에 놓는다.
 * 벤치 등이 바깥(섬 밖 바다 쪽)을 보게 돌려 놓는다. 다른 모듈은 자리 판정에 쓰는 함수만 가져온다.
 */
import { byWater, heightAt, isWalkable } from './island'
import { flatRing, tierHeightAt } from './tiers'

/** 자리: 서쪽 언덕 중심 (-28, 14) 에서 북서쪽으로 8.6 떨어진 곳. 연못·물길·경사로·봉우리와 떨어져 있다. */
const ANGLE = -2.0
export const VIEWPOINT = {
  x: -28 + Math.cos(ANGLE) * 8.6,
  z: 14 + Math.sin(ANGLE) * 8.6,
  /** 벤치 등의 바깥쪽 방향(섬 중심에서 자리로 가는 방향) */
  rot: Math.atan2(Math.cos(ANGLE), Math.sin(ANGLE)),
}

/** 벤치가 놓이는 자리가 걸을 수 있고 평평하며 물이 아닌지 */
export function viewpointOk(): boolean {
  const { x, z } = VIEWPOINT
  return tierHeightAt(x, z) > 0.5 && flatRing(x, z, 0.8) && isWalkable(x, z) && !byWater(x, z, 0.8) && heightAt(x, z) > 0
}
