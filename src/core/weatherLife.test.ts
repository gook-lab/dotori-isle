import { describe, expect, it } from 'vitest'
import { carriedUmbrella, desaturate, isWet, sheltersNow, shelterFacing, shelterSpot, SHELTER_SLOT_MS, sneezeAt, sneezing, snowmanBuilder, snowmanScale, WET_SECONDS } from './weatherLife'

describe('비 피하기', () => {
  it('맑은 날엔 아무도 피하지 않는다', () => {
    for (let i = 0; i < 20; i++) expect(sheltersNow(`v${i}`, false, i * SHELTER_SLOT_MS)).toBe(false)
  })

  it('비 오는 날엔 일부 주민만 칸마다 피하고, 같은 칸 안에서는 그대로다', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `v${i}`)
    const hidden = ids.filter((id) => sheltersNow(id, true, 5 * SHELTER_SLOT_MS))
    expect(hidden.length).toBeGreaterThan(0)
    expect(hidden.length).toBeLessThan(ids.length)
    expect(sheltersNow(hidden[0], true, 5 * SHELTER_SLOT_MS + 1000)).toBe(true)
  })

  it('처마 밑 자리는 집 가운데에서 처마 끝 바로 바깥쪽이다', () => {
    const s = shelterSpot({ x: 10, z: 0 }, 1.7)
    expect(s.x).toBeCloseTo(11.45)
    expect(s.z).toBeCloseTo(0)
  })

  it('처마 밑 주민은 집을 등지고 바깥을 본다', () => {
    const home = { x: 10, z: 0 }
    // 바깥(+x)을 보는 방향은 Player 와 같은 규칙으로 (sin, cos) = (1, 0)
    expect(Math.sin(shelterFacing(home, shelterSpot(home, 1.7)))).toBeCloseTo(1)
    expect(Math.cos(shelterFacing(home, shelterSpot(home, 1.7)))).toBeCloseTo(0)
  })
})

describe('비 맞아 젖기', () => {
  it('30초 이상 맞으면 젖고, 그 전엔 아니다', () => {
    expect(isWet(WET_SECONDS - 0.1)).toBe(false)
    expect(isWet(WET_SECONDS)).toBe(true)
  })

  it('젖은 색은 채도가 낮아지고 색이 아니면 그대로 둔다', () => {
    expect(desaturate('#ff0000', 0)).toBe('#ff0000')
    const g = desaturate('#ff0000', 0.5)
    const [r, gg] = [1, 3].map((i) => parseInt(g.slice(i, i + 2), 16))
    // 빨강과 초록의 차이가 절반으로 줄어든다(회색 쪽으로)
    expect(r - gg).toBeLessThan(255)
    expect(r - gg).toBeGreaterThan(0)
    expect(desaturate('shirt', 0.5)).toBe('shirt')
  })

  it('재채기 경과 시간은 시작 뒤 0.8초까지만 잰다', () => {
    let start = -1
    for (let t = 0; t < 300; t += 0.01) if (start < 0 && sneezing(t)) start = t
    expect(sneezeAt(start)).toBeCloseTo(0, 1)
    expect(sneezeAt(start + 0.4)).toBeCloseTo(0.4, 1)
    expect(sneezeAt(start + 0.85)).toBe(-1)
    expect(sneezeAt(start - 0.01)).toBe(-1)
  })

  it('재채기는 칸마다 한 번 짧게 나온다', () => {
    let count = 0
    for (let t = 0; t < 300; t += 0.1) if (sneezing(t)) count++
    // 10칸 안에 0.8초씩, 0.1초 간격 샘플이면 칸마다 여덟 개
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(10 * 8)
  })
})

describe('눈사람', () => {
  const land = (x: number, z: number) => Math.hypot(x, z) < 20
  it('눈 오는 날 하루에 한 주민과 땅 위 자리를 고른다', () => {
    const b = snowmanBuilder('2026-12-24', ['a', 'b', 'c'], land)
    expect(b).not.toBeNull()
    expect(['a', 'b', 'c']).toContain(b!.villagerId)
    expect(land(b!.x, b!.z)).toBe(true)
    expect(snowmanBuilder('2026-12-24', ['a', 'b', 'c'], land)).toEqual(b)
  })

  it('주민이 없거나 땅이 없으면 눈사람은 없다', () => {
    expect(snowmanBuilder('d', [], land)).toBeNull()
    expect(snowmanBuilder('d', ['a'], () => false)).toBeNull()
  })

  it('눈사람은 아침보다 저녁에 커진다', () => {
    expect(snowmanScale(0)).toBeLessThan(snowmanScale(1))
    expect(snowmanScale(2)).toBe(1)
  })
})

describe('우산', () => {
  it('주머니에 우산이 있으면 그 첫 번째 색을 든다', () => {
    expect(carriedUmbrella([{ id: 'wood', count: 3 }, { id: 'umbrella-blue', count: 1 }, { id: 'umbrella-red', count: 1 }])).toBe('umbrella-blue')
  })

  it('우산이 없으면 null 이다', () => {
    expect(carriedUmbrella([{ id: 'wood', count: 3 }])).toBeNull()
    expect(carriedUmbrella([])).toBeNull()
  })
})
