import { describe, expect, it } from 'vitest'
import '../game/store'
import { villagerAt } from '../game/actions'
import { runtime } from '../game/runtime'
import { HOME_SITE } from './home'
import { DOOR_GUARD_R, doorInFront, keepOutOfDoor } from './doorGuard'
import { VILLAGERS } from './villagers'

const door = { x: 4, z: 6 }

describe('현관 앞 보호 원', () => {
  it('원 안의 점은 원 가장자리로 밀어낸다', () => {
    const p = keepOutOfDoor({ x: 4, z: 6.5 }, door)
    expect(Math.hypot(p.x - door.x, p.z - door.z)).toBeCloseTo(DOOR_GUARD_R, 6)
    expect(p.z).toBeGreaterThan(door.z)
  })

  it('원 밖의 점은 그대로 둔다', () => {
    expect(keepOutOfDoor({ x: 9, z: 9 }, door)).toEqual({ x: 9, z: 9 })
  })

  it('문 한가운데 점은 방향이 없어도 원 가장자리로 간다', () => {
    const p = keepOutOfDoor({ ...door }, door)
    expect(Math.hypot(p.x - door.x, p.z - door.z)).toBeCloseTo(DOOR_GUARD_R, 6)
  })
})

describe('문 우선 판정', () => {
  it('문 쪽을 보고 판정 거리 안에 있으면 참', () => {
    // 플레이어가 +z 쪽에 있고 문은 -z 쪽: 문을 향하려면 facing 이 π 여야 한다
    const p = { x: 4, z: 7, facing: Math.PI }
    expect(doorInFront(p, door, 1.2)).toBe(true)
  })

  it('등을 돌리고 있으면 거짓', () => {
    expect(doorInFront({ x: 4, z: 7, facing: 0 }, door, 1.2)).toBe(false)
  })

  it('판정 거리 밖이면 거짓', () => {
    expect(doorInFront({ x: 4, z: 9, facing: Math.PI }, door, 1.2)).toBe(false)
  })
})

describe('주민 위치는 현관 원 밖이다', () => {
  it('기본 섬의 모든 주민이 여러 시각에 현관 원 밖에 있다', () => {
    expect(HOME_SITE).not.toBeNull()
    const houses = VILLAGERS.map((v) => v.id)
    for (const v of VILLAGERS) {
      for (let t = 0; t < 600; t += 7) {
        runtime_clock(v.id, t)
        const at = villagerAt(v, houses)
        if (at.home) continue
        const d = Math.hypot(at.x - HOME_SITE!.door.x, at.z - HOME_SITE!.door.z)
        expect(d, `${v.id} t=${t}`).toBeGreaterThanOrEqual(DOOR_GUARD_R - 1e-6)
      }
    }
  })
})

function runtime_clock(id: string, t: number) {
  runtime.vclock[id] = t
}
