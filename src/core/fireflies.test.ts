import { describe, expect, it } from 'vitest'
import { fireflyGlow, fireflyOn, fireflyPos } from './fireflies'

describe('여름 반딧불이', () => {
  it('여름 저녁 19시부터 23시 전, 맑거나 흐린 날에만 난다', () => {
    expect(fireflyOn('summer', 18.9, 'sunny')).toBe(false)
    expect(fireflyOn('summer', 19, 'sunny')).toBe(true)
    expect(fireflyOn('summer', 22.9, 'cloudy')).toBe(true)
    expect(fireflyOn('summer', 23, 'sunny')).toBe(false)
    expect(fireflyOn('summer', 21, 'rain')).toBe(false)
    expect(fireflyOn('summer', 21, 'snow')).toBe(false)
  })

  it('다른 계절에는 나지 않는다', () => {
    expect(fireflyOn('spring', 21, 'sunny')).toBe(false)
    expect(fireflyOn('autumn', 21, 'sunny')).toBe(false)
    expect(fireflyOn('winter', 21, 'sunny')).toBe(false)
  })

  it('빛은 0 과 1 사이이고, 개체마다 켜지는 때가 다르다', () => {
    const glows = Array.from({ length: 20 }, (_, i) => fireflyGlow(i / 20, 3.3))
    for (const g of glows) {
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(1)
    }
    expect(new Set(glows.map((g) => g.toFixed(3))).size).toBeGreaterThan(5)
  })

  it('덤불 둘레에 머문다(반지름 1.3 이내, 땅 위 공중)', () => {
    const anchor = { x: 4, z: -2 }
    for (let t = 0; t < 30; t += 1.7) {
      const { x, y, z } = fireflyPos(anchor, 0.37, t)
      expect(Math.hypot(x - anchor.x, z - anchor.z)).toBeLessThanOrEqual(1.3)
      expect(y).toBeGreaterThan(0.5)
      expect(y).toBeLessThan(2)
    }
  })
})

import { fireflyAnchorIndex, fireflyHidden, fireflyNearest, fireflyPlace, replacedByFireflies } from './fireflies'

describe('반딧불이 잡기', () => {
  const bushes = Array.from({ length: 12 }, (_, k) => ({ x: (k % 4) * 9, z: Math.floor(k / 4) * 9 }))

  it('잡힌 개체는 잠깐 사라졌다가, 다른 덤불에서 다시 나온다', () => {
    expect(fireflyHidden({ until: 30 }, 10)).toBe(true)
    expect(fireflyHidden({ until: 30 }, 31)).toBe(false)
    expect(fireflyAnchorIndex(2, 0, 12)).not.toBe(fireflyAnchorIndex(2, 1, 12))
    const before = fireflyPlace(2, 0, bushes, 5)
    const after = fireflyPlace(2, 1, bushes, 5)
    expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeGreaterThan(2)
  })

  it('잠자리채 반경 안의 가장 가까운 보이는 개체를 고른다', () => {
    const t = 3
    const { x, z } = fireflyPlace(4, 0, bushes, t)
    expect(fireflyNearest(x, z, bushes, {}, t, 1.5)).toBe(4)
    expect(fireflyNearest(x + 50, z + 50, bushes, {}, t, 1.5)).toBeNull()
    // 잡혀서 사라진 개체는 고르지 않는다
    expect(fireflyNearest(x, z, bushes, { 4: { until: 99, shift: 1 } }, t, 1.5)).not.toBe(4)
  })

  it('여름 밤에는 기존 구슬 반딧불이를 대체한다(다른 벌레는 그대로)', () => {
    expect(replacedByFireflies('firefly', true)).toBe(true)
    expect(replacedByFireflies('firefly', false)).toBe(false)
    expect(replacedByFireflies('moth', true)).toBe(false)
  })
})
