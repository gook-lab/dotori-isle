/**
 * 바람 날·바람 풍선·태풍. 날씨 표(weather.ts)와 따로 두는 겹침 효과라서 저장하지 않는다.
 * 날짜 시드로 정하므로 같은 날이면 늘 같다. 태풍 예보와 떠밀려 온 물건도 날짜에서 바로 나온다.
 */
import { hashString, mulberry32 } from './rng'
import { seasonFor, type Season } from './season'

/** 바람 정도. 태풍은 바람 날의 두 배 이상으로 세고 물결도 높다. */
export type WindLevel = 'calm' | 'breeze' | 'typhoon'

/** 계절별 바람 날 확률. 봄·가을 가끔 분다. 여름 태풍은 따로 정한다. */
export const WIND_CHANCE: Record<Season, number> = { spring: 0.2, summer: 0, autumn: 0.2, winter: 0 }

/** 날짜 문자열(YYYY-MM-DD)에 n일을 더한다. 달이 넘어가도 맞는다. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10)
}

/** 바람 날인지. 태풍 날은 여기서 빼고 따로 본다. */
export function windDay(day: string): boolean {
  if (typhoonOn(day)) return false
  return mulberry32(hashString(`wind:${day}`))() < WIND_CHANCE[seasonFor(day)]
}

export function windLevel(day: string): WindLevel {
  if (typhoonOn(day)) return 'typhoon'
  return windDay(day) ? 'breeze' : 'calm'
}

/**
 * 깃발이 펄럭이는 세기. 진폭(라디안)과 속도(초당 주기). 평소 날과 약한 바람 날은 거의 같게 두고(진폭 0.2 안팎),
 * 태풍에서만 크게 흔든다. 비가 오면 같은 바람에서도 조금 더 젖혀 펄럭인다.
 */
export function flagSwing(level: WindLevel, rainy: boolean): { amp: number; speed: number } {
  const base = level === 'typhoon' ? { amp: 0.55, speed: 5.2 } : level === 'breeze' ? { amp: 0.22, speed: 2.4 } : { amp: 0.2, speed: 2.2 }
  return rainy ? { amp: base.amp + 0.06, speed: base.speed + 0.6 } : base
}

/** 바람 풍선이 지나는 시각(시). 바람 날에만 절반쯤, 낮 10시에서 16시 사이다. 없으면 null. */
export const BALLOON_SPAN = 0.5
export function balloonHour(day: string): number | null {
  if (!windDay(day)) return null
  const r = mulberry32(hashString(`balloon:${day}`))
  if (r() >= 0.5) return null
  return 10 + Math.floor(r() * 6)
}

/** 풍선이 떠 있는 동안의 진행도(0~1). 떠 있지 않으면 null. */
export function balloonProgress(day: string, hour: number): number | null {
  const h = balloonHour(day)
  if (h === null) return null
  const t = (hour - h) / BALLOON_SPAN
  return t >= 0 && t < 1 ? t : null
}

/** 태풍이 오는 날: 여름 끝(8월 20일 이후) 1년에 한두 번. 같은 해에는 늘 같다. */
export function typhoonDays(year: number): string[] {
  const r = mulberry32(hashString(`typhoon:${year}`))
  const first = 20 + Math.floor(r() * 12)
  const days = [first]
  if (r() < 0.5) {
    let second = 20 + Math.floor(r() * 12)
    if (second === first) second = second === 31 ? 20 : second + 1
    days.push(second)
  }
  return days.sort((a, b) => a - b).map((d) => `${year}-08-${String(d).padStart(2, '0')}`)
}

export function typhoonOn(day: string): boolean {
  return typhoonDays(Number(day.slice(0, 4))).includes(day)
}

/** 내일 태풍이면 오늘 아침 예보 편지가 온다 */
export function typhoonEve(day: string): boolean {
  return typhoonOn(addDays(day, 1))
}

/** 태풍이 지나간 다음 날 아침: 떠밀려 온 물건이 해변에 많다 */
export function typhoonAftermath(day: string): boolean {
  return typhoonOn(addDays(day, -1))
}

/** 풍선이 잡히는 반경(마을 바닥에서 풍선 아래 자리까지의 거리) */
export const BALLOON_R = 2.6

/** 풍선이 지나는 자리: 진행도 0 에서 1 까지 섬 서쪽에서 동쪽으로 가로지른다. 높이는 살짝 출렁인다. */
export function balloonPosition(t: number): { x: number; y: number; z: number } {
  // 기본 카메라 시야 안에 들도록 낮게 난다. 높이 2.5 에 살짝 떠다니는 흔들림을 준다.
  return { x: -30 + 60 * t, y: 2.5 + Math.sin(t * Math.PI * 2) * 0.25, z: 3 }
}
