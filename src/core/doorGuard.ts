/**
 * 현관 앞 보호 원. 주민은 집 현관 앞(반지름 DOOR_GUARD_R)에 머물지 않는다.
 * 현관 앞에 서 있는 것은 플레이어만 해서, 문으로 가는 길이 주민 대화에 막히지 않게 한다.
 */
export const DOOR_GUARD_R = 1.2

/** 점 (x, z) 를 중심 (cx, cz) 의 반지름 r 원 밖으로 민다. 이미 밖이면 그대로 둔다. */
export function keepOutOfDoor(pos: { x: number; z: number }, door: { x: number; z: number }, r = DOOR_GUARD_R): { x: number; z: number } {
  const dx = pos.x - door.x
  const dz = pos.z - door.z
  const d = Math.hypot(dx, dz)
  if (d >= r) return pos
  // 정중앙이면 방향이 없으니 집 쪽(+z 바깥)으로 민다
  if (d < 1e-9) return { x: door.x, z: door.z + r }
  return { x: door.x + (dx / d) * r, z: door.z + (dz / d) * r }
}

/** 플레이어가 문 판정 거리 안에서 문 쪽을 보고 있는지. 주민 대화보다 문을 먼저 고르는 조건이다. */
export function doorInFront(p: { x: number; z: number; facing: number }, door: { x: number; z: number }, r: number): boolean {
  const dx = door.x - p.x
  const dz = door.z - p.z
  return dx * dx + dz * dz < r * r && dx * Math.sin(p.facing) + dz * Math.cos(p.facing) > 0
}
