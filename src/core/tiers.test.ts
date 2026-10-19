import { describe, expect, it } from 'vitest'
import { heightAt, isWalkable, sightClearance } from './island'
import { cliffAt, cliffFaceAt, flatWithin, PLATEAUS, plateauRimAt, tierHeightAt, tierSlopeAt } from './tiers'
import { climbSpot, LADDER_MIN_DROP } from './ladder'
import { canStand } from './world'

const west = PLATEAUS[0]
const summit = PLATEAUS[1]
const east = PLATEAUS[2]

/** 언덕 중심에서 방향 a 로 거리 d 만큼 떨어진 점 */
const at = (p: { x: number; z: number }, a: number, d: number) => ({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d })
/** 가장자리 선에서 안쪽(inset>0) 또는 바깥(inset<0)으로 떨어진 점. 가장자리는 울퉁불퉁해서 r 이 아니라 rim 을 기준으로 잡는다. */
const onRim = (p: (typeof PLATEAUS)[number], a: number, inset: number) => at(p, a, plateauRimAt(p, a) - inset)
/** 서쪽 언덕 위 봉우리 밖의 평지 */
const hillTop = { x: -22, z: 15 }

describe('언덕 높이 — 평지와 절벽', () => {
  it('언덕 위 평지는 정해진 높이이고 기울기가 없다', () => {
    expect(tierHeightAt(hillTop.x, hillTop.z)).toBeCloseTo(west.top, 5)
    expect(heightAt(hillTop.x, hillTop.z)).toBeCloseTo(west.top, 5)
    expect(tierSlopeAt(hillTop.x, hillTop.z)).toBeLessThan(0.05)
  })

  it('봉우리는 바깥 언덕보다 높은 두 번째 티어다', () => {
    expect(tierHeightAt(summit.x, summit.z)).toBeCloseTo(summit.top, 5)
    expect(summit.top).toBeGreaterThan(west.top)
  })

  it('언덕 밖 평지에는 언덕 높이가 없다', () => {
    const out = at(west, Math.PI / 2 + 0.3, west.r + 3)
    expect(tierHeightAt(out.x, out.z)).toBe(0)
  })

  it('절벽 띠는 걸을 수 없고 기울기가 크다', () => {
    // 띠 가운데: 가장자리 바깥에서 평지 쪽으로 0.35 들어간 자리 (서쪽 언덕, 경사로 없는 북쪽 방향)
    const band = onRim(west, -Math.PI / 2, 0.35)
    expect(cliffAt(band.x, band.z)).toBe(true)
    expect(isWalkable(band.x, band.z)).toBe(false)
    expect(cliffFaceAt(band.x, band.z)).toBe(true)
  })

  it('평지 위와 바깥 땅은 걸을 수 있다', () => {
    const top = onRim(west, -Math.PI / 2, 3)
    const low = onRim(west, -Math.PI / 2, -3)
    expect(isWalkable(top.x, top.z)).toBe(true)
    expect(isWalkable(low.x, low.z)).toBe(true)
  })
})

describe('경사로 — 걸어 오르내릴 수 있는 완만한 띠', () => {
  it('경사로 가운데는 절벽이 아니고 걸을 수 있다', () => {
    // 서쪽 언덕 첫 경사로: 가장자리 한가운데
    const ramp = onRim(west, west.ramps[0], 0.3)
    expect(cliffAt(ramp.x, ramp.z)).toBe(false)
    expect(isWalkable(ramp.x, ramp.z)).toBe(true)
  })

  it('경사로를 따라 높이가 중간값을 거쳐 올라간다', () => {
    const a = onRim(west, west.ramps[0], -1.2)
    const b = onRim(west, west.ramps[0], 3.6)
    const hA = heightAt(a.x, a.z)
    const hB = heightAt(b.x, b.z)
    expect(hB).toBeGreaterThan(hA + 0.5)
    expect(hB).toBeLessThanOrEqual(west.top + 0.01)
  })

  it('모든 언덕의 경사로 방향에 걸을 수 있는 띠가 있다', () => {
    for (const p of PLATEAUS) {
      for (const a of p.ramps) {
        const ramp = onRim(p, a, 0.3)
        expect(isWalkable(ramp.x, ramp.z)).toBe(true)
      }
    }
  })
})

describe('집 짓기·주민 산책 — 평평한 자리만', () => {
  it('언덕 평지 한가운데는 평평하다', () => {
    expect(flatWithin(hillTop.x, hillTop.z, 2.4)).toBe(true)
  })

  it('절벽 가까이는 평평하지 않다', () => {
    const edge = onRim(west, -Math.PI / 2, 1)
    expect(flatWithin(edge.x, edge.z, 2.4)).toBe(false)
  })
})

