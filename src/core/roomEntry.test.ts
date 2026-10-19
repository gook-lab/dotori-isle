import { describe, expect, it } from 'vitest'
import { CAVE_ROOM, HALL_ROOM, HOME_ROOM, MUSEUM_ROOM, ROOM_ENTRY, ROOM_EXIT, roomCenter, roomWalkable, SHOP_ROOM } from './interior'
import { VILLAGERS } from './villagers'

/** 나가기 판정 거리(src/game/actions.ts 의 방 나가기 1.3)와 같은 값 */
const LEAVE_REACH = 1.3

/** 주민 방 칸 번호와 나머지 방 칸 번호를 모두 모은다. 방마다 같은 입장·출구 규칙을 쓴다. */
const roomIndexes = () => [
  ...VILLAGERS.map((_, i) => i),
  HOME_ROOM,
  MUSEUM_ROOM,
  CAVE_ROOM,
  HALL_ROOM,
  SHOP_ROOM,
]

describe('방 입장 자리', () => {
  it('모든 방에서 입장 자리는 출구 판정 거리 밖이라 들어온 직후 바로 나가지 않는다', () => {
    const dist = Math.hypot(ROOM_ENTRY.x - ROOM_EXIT.x, ROOM_ENTRY.z - ROOM_EXIT.z)
    expect(dist).toBeGreaterThan(LEAVE_REACH)
    for (const i of roomIndexes()) expect(dist, `room ${i}`).toBeGreaterThan(LEAVE_REACH)
  })

  it('모든 방에서 입장 자리는 걸을 수 있는 칸이다', () => {
    for (const i of roomIndexes()) {
      const c = roomCenter(i)
      expect(roomWalkable(c.x + ROOM_ENTRY.x, c.z + ROOM_ENTRY.z), `room ${i}`).toBe(true)
    }
  })
})
