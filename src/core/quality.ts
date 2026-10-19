/** 그래픽 품질: 높음·보통·낮음. 값마다 Canvas 해상도·그림자·풀 밀도가 정해진다. */
export type Quality = 'high' | 'normal' | 'low'

export const QUALITY_NAME: Record<Quality, string> = { high: '높음', normal: '보통', low: '낮음' }

export interface QualityProfile {
  /** 픽셀 비율 범위(R3F dpr). 낮음은 1 로 고정한다. */
  dpr: [number, number]
  shadows: boolean
  /** 꽃·풀 개수에 곱하는 비율 */
  grass: number
}

export const PROFILES: Record<Quality, QualityProfile> = {
  high: { dpr: [1, 2], shadows: true, grass: 1 },
  normal: { dpr: [1, 1.5], shadows: true, grass: 1 },
  low: { dpr: [1, 1], shadows: false, grass: 0.5 },
}

/** 기기 특성. 브라우저에서 읽어 넣는다. */
export interface DeviceHint {
  touch: boolean
  width: number
  /** navigator.hardwareConcurrency. 모르면 undefined */
  cores?: number
}

/**
 * 처음 켤 때의 기본값. 터치 기기나 좁은 화면은 보통, 코어가 두 개 이하인 기기는 낮음,
 * 나머지는 높음이다. 설정에서 바꾸면 그 값을 쓴다.
 */
export function guessQuality(d: DeviceHint): Quality {
  if (d.cores !== undefined && d.cores <= 2) return 'low'
  if (d.touch || d.width < 800) return 'normal'
  return 'high'
}

export function isQuality(v: unknown): v is Quality {
  return v === 'high' || v === 'normal' || v === 'low'
}
