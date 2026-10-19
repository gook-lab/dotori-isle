import { dayPart } from './clock'

/** 실내 등불 빛(점광원)을 한 방에서 몇 개까지 켤지. 빛이 늘면 셰이더 비용과 그리기 호출이 같이 늘어난다. */
export const LAMP_LIGHT_MAX = 4

/** 실내 밝기 표. 밖의 햇빛·하늘빛을 이만큼 곱해서 방 안을 어둡게 한다. */
export interface InteriorLight {
  /** 저녁·밤이면 true */
  dim: boolean
  /** 해(또는 달) 빛 세기에 곱한다 */
  sunScale: number
  /** 환경광 세기에 곱한다 */
  hemiScale: number
  /** 천장 전구 세기에 곱한다 */
  bulbScale: number
  /** 천장 전구 색 */
  bulbColor: string
  /** 창 색 */
  windowColor: string
  /** 창에 별을 찍을지 */
  stars: boolean
}

const DAY: InteriorLight = { dim: false, sunScale: 1, hemiScale: 1, bulbScale: 1, bulbColor: '#ffe2b0', windowColor: '#a9dcf2', stars: false }

/**
 * 실내 밝기. 시간대는 clock.ts 의 dayPart 로 정한다(저녁 17~20시, 밤 20~4시 반).
 * 켜 둔 등이 있으면 방 전체를 조금 낮추고 등 주변이 상대적으로 밝게 보이게 한다.
 * 등이 하나도 없으면 방 전체를 더 낮춰 은은하게 어둡게 한다.
 */
export function interiorLight(hour: number, lamps: number): InteriorLight {
  const part = dayPart(hour)
  if (part !== 'evening' && part !== 'night') return DAY
  const lit = lamps > 0
  return {
    dim: true,
    sunScale: 0.3,
    hemiScale: lit ? 0.6 : 0.5,
    bulbScale: lit ? 0.75 : 0.6,
    bulbColor: '#ffc98a',
    windowColor: '#1f2a57',
    stars: true,
  }
}

/** 등 목록에서 실내 빛으로 만들 것만 고른다(앞에서부터 LAMP_LIGHT_MAX 개) */
export function lampLightsOf<T>(lamps: readonly T[]): T[] {
  return lamps.slice(0, LAMP_LIGHT_MAX)
}

/**
 * 벽 밝기 배율. 벽은 툰 재질이라 빛이 조금만 줄면 가장 밝은 단계에 그대로 머물러 낮과 같아 보인다.
 * 그래서 빛을 줄이는 것과 별도로 벽 색 자체를 곱해 준다.
 * 저녁·밤엔 어둡게 하고, 등이 있으면 등 가까운 벽만 조금 밝게 한다(nearLamp 0~1).
 */
export function wallShade(dim: boolean, lit: boolean, nearLamp: number): number {
  if (!dim) return 1
  if (!lit) return 0.5
  return 0.72 + 0.3 * Math.max(0, Math.min(1, nearLamp))
}

/** 등에서 가까운 정도(0~1). radius 안에서 가까울수록 1에 가깝다. */
export function nearness(dist: number, radius = 4): number {
  return Math.max(0, 1 - dist / radius)
}
