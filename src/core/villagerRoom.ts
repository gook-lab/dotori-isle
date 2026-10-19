/**
 * 주민이 집 안에서 머무는 자리. 시간에 따라 책장 앞에서 책을 읽고, 밤에는 침대에 눕고, 새벽에는 창가에 선다.
 * 방 가운데 기준 좌표라 씬과 행동 판정이 같은 값을 쓴다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { ROOM_FURNITURE } from './interior'

export type RoomSpot = 'reading' | 'bed' | 'window'

/** 시간대별 자리. 23시부터 4시 반까지는 침대, 4시 반부터 6시까지는 창가, 그 밖(저녁)에는 책장 앞이다. */
export function villagerRoomSpot(hour: number): RoomSpot {
  if (hour >= 23 || hour < 4.5) return 'bed'
  if (hour < 6) return 'window'
  return 'reading'
}

/** 자리마다 방 가운데 기준 위치와 바라보는 방향(atan2 각). 책 읽는 자리는 러그 위, 창가는 창을 본다. */
export const ROOM_SPOT: Readonly<Record<RoomSpot, { x: number; z: number; facing: number }>> = {
  // 러그 위(둥근 러그 가운데 뒤쪽)에 앉아 책장을 본다. 바닥에 앉는 자세라 서서 앉은 모양이 안 난다.
  reading: { x: 0.2, z: -0.6, facing: Math.PI },
  // 머리가 베개(머리판 쪽)에 오도록 침대 안쪽으로 0.15 옮긴다. 옆으로 누우면 머리가 몸통에서 1.08 떨어져 있다.
  bed: { x: -3.05, z: -2.2, facing: Math.PI / 2 },
  window: { x: 2.2, z: -2.6, facing: Math.PI },
}

const furnitureAt = (id: string) => ROOM_FURNITURE.find((f) => f.id === id)!

/** 자리가 가구와 겹치지 않는지 본다. 침대 자리는 침대 위에 눕는 것이라 침대만 예외다. */
export function spotClearance(spot: RoomSpot): number {
  const p = ROOM_SPOT[spot]
  return Math.min(
    ...ROOM_FURNITURE.filter((f) => !(spot === 'bed' && f.id === 'bed')).map((f) => Math.hypot(p.x - f.x, p.z - f.z) - f.r),
  )
}

/** 침대 자리가 침대 위인지(침대 반지름 안) */
export function onBed(): boolean {
  const p = ROOM_SPOT.bed
  const bed = furnitureAt('bed')
  return Math.hypot(p.x - bed.x, p.z - bed.z) <= bed.r
}
