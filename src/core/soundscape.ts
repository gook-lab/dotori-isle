/**
 * 섬 소리 풍경의 세기 규칙. 음은 game/ambience.ts 가 WebAudio 로 합성하고, 여기서는 얼마나 크게 깔지와
 * 언제 울지만 정한다. 순수 함수라 테스트로 고정한다.
 */

import type { WindLevel } from './wind'

export type SkyWeather = 'sunny' | 'cloudy' | 'rain' | 'snow'

/** 거리 감쇠: 범위 안에서 0(범위 밖)~1(바로 옆). 제곱으로 줘서 가까워질수록 급하게 커진다. */
export function proximity(dist: number, range: number): number {
  const x = Math.max(0, Math.min(1, 1 - dist / range))
  return x * x
}

export const isNight = (hour: number) => hour < 5 || hour >= 19

/** 파도: 물가에 가까울수록 크고, 바람 날엔 물결이 높아 더 세며, 태풍엔 가장 세다. */
export function waveVolume(shore: number, wind: WindLevel): number {
  const swell = wind === 'typhoon' ? 1.6 : wind === 'breeze' ? 1.2 : 1
  return (0.015 + shore * 0.11) * swell
}

/** 바람 소리: 바람 날엔 옅게, 태풍엔 세게 분다. 집 안에선 거의 안 든다. */
export function windVolume(wind: WindLevel, indoor: boolean): number {
  const base = wind === 'typhoon' ? 0.09 : wind === 'breeze' ? 0.035 : 0
  return base * (indoor ? 0.2 : 1)
}

/** 빗소리: 비는 0.05, 태풍 비는 0.09. 집 안이나 동굴에서는 먹먹하다. 비가 아니면 0. */
export function rainVolume(weather: SkyWeather, wind: WindLevel, indoor: boolean): number {
  if (weather !== 'rain') return 0
  if (indoor) return 0.015
  return wind === 'typhoon' ? 0.09 : 0.05
}

/** 낮 새소리: 바깥에서 비·눈이 아닌 낮에만 운다. */
export function birdsOn(hour: number, weather: SkyWeather, indoor: boolean): boolean {
  return !isNight(hour) && !indoor && weather !== 'rain' && weather !== 'snow'
}

/** 밤 풀벌레와 부엉이: 바깥에서 비·눈이 아닌 밤에만 운다. */
export function nightCallsOn(hour: number, weather: SkyWeather, indoor: boolean): boolean {
  return isNight(hour) && !indoor && weather !== 'rain' && weather !== 'snow'
}

/** 동굴 물방울: 초당 몇 번 떨어지는지. 동굴 안에서만 떨어진다. */
export function dripsPerSecond(cave: boolean): number {
  return cave ? 0.4 : 0
}

/** 동굴 메아리: 물방울 소리가 되돌아오는 간격(초)과 되울림 세기(0~1) */
export const ECHO = { delay: 0.27, feedback: 0.4 } as const