describe('시선 — 카메라가 땅 아래로 파고들지 않게', () => {
  it('땅 위에서 땅 위로 가는 시선은 막히지 않는다', () => {
    expect(sightClearance({ x: 0, y: 3, z: 0 }, { x: 0, y: 6, z: 10 })).toBe(1)
  })

  it('절벽 뒤로 낮게 깔린 시선은 막힌 앞 자리에서 멈춘다', () => {
    const from = { x: -28, y: 1.2, z: 1.5 }
    const to = { x: -28, y: 1.2, z: 6.2 }
    expect(sightClearance(from, to)).toBeLessThan(1)
  })
})

describe('사다리 — 절벽 너머로 오르내리기', () => {
  it('절벽 아래에서 바라보면 위로 오르는 자리를 찾는다', () => {
    const spot = climbSpot(-28, 1.5, 0)
    expect(spot).not.toBeNull()
    expect(spot!.up).toBe(true)
    expect(spot!.to.y).toBeCloseTo(west.top, 1)
    expect(canStand(spot!.to.x, spot!.to.z)).toBe(true)
  })

  it('평지 한가운데에서는 사다리 자리가 없다', () => {
    expect(climbSpot(0, 2, 0)).toBeNull()
  })

  it('경사로에서는 사다리 자리가 없다', () => {
    const ramp = onRim(west, west.ramps[0], -2.2)
    expect(climbSpot(ramp.x, ramp.z, west.ramps[0] + Math.PI)).toBeNull()
  })

  it('윗가장자리에서 바라보면 내려가는 자리를 찾는다', () => {
    const top = { x: -28, z: 4.6 }
    const spot = climbSpot(top.x, top.z, Math.PI)
    expect(spot).not.toBeNull()
    expect(spot!.up).toBe(false)
    expect(spot!.from.y - spot!.to.y).toBeGreaterThanOrEqual(LADDER_MIN_DROP)
  })

  it('목적지는 실제로 걸을 수 있는 자리다', () => {
    const spot = climbSpot(-28, 1.5, 0)!
    expect(canStand(spot.to.x, spot.to.z)).toBe(true)
  })
})

describe('봉우리 — 가장 높은 티어', () => {
  it('두 번째 티어는 바깥 언덕 위에서만 오른다', () => {
    expect(summit.top).toBeGreaterThan(west.top + 0.5)
    expect(east.top).toBeLessThan(summit.top)
  })
})

describe('주민 산책 — 절벽 띠 위에 서지 않는다', () => {
  it('모든 주민이 산책 중 절벽 면이나 경사로에 들어가지 않는다', async () => {
    const { VILLAGERS, villagerPosition } = await import('./villagers')
    for (const v of VILLAGERS) {
      for (let t = 0; t < 400; t += 0.7) {
        const p = villagerPosition(v, t)
        expect(cliffFaceAt(p.x, p.z), `${v.id} at t=${t}`).toBe(false)
        expect(tierSlopeAt(p.x, p.z), `${v.id} slope t=${t}`).toBeLessThan(0.05)
        expect(isWalkable(p.x, p.z), `${v.id} walk t=${t}`).toBe(true)
      }
    }
  })
})

describe('카메라 시선 — 벽 따라 걸을 때 값이 끊기지 않는다', () => {
  it('절벽 밑을 따라 옮겨 가도 카메라 막힘 비율이 한 칸씩 뛰지 않는다', () => {
    const top = 4.2
    let prev: number | null = null
    let maxJump = 0
    for (let i = 0; i <= 60; i++) {
      const x = -36 + i * 0.1
      const from = { x, y: 1.2 + 1, z: 1.6 }
      const to = { x, y: 1.2 + 6, z: 9 }
      const c = sightClearance(from, to)
      if (prev !== null) maxJump = Math.max(maxJump, Math.abs(c - prev))
      prev = c
    }
    expect(top).toBeGreaterThan(0)
    expect(maxJump).toBeLessThan(0.2)
  })
})

describe('낙하물·벌레·조개 — 절벽 면에 생기지 않는다', () => {
  it('한 달치 하루 배치가 모두 절벽 면을 피한다', async () => {
    const { generateDay } = await import('./daily')
    for (let d = 1; d <= 30; d++) {
      const key = `2026-10-${String(d).padStart(2, '0')}`
      const { bugs, shells, digs } = generateDay(key)
      for (const b of bugs) expect(cliffFaceAt(b.x, b.z), `bug ${key}`).toBe(false)
      for (const s of shells) expect(cliffFaceAt(s.x, s.z), `shell ${key}`).toBe(false)
      for (const g of digs) expect(cliffFaceAt(g.x, g.z), `dig ${key}`).toBe(false)
    }
  })
})
