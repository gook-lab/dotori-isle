import { describe, expect, it } from 'vitest'
import { isWalkable } from './island'
import { ROCKS, TREES } from './world'
import { SCENERY } from './scenery'
import { cliffAt, inStepBlockAt, PLATEAUS, plateauRimAt, RAMP_HALF_ANGLE, RAMP_STEPS, RAMP_W, STEP_PAD, stepProfile, tierHeightAt } from './tiers'

const west = PLATEAUS[0]
const at = (p: { x: number; z: number }, a: number, d: number) => ({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d })
/** 경사로 가운데 방향에서 절벽 바깥 가장자리(rim)로부터 d 만큼 떨어진 점(양수면 바깥) */
const rampPoint = (a: number, out: number) => at(west, a, plateauRimAt(west, a) + out)

describe('계단 높이 — 칸은 평평하고 턱에서만 올라간다', () => {
  it('바깥 가장자리는 아래층(0.2)에서 시작하고, 맨 위 칸 윗면은 정확히 1(언덕 윗면)이다', () => {
    expect(stepProfile(0)).toBeCloseTo(1 / RAMP_STEPS, 6)
    expect(stepProfile(1)).toBeCloseTo(1, 6)
  })

  it('칸 윗면 가운데는 평평하다(j+1)/N', () => {
    for (let j = 0; j < RAMP_STEPS; j++) {
      expect(stepProfile((j + 0.5) / RAMP_STEPS)).toBeCloseTo((j + 1) / RAMP_STEPS, 6)
    }
  })

  it('단조 증가한다', () => {
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const v = stepProfile(i / 400)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })
})

describe('경사로 계단 — 걸을 수 있고 칸 높이를 따른다', () => {
  const a = west.ramps[0]

  it('칸 가운데 높이는 칸 윗면 높이와 같다', () => {
    for (let j = 0; j < RAMP_STEPS; j++) {
      const out = ((1 - (j + 0.5) / RAMP_STEPS) * RAMP_W)
      const p = rampPoint(a, out)
      expect(tierHeightAt(p.x, p.z)).toBeCloseTo((west.top * (j + 1)) / RAMP_STEPS, 2)
    }
  })

  it('아래층 땅에서 절벽 윗선까지 높이가 끊기지 않고 올라간다', () => {
    let prev = -1
    for (let i = 0; i <= 60; i++) {
      const p = rampPoint(a, RAMP_W - (i / 60) * (RAMP_W + 0.3))
      const h = tierHeightAt(p.x, p.z)
      expect(h).toBeGreaterThanOrEqual(prev - 1e-6)
      prev = h
    }
    expect(prev).toBeCloseTo(west.top, 1)
  })

  it('계단 칸 위는 절벽으로 치지 않고 걸을 수 있다', () => {
    for (let i = 0; i < 40; i++) {
      const p = rampPoint(a, 0.1 + (i / 40) * (RAMP_W - 0.3))
      expect(cliffAt(p.x, p.z)).toBe(false)
      expect(isWalkable(p.x, p.z)).toBe(true)
    }
  })

  it('계단 위에서 절벽 윗면 평지로 걸어 올라갈 수 있다', () => {
    const p = rampPoint(a, -0.5)
    expect(isWalkable(p.x, p.z)).toBe(true)
  })

  it('계단 띠 바깥 절벽은 못 지나간다(계단 옆 절벽 벽)', () => {
    for (const a of west.ramps) {
      const sa = a + RAMP_HALF_ANGLE + 0.2
      const side = at(west, sa, plateauRimAt(west, sa) - 0.35)
      expect(cliffAt(side.x, side.z)).toBe(true)
      expect(isWalkable(side.x, side.z)).toBe(false)
    }
  })

  it('계단 블록 자리와 여유 0.5 안에는 나무·바위·통나무가 남지 않는다', () => {
    for (const t of [...TREES, ...ROCKS, ...SCENERY]) expect(inStepBlockAt(t.x, t.z, STEP_PAD), `${t.x},${t.z}`).toBe(false)
  })
})
