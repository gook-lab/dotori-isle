/**
 * 소나무 흔들기. 소나무에는 열매가 없어서 흔들어도 대부분 솔잎만 떨어진다.
 * 가끔 솔가지(목재)가 툭 떨어지고, 아주 드물게 매미가 날아간다. 한 그루는 하루에 한 번만 흔든다.
 */

export type PineShake = { kind: 'branch' } | { kind: 'bug'; id: string } | { kind: 'none' }

export const PINE_BRANCH_CHANCE = 0.2
export const PINE_BUG_CHANCE = 0.08
/** 소나무에서 떨어지는 곤충 */
export const PINE_BUG_ID = 'cicada'

/** roll 은 0 이상 1 미만의 난수. 가지 구간이 먼저, 곤충 구간이 그다음이다. */
export function pineShake(roll: number): PineShake {
  if (roll < PINE_BRANCH_CHANCE) return { kind: 'branch' }
  if (roll < PINE_BRANCH_CHANCE + PINE_BUG_CHANCE) return { kind: 'bug', id: PINE_BUG_ID }
  return { kind: 'none' }
}
