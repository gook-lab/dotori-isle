import { describe, expect, it } from 'vitest'
import { beachDecor } from './beach'
import { heightAt, islandDist } from './island'
import { onPier } from './waters'

describe('바닷가 장식 자리', () => {
  const spots = beachDecor()

  it('모래 띠에 낮게 놓이고 같은 씨앗이면 늘 같다', () => {
    expect(spots.length).toBeGreaterThan(20)
    expect(spots.length).toBeLessThanOrEqual(36)
    for (const s of spots) {
      expect(islandDist(s.x, s.z)).toBeGreaterThanOrEqual(0.9)
      expect(islandDist(s.x, s.z)).toBeLessThan(1)
      expect(heightAt(s.x, s.z)).toBeLessThanOrEqual(0.3)
      expect(onPier(s.x, s.z)).toBeNull()
    }
    expect(beachDecor()).toEqual(spots)
  })

  it('나무토막은 열 개까지만 놓는다', () => {
    expect(spots.filter((s) => s.kind === 'log').length).toBeLessThanOrEqual(10)
  })
})
