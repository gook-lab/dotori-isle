import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { bubbleSpots, catchFor, divePool, DIVE_SECONDS, DIVE_SPECIES, diveResult, inBubbleReach, isSeaSpot, isShore, seaCells, swimOK, swimPushback, SWIM_LIMIT, SWIM_SOFT } from './diving'
import { groundAt } from './island'

describe('수영 범위', () => {
  it('섬 가운데 기준 수영 범위 안은 가능하고 밖은 안 된다', () => {
    expect(swimOK(0, 0)).toBe(true)
    expect(swimOK(SWIM_LIMIT - 1, 0)).toBe(true)
    expect(swimOK(SWIM_LIMIT + 1, 0)).toBe(false)
    // 모래 둘레 안쪽(섬)은 바다가 아니다
    expect(isSeaSpot(0, 0)).toBe(false)
  })

  it('범위 안에서는 되밀지 않는다', () => {
    expect(swimPushback(10, 10, 0.1)).toEqual({ dx: 0, dz: 0, far: false })
    expect(swimPushback(SWIM_SOFT - 0.5, 0, 0.1).dx).toBe(0)
  })

  it('넘어가면 가운데 쪽으로 밀고, 많이 나갈수록 세게 민다', () => {
    const a = swimPushback(SWIM_SOFT + 1, 0, 0.1)
    const b = swimPushback(SWIM_SOFT + 3, 0, 0.1)
    expect(a.dx).toBeLessThan(0)
    expect(a.dz).toBeCloseTo(0, 9)
    expect(Math.abs(b.dx)).toBeGreaterThan(Math.abs(a.dx))
    expect(b.far).toBe(true)
    expect(a.far).toBe(true)
  })

  it('조금 넘은 것은 "너무 멀어요"를 띄우지 않는다', () => {
    expect(swimPushback(SWIM_SOFT + 0.2, 0, 0.1).far).toBe(false)
    // 바깥으로 밀고 있으면 되밀기 힘과 걸음이 맞는 자리(약 0.4 넘침)에서 안내가 뜬다
    expect(swimPushback(SWIM_SOFT + 0.4, 0, 0.1).far).toBe(true)
  })

  it('되밀기는 방향을 바꾸지 않는다(대각선도 가운데 쪽)', () => {
    const r = swimPushback(70, 70, 0.1)
    expect(r.dx).toBeLessThan(0)
    expect(r.dz).toBeLessThan(0)
    expect(Math.abs(r.dx - r.dz)).toBeLessThan(1e-9)
  })
})

describe('바다와 물가', () => {
  it('바다 칸 후보는 모두 물이고 수영 범위 안이다', () => {
    const cells = seaCells()
    expect(cells.length).toBeGreaterThan(40)
    for (const c of cells.slice(0, 50)) {
      expect(groundAt(c.x, c.z)).toBe('water')
      expect(swimOK(c.x, c.z)).toBe(true)
      expect(isSeaSpot(c.x, c.z)).toBe(true)
    }
  })

  it('물가는 뭍 칸이면서 옆에 물이 있는 곳이다', () => {
    const shore = seaCells()
      .map((c) => ({ x: c.x, z: c.z }))
      .find((c) => groundAt(c.x + 1, c.z) === 'water')
    expect(shore).toBeDefined()
    expect(isShore(shore!.x, shore!.z)).toBe(false)
    expect(isShore(0, 0)).toBe(false)
  })
})

describe('거품 자리', () => {
  it('같은 날은 같은 자리이고, 날짜가 바뀌면 다른 자리가 섞인다', () => {
    const cells = seaCells()
    expect(bubbleSpots('2026-10-19', cells)).toEqual(bubbleSpots('2026-10-19', cells))
    const a = bubbleSpots('2026-10-19', cells).map((s) => `${s.x},${s.z}`)
    const b = bubbleSpots('2026-10-20', cells).map((s) => `${s.x},${s.z}`)
    expect(a.length).toBe(8)
    expect(a).not.toEqual(b)
  })

  it('거품은 수영 범위 안 바다에만 뜬다', () => {
    for (const s of bubbleSpots('2026-10-19')) expect(isSeaSpot(s.x, s.z)).toBe(true)
  })

  it('거품에 닿는 거리 안에서만 누를 수 있다', () => {
    expect(inBubbleReach(0, 0, 1, 0)).toBe(true)
    expect(inBubbleReach(0, 0, 3, 0)).toBe(false)
  })
})

describe('해산물 표', () => {
  it('일곱 종이고, 가중치가 모두 양수다', () => {
    expect(DIVE_SPECIES.length).toBe(7)
    for (const s of DIVE_SPECIES) expect(s.weight).toBeGreaterThan(0)
  })

  it('가리비는 봄·겨울에만, 문어는 여름·가을에만 나온다', () => {
    expect(divePool('summer', false).map((s) => s.id)).toContain('octopus')
    expect(divePool('summer', false).map((s) => s.id)).not.toContain('scallop')
    expect(divePool('spring', false).map((s) => s.id)).toContain('scallop')
    expect(divePool('spring', false).map((s) => s.id)).not.toContain('octopus')
  })

  it('성게는 낮에만, 전복과 랍스터는 밤에만 나온다', () => {
    expect(divePool('autumn', false).map((s) => s.id)).toContain('urchin')
    expect(divePool('autumn', true).map((s) => s.id)).not.toContain('urchin')
    expect(divePool('summer', true).map((s) => s.id)).toContain('lobster')
    expect(divePool('summer', false).map((s) => s.id)).not.toContain('lobster')
    expect(divePool('autumn', true).map((s) => s.id)).toContain('abalone')
  })

  it('잡은 것은 항상 그 계절·시간대 표 안에 있다', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 200; i++) {
      const id = catchFor('winter', true, rng)
      expect(divePool('winter', true).map((s) => s.id)).toContain(id)
    }
  })

  it('같은 날 같은 거품은 같은 해산물이 나온다', () => {
    expect(diveResult('2026-10-19', '3,4', 'autumn', false)).toBe(diveResult('2026-10-19', '3,4', 'autumn', false))
  })

  it('잠수 시간은 3초다', () => {
    expect(DIVE_SECONDS).toBe(3)
  })
})
