import { devParam } from './devParam'
import { hashString } from './rng'
import type { Weather } from './weather'

/**
 * 하늘 이벤트: 유성우 밤과 비 갠 뒤 무지개.
 * 날짜와 날씨만으로 정하는 순수 함수다. 장면과 행동, 편지가 같은 값을 본다.
 * URL 의 `?sky=meteor` 또는 `?sky=rainbow` 로 해당 이벤트를 강제해 확인할 수 있다.
 */

const SKY_OVERRIDE = ((): 'meteor' | 'rainbow' | null => {
  if (typeof window === 'undefined') return null
  const raw = devParam('sky')
  return raw === 'meteor' || raw === 'rainbow' ? raw : null
})()

/** 유성우 밤은 대략 열 번에 한 번, 맑은 날 밤에만 온다 */
export const METEOR_ODDS = 10
/** 별똥별 예보를 보여 주는 날 수(오늘부터). 그 뒤 날은 비공개다. */
export const METEOR_FORECAST_DAYS = 6

/** 그 날 밤이 유성우 밤인지. 날짜 해시로 정해서 같은 날은 언제나 같다. */
export function isMeteorNight(day: string, weather: Weather): boolean {
  if (SKY_OVERRIDE === 'meteor') return true
  return weather === 'sunny' && hashString(`meteor:${day}`) % METEOR_ODDS === 0
}

/** 유성이 보이는 시간대: 저녁 여덟 시부터 새벽 다섯 시 전까지 */
export function meteorHours(hour: number): boolean {
  return hour >= 20 || hour < 5
}

/** 비 그친 낮인지: 어제가 비였고 오늘은 비가 아니다 */
export function rainbowDay(prev: Weather, today: Weather): boolean {
  if (SKY_OVERRIDE === 'rainbow') return true
  return prev === 'rain' && today !== 'rain'
}

/** 무지개가 걸리는 한 시간(오후 세 시) */
export function rainbowHour(hour: number): boolean {
  return hour >= 14 && hour < 17
}

/** 날짜 키에서 하루를 뺀 키 */
export function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** 주민이 아침에 전하는 유성우 소식과 무지개 소식 */
export const METEOR_LINE = '오늘 밤엔 별똥별이 많이 떨어질 거래! 하늘을 올려다봐.'
export const RAINBOW_LINE = '비가 그쳤어! 하늘에 무지개가 떴을지도 몰라, 가 봐.'
