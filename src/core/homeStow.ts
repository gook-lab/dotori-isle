/**
 * 방 가구를 주머니로 되돌리는 대상 고르기. 가장 가까운 가구를 고르고, 방금 놓은 가구는 잠깐 동안 조금 멀어도 먼저 잡는다.
 * 놓은 칸은 바라보는 칸이라 보통 한두 칸 떨어져 있으니, 그 자리에서 바로 되돌릴 수 있게 하려는 규칙이다. 순수 함수다.
 */

/** 가까이 선 것으로 치는 거리(칸) */
export const STOW_NEAR = 1.3
/** 방금 놓은 가구를 먼저 잡는 거리(칸). 놓은 칸이 한 칸 떨어져도 되돌릴 수 있게 한 칸 더 넓다. */
export const STOW_JUST_NEAR = STOW_NEAR + 1
/** 방금 놓은 가구를 먼저 잡는 시간(ms) */
export const STOW_JUST_MS = 3000

/** 방금 놓은 가구의 id 와 놓은 시각(ms). 저장하지 않는다. */
export interface JustPlaced {
  id: string
  at: number
}

interface StowItem {
  id: string
  x: number
  z: number
  floor?: number
}

/**
 * 플레이어 위치(방 가운데 기준 좌표)와 층에서 되돌릴 가구를 고른다.
 * 방금 놓은 가구가 같은 층에서 3초 안이고 한 칸 더 넓은 거리 안에 있으면 그것을 고르고, 아니면 가장 가까운 가구를 고른다. 닿는 것이 없으면 null.
 */
export function pickStowTarget<T extends StowItem>(items: readonly T[], lx: number, lz: number, floor: number, just: JustPlaced | null, now: number): T | null {
  const onFloor = items.filter((x) => (x.floor ?? 0) === floor)
  if (just && now - just.at < STOW_JUST_MS) {
    const j = onFloor.find((x) => x.id === just.id)
    if (j && Math.hypot(j.x - lx, j.z - lz) < STOW_JUST_NEAR) return j
  }
  let best: T | null = null
  let bd = STOW_NEAR * STOW_NEAR
  for (const x of onFloor) {
    const d = (x.x - lx) ** 2 + (x.z - lz) ** 2
    if (d < bd) [best, bd] = [x, d]
  }
  return best
}
