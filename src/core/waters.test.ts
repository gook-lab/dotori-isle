import { describe, expect, it } from 'vitest'
import { groundAt, heightAt, isWalkable, normDist, radiusAt, waterLevelAt } from './island'
import { speciesFor, FISH_TABLE } from './items'
import { BRIDGES, PONDS, pondLevel } from './waters'
import { castSpot } from '../game/actions'

describe('연못 · 개울 · 다리', () => {
  it('섬 둘레 어디서든 잔디에서 모래사장으로 내려가 물가까지 걸어간다', () => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
      const r = radiusAt(a)
      for (const k of [0.78, 0.81, 0.82, 0.84, 0.9, 0.96]) {
        const x = Math.cos(a) * r * k
        const z = Math.sin(a) * r * k
        if (groundAt(x, z) === 'water') continue
        expect(isWalkable(x, z), `${a.toFixed(2)} @ ${k}`).toBe(true)
      }
    }
  })

  it('연못 가운데는 물이고 들어갈 수 없다', () => {
    for (const p of PONDS) {
      expect(groundAt(p.x, p.z)).toBe('water')
      expect(waterLevelAt(p.x, p.z)).toBe(pondLevel(p))
      expect(isWalkable(p.x, p.z)).toBe(false)
      expect(heightAt(p.x, p.z)).toBeLessThan(pondLevel(p))
    }
  })

  it('다리 위는 걸을 수 있고 물이 아니다', () => {
    for (const b of BRIDGES) {
      expect(isWalkable(b.x, b.z)).toBe(true)
      expect(groundAt(b.x, b.z)).not.toBe('water')
      expect(heightAt(b.x, b.z)).toBeGreaterThan(1.1)
    }
  })

  it('연못가에서 연못 쪽으로 낚싯대를 던질 수 있다', () => {
    const p = PONDS[0]
    const x = p.x
    const z = p.z - p.r - 1.2
    expect(isWalkable(x, z)).toBe(true)
    const spot = castSpot(x, z, 0)
    expect(spot).not.toBeNull()
    expect(groundAt(spot!.x, spot!.z)).toBe('water')
  })

  it('모래사장에서 바다로 던질 수 있다', () => {
    const a = 1
    const r = radiusAt(a) * 0.95
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    expect(normDist(x, z)).toBeLessThan(1)
    expect(castSpot(x, z, Math.atan2(x, z))).not.toBeNull()
  })

  it('민물고기는 연못·개울에서만, 바닷물고기는 바다에서만 낚인다', () => {
    for (const night of [false, true]) {
      const pond = speciesFor(FISH_TABLE, night, false, 'summer', 'pond')
      const river = speciesFor(FISH_TABLE, night, false, 'summer', 'river')
      const sea = speciesFor(FISH_TABLE, night, false, 'summer', 'sea')
      expect(pond.length).toBeGreaterThan(0)
      expect(river.length).toBeGreaterThan(0)
      expect(pond.every((f) => f.habitat === 'pond')).toBe(true)
      expect(river.every((f) => f.habitat === 'river')).toBe(true)
      expect(sea.every((f) => (f.habitat ?? 'sea') === 'sea')).toBe(true)
    }
  })
})
