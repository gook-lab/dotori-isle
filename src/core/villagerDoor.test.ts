import { describe, expect, it } from 'vitest'
import '../game/store'
import { doorOrder } from './doorFacing'
import { HOME_SITE } from './home'
import { HOUSE_R, HOUSE_GAP, VILLAGER_DOOR_D, VILLAGERS, villagerDoorOpen } from './villagers'

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

describe('주민 집 현관', () => {
  it('19채 모두 북쪽(cos < 0)을 보지 않고, 문 앞이 걸을 수 있는 땅이다', () => {
    expect(VILLAGERS.length).toBeGreaterThan(0)
    for (const v of VILLAGERS) {
      expect(Math.cos(v.house.rot)).toBeGreaterThanOrEqual(-1e-9)
      expect(villagerDoorOpen(v.house.x, v.house.z, v.house.rot)).toBe(true)
    }
  })

  it('문에서 마당까지 걷는 거리가 문을 마당 쪽에 둔 것보다 HOUSE_GAP 이상 늘지 않는다', () => {
    // 마당 쪽으로 문을 낸 원래 거리는 HOUSE_GAP - 문 깊이 이다. 남·동·서로 돌려도 직선으로 이만큼만 늘어난다.
    const before = HOUSE_GAP - VILLAGER_DOOR_D
    for (const v of VILLAGERS) {
      const door = { x: v.house.x + Math.sin(v.house.rot) * VILLAGER_DOOR_D, z: v.house.z + Math.cos(v.house.rot) * VILLAGER_DOOR_D }
      expect(dist(door, v.home) - before).toBeLessThan(HOUSE_GAP)
    }
  })

  it('플레이어 집과 주민 집은 반지름 합 이상 떨어져 있다', () => {
    expect(HOME_SITE).not.toBeNull()
    for (const v of VILLAGERS) expect(dist(v.house, HOME_SITE!)).toBeGreaterThanOrEqual(HOUSE_R * 2)
  })

  it('현관 방향 순서는 마당 쪽에 가까운 방향부터 돈다', () => {
    expect(doorOrder(Math.PI)[0]).not.toBe(0)
    expect(doorOrder(0)[0]).toBe(0)
  })
})
