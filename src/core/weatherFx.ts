/**
 * 날씨가 바꾸는 바닥과 주민 모습. 순수 계산만 한다.
 * 날씨는 날짜 단위라서, 비가 그친 뒤의 마름은 다음 날 아침 몇 시간에 걸쳐 일어난다.
 */
import { hashString, mulberry32 } from './rng'
import type { Weather } from './weather'

/** 웅덩이 최대 수. 인스턴스 하나로 그린다. */
export const PUDDLE_MAX = 12
/** 비 온 다음 날 웅덩이가 마르기 시작하는 시각 */
export const PUDDLE_DRY_FROM = 6
/** 다 마르기까지 걸리는 게임 시간 */
export const PUDDLE_DRY_HOURS = 2

/**
 * 웅덩이가 남은 정도 0~1.
 * 오늘이 비면 하루 내내 1. 어제가 비였으면 아침 여섯 시부터 두 시간에 걸쳐 0 까지 마른다.
 */
export function puddleLevel(prev: Weather, today: Weather, hour: number): number {
  if (today === 'rain') return 1
  if (prev !== 'rain') return 0
  const k = (hour - PUDDLE_DRY_FROM) / PUDDLE_DRY_HOURS
  return Math.min(1, Math.max(0, 1 - k))
}

/** 웅덩이가 생기는 날(비 온 날). 비가 그친 다음 날엔 마르는 중인 전날 자리를 쓴다. */
export function puddleDay(today: string, prev: string, weather: Weather): string {
  return weather === 'rain' ? today : prev
}

/** 웅덩이 자리: 후보 중 그날 해시 순서로 최대 PUDDLE_MAX 곳. 같은 날이면 항상 같은 자리다. */
export function puddleSpots<T>(day: string, candidates: readonly T[]): T[] {
  const rng = mulberry32(hashString(`puddle:${day}`))
  return candidates
    .map((c) => ({ c, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, PUDDLE_MAX)
    .map((o) => o.c)
}

/** 비 오는 날 주민은 우산을 편다 */
export const umbrellaOn = (w: Weather) => w === 'rain'
/** 눈 오는 날 주민은 목도리를 두른다 */
export const scarfOn = (w: Weather) => w === 'snow'
/** 눈 위 발자국은 눈 오는 날 더 깊게(크고 진하게) 찍힌다 */
export const footprintDepth = (w: Weather) => (w === 'snow' ? 1.3 : 1)
