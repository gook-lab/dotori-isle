import { describe, expect, it } from 'vitest'
import { ROOM_D, ROOM_FURNITURE, ROOM_W } from './interior'
import { onBed, ROOM_SPOT, spotClearance, villagerRoomSpot, type RoomSpot } from './villagerRoom'
import { TALK_R } from '../game/actions'

/** 플레이어 몸이 가구에 닿는 여유(가구 반지름에 더한다) */
const BODY_PAD = 0.35

/** 방 안이고 가구 원 밖인 곳인지(플레이어가 설 수 있는 자리) */
const standable = (x: number, z: number) => {
  if (Math.abs(x) > ROOM_W / 2 - 0.5 || Math.abs(z) > ROOM_D / 2 - 0.5) return false
  return ROOM_FURNITURE.every((f) => Math.hypot(x - f.x, z - f.z) >= f.r + BODY_PAD)
}

/** 주민 자리에서 대화 거리 안에 플레이어가 설 수 있는 곳이 있는지 */
const reachable = (spot: RoomSpot) => {
  const p = ROOM_SPOT[spot]
  for (let k = 0; k < 72; k++) {
    for (const r of [0.8, 1.2, 1.5, 1.8]) {
      if (r >= TALK_R) continue
      const a = (k / 72) * Math.PI * 2
      if (standable(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r)) return true
    }
  }
  return false
}

describe('주민 집 안 자리 시간 판정', () => {
  it('저녁에는 책장 앞에서 책을 읽는다', () => {
    expect(villagerRoomSpot(20)).toBe('reading')
    expect(villagerRoomSpot(22.5)).toBe('reading')
  })

  it('23시부터 4시 반까지는 침대에 눕는다', () => {
    expect(villagerRoomSpot(23)).toBe('bed')
    expect(villagerRoomSpot(0)).toBe('bed')
    expect(villagerRoomSpot(4.4)).toBe('bed')
  })

  it('새벽 4시 반부터 6시까지는 창가에 선다', () => {
    expect(villagerRoomSpot(4.5)).toBe('window')
    expect(villagerRoomSpot(5.9)).toBe('window')
  })

  it('경계 시각에서 자리가 바뀐다(22.99→책장, 23→침대, 6→집 밖이라 없음)', () => {
    expect(villagerRoomSpot(22.99)).toBe('reading')
    expect(villagerRoomSpot(23)).toBe('bed')
  })
})

describe('주민 집 안 자리 위치', () => {
  it('책장 앞과 창가 자리는 가구에서 떨어져 있다', () => {
    expect(spotClearance('reading')).toBeGreaterThan(0.2)
    expect(spotClearance('window')).toBeGreaterThan(0.2)
  })

  it('침대 자리는 침대 위에 있다', () => {
    expect(onBed()).toBe(true)
  })

  it('자리는 모두 방 안에 있다(방 크기 10×8 의 안쪽)', () => {
    for (const p of Object.values(ROOM_SPOT)) {
      expect(Math.abs(p.x)).toBeLessThan(4.5)
      expect(Math.abs(p.z)).toBeLessThan(3.5)
    }
  })
})

describe('주민 자리까지 플레이어가 다가갈 수 있다', () => {
  it('책 읽는 자리(러그)에는 대화 거리 안에 설 곳이 있다', () => {
    expect(reachable('reading')).toBe(true)
  })

  it('침대 자리에는 대화 거리 안에 설 곳이 있다(침대가 구석이어도)', () => {
    expect(reachable('bed')).toBe(true)
  })

  it('창가 자리에는 대화 거리 안에 설 곳이 있다', () => {
    expect(reachable('window')).toBe(true)
  })

  it('책 읽는 자리는 러그 위다(둥근 러그 반지름 안)', () => {
    const p = ROOM_SPOT.reading
    expect(Math.hypot(p.x - 0.2, p.z - 0.3)).toBeLessThan(1.7)
  })
})
