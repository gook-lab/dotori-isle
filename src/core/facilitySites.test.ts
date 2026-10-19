import { describe, expect, it } from 'vitest'
import { HALL_SITE } from './hall'
import { HOME_SITE } from './home'
import { MARKET_SITE } from './market'
import { MUSEUM_SITE } from './museum'
import { SONGI_SITE } from './songiSite'
import { inStepBlockAt, STEP_PAD } from './tiers'
import { VIEWPOINT } from './viewpoint'

/** 계단 여유 밖에 있어야 하는 기존 시설 자리: 집·마을회관·시장·박물관·도토리 상점·전망 벤치 */
describe('기존 시설 자리는 계단 블록 밖이다', () => {
  it('집·마을회관·시장·박물관·도토리 상점·전망 벤치', () => {
    const sites: [string, { x: number; z: number } | null][] = [
      ['home', HOME_SITE],
      ['hall', HALL_SITE],
      ['market', MARKET_SITE],
      ['museum', MUSEUM_SITE],
      ['songi', SONGI_SITE],
      ['viewpoint', VIEWPOINT],
    ]
    for (const [name, s] of sites) {
      if (!s) continue
      expect(inStepBlockAt(s.x, s.z, STEP_PAD), name).toBe(false)
    }
  })
})
