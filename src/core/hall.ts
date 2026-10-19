/**
 * 마을회관(방송센터) — 광장 근처에 서는 건물. 안에는 접수대·게시판·마이크 책상이 있다.
 * 아침 섬 소식은 여기 마이크에서 나오는 '마을 방송'이고, 마이크 책상에서 다시 들을 수 있다.
 *
 * 건물 자리는 섬에서 한 번 고른다. 광장(시작 자리) 둘레 9~14 거리의 평평한 땅에서,
 * 가판대·전시관·집터에서 떨어진 첫 칸을 쓴다. 자리가 없으면 건물은 서지 않는다.
 */

import { isWalkable, byWater, normDist } from './island'
import { flatWithin } from './tiers'
import { canWalk } from './scenery'
import { blockedByProps, SPAWN } from './world'
import { reservedByHomes } from './villagers'
import { HOME_SITE } from './home'
import { MARKET_SITE, pickMarketSite } from './market'
import { MUSEUM_GAP, MUSEUM_R, MUSEUM_SITE } from './museum'

/** 건물 반지름. 전시관과 같은 크기로 두어 자리 계산을 맞춘다. */
export const HALL_R = 2.4
/** 가판대 반지름(museum.ts 의 MARKET_R 과 같은 값). 자리 간격 계산에 쓴다. */
const MARKET_R = 2
/** 문에 서면 들어갈 수 있는 거리 */
export const HALL_DOOR_R = 1.6

export interface HallSite {
  x: number
  z: number
  /** 정면(문)이 보는 방향. 0 이면 남쪽(+z)을 본다. */
  rot: number
  door: { x: number; z: number }
}

const far = (p: { x: number; z: number } | null | undefined, d: number, x: number, z: number) => !p || Math.hypot(x - p.x, z - p.z) > d

/**
 * 광장 둘레에서 건물 자리를 고른다. 가판대·전시관·집터와 간격을 둔다.
 * 가까운 자리가 없으면 반경을 넓히고, 그래도 없으면 간격 조건을 덜어 낸다. 그래서 섬에서 자리가 빠지지 않는다.
 */
export const pickHallPlot = (): { x: number; z: number } | null => {
  const tight = (x: number, z: number) =>
    flatWithin(x, z, 2.2) &&
    isWalkable(x, z) &&
    canWalk(x, z) &&
    normDist(x, z) < 0.6 &&
    !blockedByProps(x, z, 2.2) &&
    !byWater(x, z, 3) &&
    !reservedByHomes(x, z, HALL_R + MUSEUM_GAP) &&
    far(MARKET_SITE, MARKET_R + MUSEUM_GAP + HALL_R, x, z) &&
    far(MUSEUM_SITE, MUSEUM_R + MUSEUM_GAP + HALL_R, x, z) &&
    far(HOME_SITE, 9, x, z)
  const loose = (x: number, z: number) =>
    flatWithin(x, z, 2) && isWalkable(x, z) && canWalk(x, z) && !blockedByProps(x, z, 2) && !byWater(x, z, 2) && far(HOME_SITE, 6, x, z)
  return (
    pickMarketSite(tight, SPAWN, [9, 10, 11, 12, 13, 14]) ??
    pickMarketSite(tight, SPAWN, [15, 16, 17, 18, 19, 20, 22, 24]) ??
    pickMarketSite(loose, SPAWN, [9, 11, 13, 15, 17, 19, 21, 23, 25, 28])
  )
}

/** 건물 자리에서 문 자리를 정한다. 정면은 남쪽(+z)을 본다. */
export function hallSite(plot: { x: number; z: number }): HallSite {
  const rot = 0
  return { x: plot.x, z: plot.z, rot, door: { x: plot.x, z: plot.z + HALL_R + 0.5 } }
}

/** 섬에서 정한 마을회관 자리. 한 번만 고른다. 자리가 없으면 null(건물이 서지 않는다). */
export const HALL_SITE: HallSite | null = (() => {
  const plot = pickHallPlot()
  return plot ? hallSite(plot) : null
})()
