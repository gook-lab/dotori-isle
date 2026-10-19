/**
 * 안개 낀 아침. 날씨 표(weather.ts)와 따로 두는 겹침 효과라서 저장하지 않는다.
 * 날짜 시드로 그날 낄지 정하고, 시각은 아침 6~10시에만 실제로 보인다. 같은 날이면 늘 같다.
 */
import { hashString, mulberry32 } from './rng'
import type { Season } from './season'
import type { Weather } from './weather'

/** 안개가 보이는 아침 시간: 6시 이상 10시 미만 */
export const FOG_FROM = 6
export const FOG_UNTIL = 10

/** 계절별 안개 확률. 봄·가을 아침에만 낮게 낀다. 여름 장마와 겨울엔 끼지 않는다. */
export const FOG_CHANCE: Record<Season, number> = { spring: 0.25, summer: 0, autumn: 0.25, winter: 0 }

/** 그날 안개가 끼는지. 맑거나 흐린 날만 대상이고 비·눈 오는 날엔 끼지 않는다. */
export function fogDay(day: string, season: Season, weather: Weather): boolean {
  if (weather === 'rain' || weather === 'snow') return false
  return mulberry32(hashString(`fog:${day}`))() < FOG_CHANCE[season]
}

/** 지금 안개가 걷히기 전 아침인지 */
export function fogActive(day: string, season: Season, weather: Weather, hour: number): boolean {
  return hour >= FOG_FROM && hour < FOG_UNTIL && fogDay(day, season, weather)
}
