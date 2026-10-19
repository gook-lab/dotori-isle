import { describe, expect, it } from 'vitest'
import { inStepBlockAt, PLATEAUS, plateauRimAt, RAMP_W, stepBlockHeight, stepFrameOf, stepHalfWidth, stepProfile, stepSectorAt } from './tiers'

// 블록 좌표(rho: 림 기준 경사로 방향, lam: 옆 방향)를 월드 좌표로 바꾼다
const at = (pi: number, a: number, rho: number, lam: number) => {
  const p = PLATEAUS[pi]
  const rimA = plateauRimAt(p, a)
  const r = rimA + rho
  return { x: p.x + Math.cos(a) * r - Math.sin(a) * lam, z: p.z + Math.sin(a) * r + Math.cos(a) * lam, rimA }
}

const summit = 1
const a = Math.PI / 2

/** 블록 좌표 한 점의 블록 높이(순수 함수). 옆 반폭 밖이면 null. */
const blockH = (pi: number, rho: number, lam = 0) => {
  const p = PLATEAUS[pi]
  const q = at(pi, a, rho, lam)
  const f = stepFrameOf(p, q.x, q.z, a)
  return f ? stepBlockHeight(p, f) : null
}

describe('계단 블록 좌표: 블록 안 높이', () => {
  it('uses the step tread heights inside the block and the flat top just inside the rim', () => {
    const top = PLATEAUS[summit].top
    expect(blockH(summit, RAMP_W / 2)).toBeCloseTo(top * stepProfile(0.5), 6)
    expect(blockH(summit, -0.5)).toBeCloseTo(top, 6)
  })

  it('ends at the lower tread on the outer edge of the block', () => {
    const top = PLATEAUS[summit].top
    expect(blockH(summit, RAMP_W)).toBeCloseTo(top * stepProfile(0), 6)
    expect(blockH(summit, RAMP_W + 0.1)).toBeNull()
  })
})

describe('계단 블록 좌표: 블록 옆과 안팎', () => {
  it('counts a point as on the step only inside the side half width', () => {
    const rimA = plateauRimAt(PLATEAUS[summit], a)
    const half = stepHalfWidth(rimA)
    const inside = at(summit, a, 1, half - 0.05)
    const beside = at(summit, a, 1, half + 0.2)
    expect(inStepBlockAt(inside.x, inside.z)).toBe(true)
    expect(inStepBlockAt(beside.x, beside.z)).toBe(false)
  })

  it('stops the block height at the side edge so the cliff continues beside the block', () => {
    const rimA = plateauRimAt(PLATEAUS[summit], a)
    const f = stepFrameOf(PLATEAUS[summit], at(summit, a, 1, 0).x, at(summit, a, 1, 0).z, a)
    expect(f).not.toBeNull()
    if (!f) return
    expect(stepBlockHeight(PLATEAUS[summit], { ...f, lam: stepHalfWidth(rimA) + 0.2 })).toBeNull()
    expect(stepBlockHeight(PLATEAUS[summit], { ...f, lam: 0 })).not.toBeNull()
  })

  it('keeps the wall gap only over the step sector', () => {
    const rimA = plateauRimAt(PLATEAUS[summit], a)
    expect(stepSectorAt(PLATEAUS[summit], a)).toBe(true)
    expect(stepSectorAt(PLATEAUS[summit], a + 0.5)).toBe(false)
    // 블록 옆 반폭 밖 림 자리는 벽이 이어진다
    const edgeAngle = a + (stepHalfWidth(rimA) + 0.3) / rimA
    expect(stepSectorAt(PLATEAUS[summit], edgeAngle)).toBe(false)
  })
})

describe('계단 블록 좌표: 높이 이어짐', () => {
  it('changes by a small amount per 0.05 step along the centre line of the block', () => {
    let prev: number | null = null
    let maxJump = 0
    for (let rho = -1; rho <= RAMP_W; rho += 0.05) {
      const h = blockH(summit, rho)
      if (h === null) continue
      if (prev !== null) maxJump = Math.max(maxJump, Math.abs(h - prev))
      prev = h
    }
    // 칸 턱은 한 칸 폭(약 0.3) 안에서 부드럽게 올라가므로 0.05 간격 차이가 절벽처럼 튀지 않는다
    expect(maxJump).toBeLessThan(0.25)
  })
})
