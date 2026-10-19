/**
 * 집 현관 방향 고르기. 게임 카메라는 남쪽에서 북쪽을 보므로 현관은 기본으로 남(0)을 보고,
 * 막히면 동(π/2), 서(-π/2) 순으로 돌린다. rot 은 (sin, cos) 로 문 방향을 정한다.
 */
export const DOOR_DIRS = [0, Math.PI / 2, -Math.PI / 2] as const

/** 두 각도의 차이(0 ~ π) */
const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

/**
 * 시도할 순서. target(각도)이 없으면 남·동·서 고정 순서(플레이어 집).
 * target 이 있으면 그 방향에 가까운 순서(주민 집: 마당 쪽으로 문을 연다).
 */
export function doorOrder(target?: number): number[] {
  if (target === undefined) return [...DOOR_DIRS]
  return [...DOOR_DIRS].sort((a, b) => angleGap(a, target) - angleGap(b, target))
}

/** 순서대로 보고 문 앞이 열린 첫 방향을 고른다. 모두 막히면 null. */
export function pickDoorRot(order: readonly number[], open: (rot: number) => boolean): number | null {
  return order.find((r) => open(r)) ?? null
}
