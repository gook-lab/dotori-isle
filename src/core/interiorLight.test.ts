import { describe, expect, it } from 'vitest'
import { interiorLight, lampLightsOf, LAMP_LIGHT_MAX, nearness, wallShade } from './interiorLight'

describe('실내 밝기 — 시간대와 등불', () => {
  it('낮(11~17시)과 아침에는 햇빛을 그대로 쓴다', () => {
    for (const h of [7, 9.5, 12, 16.9]) {
      expect(interiorLight(h, 0)).toMatchObject({ dim: false, sunScale: 1, hemiScale: 1, bulbScale: 1, stars: false })
    }
  })

  it('저녁(17~20시)과 밤(20~4시 반)은 어둡고 창이 남색이다', () => {
    for (const h of [17.5, 19.9, 21, 2]) {
      expect(interiorLight(h, 0)).toMatchObject({ dim: true, windowColor: '#1f2a57', stars: true })
    }
  })

  it('켜진 등이 있으면 방이 덜 어두워서 등 주변이 상대적으로 밝다', () => {
    const lit = interiorLight(21, 1)
    const dark = interiorLight(21, 0)
    expect(lit.bulbScale).toBeGreaterThan(dark.bulbScale)
    expect(lit.hemiScale).toBeGreaterThan(dark.hemiScale)
    expect(lit.sunScale).toBe(dark.sunScale)
  })

  it('등이 하나도 없으면 방 전체가 은은하게 어둡다', () => {
    expect(interiorLight(21, 0)).toMatchObject({ sunScale: 0.3, hemiScale: 0.5, bulbScale: 0.6 })
  })

  it('실내 등 빛은 한 방에서 최대 4개까지만 만든다', () => {
    expect(LAMP_LIGHT_MAX).toBe(4)
    const many = Array.from({ length: 9 }, (_, i) => i)
    expect(lampLightsOf(many)).toEqual([0, 1, 2, 3])
    expect(lampLightsOf([7])).toEqual([7])
    expect(lampLightsOf([])).toEqual([])
  })
})

describe('벽 밝기 — 낮과 똑같이 밝게 남지 않도록', () => {
  it('낮에는 벽을 곱하지 않는다', () => {
    expect(wallShade(false, false, 0)).toBe(1)
    expect(wallShade(false, true, 1)).toBe(1)
  })

  it('밤에 등이 없으면 벽이 절반으로 가라앉는다', () => {
    expect(wallShade(true, false, 0)).toBe(0.5)
  })

  it('밤에 등이 있으면 벽은 어둡고, 등 가까운 쪽만 조금 밝아진다', () => {
    const far = wallShade(true, true, 0)
    const near = wallShade(true, true, 1)
    expect(far).toBeCloseTo(0.72)
    expect(near).toBeCloseTo(1.02)
    expect(near).toBeGreaterThan(far)
    expect(wallShade(true, true, 3)).toBeCloseTo(near)
  })

  it('등과의 거리는 반경 안에서 줄어든다', () => {
    expect(nearness(0)).toBe(1)
    expect(nearness(2, 4)).toBeCloseTo(0.5)
    expect(nearness(9)).toBe(0)
  })
})
