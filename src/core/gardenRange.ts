/**
 * 정원 놓기 범위 한눈에 보기: 집에서 세 칸 떨어진 자리부터 여섯 칸 안에서 울타리와 바닥 타일을 놓을 수 있다.
 * 칸 판정은 gardenRingBlocker 를 그대로 쓰고, 칸마다 놓기 판정(ok)을 한 번 더 건다. 순수 로직이다.
 */

import { FENCE_FAR, gardenRingBlocker } from './fence'
import type { HomeSite } from './home'

/** 글 안내 한 줄(패널과 놓기 상태에서 같이 쓴다) */
export const GARDEN_RANGE_TEXT = '집에서 세 칸 떨어진 곳부터 여섯 칸 안에 놓아요'

/** 놓을 수 있는 정원 칸 목록. ok 는 물건별 놓기 판정이다(놓을 수 있으면 true). 집이 없으면 빈 목록이다. */
export function gardenRangeCells(site: Pick<HomeSite, 'x' | 'z' | 'door'> | null, ok: (x: number, z: number) => boolean): { x: number; z: number }[] {
  if (!site) return []
  const cx = Math.round(site.x)
  const cz = Math.round(site.z)
  const out: { x: number; z: number }[] = []
  for (let dx = -FENCE_FAR - 1; dx <= FENCE_FAR + 1; dx++) {
    for (let dz = -FENCE_FAR - 1; dz <= FENCE_FAR + 1; dz++) {
      const x = cx + dx
      const z = cz + dz
      if (gardenRingBlocker(x, z, site) === null && ok(x, z)) out.push({ x, z })
    }
  }
  return out
}
