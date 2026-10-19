/**
 * 발 높이 따라가기. 계단 위에서 지면이 한 칸(STEP_RISER) 이하로 낮아지면 낙하하지 않고 바로 지면에 붙는다.
 * 절벽처럼 더 큰 차이는 아래로 떨어지고, 올라갈 때는 빠르게(200), 내려갈 때는 부드럽게(12) 따라간다.
 * 순수 함수라 React·Three 에 의존하지 않는다.
 */

import { STEP_RISER } from './tiers'

/** 한 프레임 뒤의 발 높이. onStep 은 onStepSpot(x, z) 로 구한다. */
export function footY(y: number, ground: number, onStep: boolean, dt: number): number {
  const drop = y - ground
  if (onStep && drop > 0 && drop <= STEP_RISER) return ground
  const rate = ground > y ? 200 : 12
  return Math.abs(ground - y) < 1 ? y + (ground - y) * (1 - Math.exp(-rate * dt)) : ground
}
