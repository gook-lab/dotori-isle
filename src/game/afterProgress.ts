import { frameFloor, frameHung, scoreHome, starsOf } from '../core/homeScore'
import { decodeGarden, gardenStats } from '../core/gardenTiles'
import { HOME_SITE } from '../core/home'
import type { AfterStoryInput } from '../core/afterStory'

/** 저장 상태 가운데 섬 이야기 이후 목표 진행을 읽는 칸 */
export interface AfterProgressSource {
  storyChapter?: number
  shop: { tier: number }
  dex: Record<string, number>
  rating: { stars: number }
  home: { stage: Parameters<typeof scoreHome>[0]['stage'] }
  homeFurniture: Parameters<typeof scoreHome>[0]['furniture']
  wallPhoto?: unknown
  placed: Parameters<typeof gardenStats>[0]
  gardenTiles?: Parameters<typeof decodeGarden>[0]
}

/**
 * 섬 이야기 이후 목표의 진행: 집 별, 상점 단계, 도감 종 수, 섬 별점.
 * HUD 목표 줄, 휴대폰 미션, 목표 축하가 모두 이 값을 쓴다. 상태에서 매번 새로 계산한다.
 */
export function afterProgressOf(s: AfterProgressSource): AfterStoryInput {
  const homeFurniture = s.homeFurniture
  const homeTotal = scoreHome({
    stage: s.home.stage,
    furniture: homeFurniture,
    framed: frameHung(!!s.wallPhoto, homeFurniture),
    framedFloor: frameFloor(!!s.wallPhoto, homeFurniture),
    garden: gardenStats(s.placed, decodeGarden(s.gardenTiles), HOME_SITE),
  }).total
  return {
    storyChapter: s.storyChapter ?? 0,
    homeStars: starsOf(homeTotal),
    shopTier: s.shop.tier,
    dexFound: Object.values(s.dex).filter((n) => n > 0).length,
    islandStars: s.rating.stars,
  }
}
