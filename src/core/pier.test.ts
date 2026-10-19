import { describe, expect, it } from 'vitest'
import { generateDay } from './daily'
import { heightAt, isWalkable } from './island'
import { DOCKS } from './world'
import { onPier, PIER_DECK, PIER_LEN } from './waters'

const home = DOCKS.find((d) => d.id === 'home')!
const along = (f: number, s = 0) => ({ x: home.x + Math.cos(home.angle) * f + Math.sin(home.angle) * s, z: home.z + Math.sin(home.angle) * f - Math.cos(home.angle) * s })

describe('부두 판자 길', () => {
  it('부두마다 판자 길이 등록되고, 판자 위는 잡히고 옆·끝 밖은 안 잡힌다', () => {
    expect(DOCKS.every((d) => onPier(d.x + Math.cos(d.angle) * 5, d.z + Math.sin(d.angle) * 5))).toBe(true)
    expect(onPier(along(5, 1.2).x, along(5, 1.2).z)).toBeNull()
    expect(onPier(along(PIER_LEN + 0.5).x, along(PIER_LEN + 0.5).z)).toBeNull()
  })

  it('바다 위 판자는 걸을 수 있고 판자 높이로 선다', () => {
    const p = along(PIER_LEN - 1)
    expect(isWalkable(p.x, p.z)).toBe(true)
    expect(heightAt(p.x, p.z)).toBe(PIER_DECK)
  })

  it('판자 밖 바다는 여전히 걸을 수 없다', () => {
    const p = along(PIER_LEN - 1, 2.5)
    expect(isWalkable(p.x, p.z)).toBe(false)
  })

  it('부두 끝 바다에 물고기가 모여 있어서 판자 끝에서 그림자가 보인다', () => {
    const tip = along(PIER_LEN)
    const near = generateDay('2026-10-19').fish.filter((f) => Math.hypot(f.x - tip.x, f.z - tip.z) < 4.5)
    expect(near.length).toBeGreaterThanOrEqual(2)
  })
})
