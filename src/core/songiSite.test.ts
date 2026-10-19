import { describe, expect, it } from 'vitest'
import { MARKET_SITE } from './market'
import { SONGI_SITE } from './songiSite'

describe('송이 상인 자리', () => {
  it('장터 가판대 옆 3~5칸에 선다', () => {
    if (!MARKET_SITE) return expect(SONGI_SITE).toBeNull()
    expect(SONGI_SITE).not.toBeNull()
    const d = Math.hypot(SONGI_SITE!.x - MARKET_SITE.x, SONGI_SITE!.z - MARKET_SITE.z)
    expect(d).toBeGreaterThanOrEqual(2.9)
    expect(d).toBeLessThanOrEqual(5.1)
  })
})
