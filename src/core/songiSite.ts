/**
 * 송이 상인이 서는 자리. 일요일 아침 광장에서 장터 가판대 자리 바로 옆(3~5칸)에 선다.
 * 평평하고 걸을 수 있고 물·물건과 떨어진 첫 칸을 고르며, 장터 자리가 없으면 상인도 없다.
 */
import { byWater, isWalkable } from './island'
import { MARKET_SITE, pickMarketSite } from './market'
import { canWalk } from './scenery'
import { flatWithin } from './tiers'
import { blockedByProps } from './world'

export const SONGI_SITE: { x: number; z: number } | null = MARKET_SITE
  ? pickMarketSite(
      (x, z) => flatWithin(x, z, 1) && isWalkable(x, z) && canWalk(x, z) && !blockedByProps(x, z, 1) && !byWater(x, z, 1.2),
      MARKET_SITE,
      [3, 4, 5],
    )
  : null
