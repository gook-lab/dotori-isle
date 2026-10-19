import { describe, expect, it } from 'vitest'
import { nearestFreeSpot } from './unstick'

/** 가운데 사각형(상점 몸체)만 막힌 세계. 걸을 수 있는 자리를 돌려준다. */
const free = (x: number, z: number) => Math.abs(x) > 1 || Math.abs(z) > 1

describe('nearestFreeSpot', () => {
  it('leaves a spot that is already free alone', () => {
    expect(nearestFreeSpot(3, 0, free)).toEqual({ x: 3, z: 0 })
  })

  it('moves a player inside the blocked box to a free spot right outside it', () => {
    const p = nearestFreeSpot(0.2, 0.1, free)!
    expect(free(p.x, p.z)).toBe(true)
    // 가장 가까운 바깥 자리: 몸체에서 한 걸음(0.75 안팎) 안쪽
    expect(Math.hypot(p.x - 0.2, p.z - 0.1)).toBeLessThan(1.2)
  })

  it('returns null when nothing free is within reach', () => {
    const all = () => false
    expect(nearestFreeSpot(0, 0, all, 1)).toBeNull()
  })
})
