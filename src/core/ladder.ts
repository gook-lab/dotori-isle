/**
 * 사다리: 바라보는 쪽에 절벽 띠가 있으면 그 너머 걸을 수 있는 자리까지 오르내린다.
 * 경사로(걸을 수 있는 완만한 땅)는 사다리 대상이 아니다. 절벽 띠를 한 번 지나야 한다.
 */

import { heightAt } from './island'
import { cliffAt } from './tiers'
import { canStand } from './world'

/** 사다리가 닿는 앞쪽 거리. 절벽 밑동이나 윗가장자리에 바짝 서야 한다. */
export const LADDER_REACH = 1.6
/** 절벽을 넘는 최대 거리(띠 포함) */
export const LADDER_RANGE = 3.6
/** 이 높이차 이상이어야 사다리로 본다(걸어서 넘는 턱은 제외) */
export const LADDER_MIN_DROP = 0.6
/** 사다리로 오르내리는 시간(초) */
export const CLIMB_TIME = 1.1

export interface ClimbSpot {
  from: { x: number; y: number; z: number }
  to: { x: number; y: number; z: number }
  /** 위로 올라가면 true */
  up: boolean
}

/**
 * 바라보는 방향(facing: atan2(x, z) 규약, 물건 앞쪽 방향 sin·cos)으로 절벽을 넘는 자리를 찾는다.
 * 절벽 띠가 REACH 안에서 시작하고, 띠를 지난 뒤 처음 걸을 수 있는 자리의 높이가 MIN_DROP 이상 다르면 그 자리가 목적지다.
 */
export function climbSpot(x: number, z: number, facing: number): ClimbSpot | null {
  const sx = Math.sin(facing)
  const sz = Math.cos(facing)
  const y0 = heightAt(x, z)
  let crossed = false
  for (let d = 0.2; d <= LADDER_RANGE; d += 0.1) {
    const px = x + sx * d
    const pz = z + sz * d
    if (cliffAt(px, pz)) {
      // 절벽이 손이 닿는 거리에서 시작해야 한다. 멀리 있는 절벽에는 사다리를 대지 않는다.
      if (!crossed && d > LADDER_REACH) return null
      crossed = true
      continue
    }
    if (!crossed || !canStand(px, pz)) continue
    const y1 = heightAt(px, pz)
    if (Math.abs(y1 - y0) < LADDER_MIN_DROP) return null
    return { from: { x, y: y0, z }, to: { x: px, y: y1, z: pz }, up: y1 > y0 }
  }
  return null
}
