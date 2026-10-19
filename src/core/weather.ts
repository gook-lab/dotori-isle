import type { Lighting } from './clock'
import { devParam } from './devParam'
import { hashString, mulberry32 } from './rng'
import { seasonFor } from './season'
import { typhoonOn } from './wind'

/** 날씨는 날짜 키로 정해진다. 같은 날이면 새로고침해도 같다. 겨울엔 비 대신 눈이 온다. */

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow'

export const WEATHER_INFO: Record<Weather, { icon: string; label: string }> = {
  sunny: { icon: '☀️', label: '맑음' },
  cloudy: { icon: '☁️', label: '흐림' },
  rain: { icon: '🌧️', label: '비' },
  snow: { icon: '🌨️', label: '눈' },
}

/** `?weather=rain` 처럼 쿼리로 날씨를 고정해 확인할 수 있다. */
function readOverride(): Weather | null {
  if (typeof window === 'undefined') return null
  const raw = devParam('weather')
  return raw === 'sunny' || raw === 'cloudy' || raw === 'rain' || raw === 'snow' ? raw : null
}

const override = readOverride()

/** 섬에 처음 온 날. 저장 상태에서 store 가 맞춘다. null 이면 첫 날 규칙을 쓰지 않는다. */
let islandStart: string | null = null
export function setIslandStart(day: string | null): void {
  islandStart = day
}

/** 첫 섬 날(0일째)과 다음 날(1일째)은 맑다. 처음 와서 비 오는 화면을 보지 않게 한다. */
export const ISLAND_SUNNY_DAYS = 2

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00`)

export function weatherFor(day: string): Weather {
  if (override) return override
  if (islandStart && !Number.isNaN(dayMs(day)) && !Number.isNaN(dayMs(islandStart))) {
    const n = Math.round((dayMs(day) - dayMs(islandStart)) / 86400000)
    if (n >= 0 && n < ISLAND_SUNNY_DAYS) return 'sunny'
  }
  // 태풍이 오는 날은 비가 세게 온다(바람 세기는 wind.ts 의 windLevel 로 따로 본다)
  if (typhoonOn(day)) return 'rain'
  const r = mulberry32(hashString(`weather:${day}`))()
  // 계절마다 궂은 날 비율이 다르다. 여름은 장마로 비가 잦고 가을은 맑은 날이 많다.
  const season = seasonFor(day)
  const wet = { spring: 0.22, summer: 0.32, autumn: 0.15, winter: 0.3 }[season]
  if (r < wet) return season === 'winter' ? 'snow' : 'rain'
  return r < wet + 0.25 ? 'cloudy' : 'sunny'
}

const GRAY: [number, number, number] = [0.62, 0.66, 0.7]

/** 흐리거나 비 오는 날은 하늘을 회색 쪽으로 섞고 햇빛을 줄인다. 밤에는 원래 어두워서 덜 섞는다. */
export function weatherLighting(l: Lighting, w: Weather): Lighting {
  if (w === 'sunny') return l
  const k = w === 'rain' ? 0.55 : w === 'snow' ? 0.42 : 0.32
  const bright = Math.min(1, l.sunIntensity / 1.5)
  const mixK = k * bright
  return {
    sky: l.sky.map((v, i) => v + (GRAY[i] * bright - v) * mixK) as Lighting['sky'],
    sun: l.sun,
    sunIntensity: l.sunIntensity * (w === 'rain' ? 0.45 : w === 'snow' ? 0.6 : 0.7),
    // 눈밭은 빛을 되받아 주변광이 오히려 밝다.
    ambient: l.ambient * (w === 'rain' ? 0.85 : w === 'snow' ? 1.1 : 0.95),
  }
}
