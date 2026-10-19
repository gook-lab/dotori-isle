import { describe, expect, it } from 'vitest'
import { LAMP_MAX, LAMP_OFFSET, LAMP_PER_SEG, streetLampSpots } from './streetLamps'

const route = [
  { x: 6, z: 2 },
  { x: 0, z: -9 },
  { x: -8, z: -1 },
]

describe('밤 가로등 자리', () => {
  it('구간마다 등분 자리에 세우고, 두 구간이면 최대 여섯 개다', () => {
    const spots = streetLampSpots(route, () => true)
    expect(spots).toHaveLength(LAMP_PER_SEG * 2)
    expect(spots.length).toBeLessThanOrEqual(LAMP_MAX)
  })

  it('길 중심선에서 옆으로 정해진 거리만큼 떨어진다', () => {
    const [a, b] = route
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const spots = streetLampSpots([a, b], () => true)
    for (const p of spots) {
      // 점에서 선분까지의 수직 거리
      const dist = Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / len
      expect(dist).toBeCloseTo(LAMP_OFFSET, 6)
    }
  })

  it('첫 쪽이 막히면 반대쪽을 쓰고, 둘 다 막히면 그 자리는 건너뛴다', () => {
    const [a, b] = route
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    // 첫 번째 등분 자리에서 길 왼쪽(+1) 후보
    const t = 1 / (LAMP_PER_SEG + 1)
    const first = { x: a.x + dx * t + (-dz / len) * LAMP_OFFSET, z: a.z + dz * t + (dx / len) * LAMP_OFFSET }
    const spots = streetLampSpots([a, b], (x, z) => Math.hypot(x - first.x, z - first.z) > 1e-9)
    expect(Math.hypot(spots[0].x - first.x, spots[0].z - first.z)).toBeCloseTo(LAMP_OFFSET * 2, 6)
    expect(streetLampSpots([a, b], () => false)).toEqual([])
  })

  it('같은 입력이면 같은 자리를 준다', () => {
    expect(streetLampSpots(route, () => true)).toEqual(streetLampSpots(route, () => true))
  })
})
