import { describe, expect, it } from 'vitest'
import { viewpointOk, VIEWPOINT } from './viewpoint'
import { cliffFaceAt, tierHeightAt } from './tiers'
import { PONDS, SPOUT, spoutDist } from './waters'

describe('절벽 위 전망 벤치', () => {
  it('서쪽 언덕 윗면의 평평하고 걸을 수 있는 자리다', () => {
    expect(viewpointOk()).toBe(true)
    expect(tierHeightAt(VIEWPOINT.x, VIEWPOINT.z)).toBeGreaterThan(0.5)
    expect(cliffFaceAt(VIEWPOINT.x, VIEWPOINT.z)).toBe(false)
  })

  it('연못과 물길에서 떨어져 있다', () => {
    for (const p of PONDS) expect(Math.hypot(VIEWPOINT.x - p.x, VIEWPOINT.z - p.z)).toBeGreaterThan(p.r + 1)
    expect(spoutDist(VIEWPOINT.x, VIEWPOINT.z)).toBeGreaterThan(SPOUT.w + 1)
  })
})
