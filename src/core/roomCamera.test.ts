import { describe, expect, it } from 'vitest'
import { roomCamPull } from './interior'

const BASE = Math.hypot(6.6, 10.5)

describe('roomCamPull', () => {
  it('keeps the normal distance on a wide screen', () => {
    expect(roomCamPull(1280, 800, 40, 5, BASE)).toBe(1)
  })

  it('pulls the camera back more on a narrow phone, and more for a wider room', () => {
    const small = roomCamPull(390, 844, 40, 3, BASE)
    const big = roomCamPull(390, 844, 40, 5, BASE)
    expect(small).toBeGreaterThan(1)
    expect(big).toBeGreaterThan(small)
    expect(big).toBeGreaterThan(2)
    expect(big).toBeLessThan(4)
  })

  it('fits the widest room in the view: its half width is covered at the pulled distance', () => {
    const pull = roomCamPull(390, 844, 40, 5, BASE)
    const dist = BASE * pull
    const tanH = Math.tan((40 * Math.PI) / 360) * (390 / 844)
    expect(dist * tanH).toBeGreaterThanOrEqual(5)
  })
})
