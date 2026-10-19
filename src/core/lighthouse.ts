/**
 * 북쪽 곶의 등대. 밤 19시~5시에만 등불이 돌고 빛줄기가 보인다.
 * 빛줄기 세기는 시각과 안개 낀 날 여부로 정하는 순수 함수다.
 */
import { isNight } from './clock'
import { radiusAt } from './island'

/** 북쪽 곶: 섬 반지름이 가장 큰 자리(반지름 72 근처). 등대는 그 안쪽 바위 위에 선다. */
export const LIGHTHOUSE_ANGLE = -1.391
/** 물가 반지름에 곱하는 비율. 0.88 이면 물가 조금 안쪽이다. */
export const LIGHTHOUSE_REACH = 0.88
/** 등불이 한 바퀴 도는 속도(라디안/초). 약 9초에 한 바퀴다. */
export const LAMP_SPEED = 0.7
/** 받침 바위를 둘러싼 막는 반지름. 걸을 수 없는 자리로 본다. */
export const LIGHTHOUSE_SOLID_R = 1.5
/** 빛줄기 길이(섬 바깥 바다까지) */
export const BEAM_LENGTH = 90

export function lighthouseSpot(): { x: number; z: number } {
  const r = radiusAt(LIGHTHOUSE_ANGLE) * LIGHTHOUSE_REACH
  return { x: Math.cos(LIGHTHOUSE_ANGLE) * r, z: Math.sin(LIGHTHOUSE_ANGLE) * r }
}

/** 등불 각도. 밤에만 돈다. */
export function lampAngle(t: number): number {
  return (t * LAMP_SPEED) % (Math.PI * 2)
}

/**
 * 빛줄기 세기 0~1.4.
 * 낮엔 0(등불과 빛줄기 모두 꺼짐). 밤엔 1, 안개 낀 날 밤엔 1.4 로 또렷해진다.
 */
export function beamStrength(hour: number, foggyDay: boolean): number {
  if (!isNight(hour)) return 0
  return foggyDay ? 1.4 : 1
}
