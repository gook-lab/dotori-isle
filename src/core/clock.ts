import { devParam } from './devParam'
/** 섬의 시간은 현실 시계를 따른다. `?hour=20` 으로 시간을 고정해 밤 장면을 확인할 수 있다. */

function readOverride(): number | null {
  if (typeof window === 'undefined') return null
  const raw = devParam('hour')
  const h = raw === null ? NaN : Number(raw)
  return Number.isFinite(h) ? ((h % 24) + 24) % 24 : null
}

const override = readOverride()

/** 개발용 날짜 고정: `?date=2026-10-31` 이면 그 날로 본다(행사 날 확인용). 배포 빌드에서는 무시한다. */
export function dayOverride(): string | null {
  const raw = devParam('date')
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

export function currentHour(now = new Date(), fixed = override): number {
  return fixed ?? now.getHours() + now.getMinutes() / 60
}

export function isNight(hour: number): boolean {
  return hour >= 19 || hour < 5
}

export function timeLabel(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.floor((hour - h) * 60)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`
}

export interface Lighting {
  sky: [number, number, number]
  sun: [number, number, number]
  sunIntensity: number
  ambient: number
}

type Key = [hour: number, sky: string, sun: string, sunIntensity: number, ambient: number]

// 아침 노을 → 낮 → 오후 황금빛 → 주황 노을 → 보랏빛 땅거미 → 밤
const KEYS: Key[] = [
  [0, '#141a36', '#6f80d0', 0.35, 0.22],
  [4.5, '#232b5a', '#8f9ad6', 0.38, 0.26],
  [5.5, '#7d6aa8', '#ffb59a', 0.55, 0.4],
  [6.5, '#f3b38a', '#ffc58f', 0.85, 0.6],
  [8.5, '#8fd3f4', '#fff4e0', 1.5, 0.85],
  [15.5, '#8fd3f4', '#fff4e0', 1.5, 0.85],
  [17, '#f2cf8a', '#ffb070', 1.25, 0.78],
  [18.2, '#f59e6b', '#ff8a5c', 0.95, 0.62],
  [19, '#b8708f', '#e88aa0', 0.6, 0.45],
  [19.8, '#4a3d78', '#9a8fd6', 0.42, 0.32],
  [20.6, '#1c2148', '#7584d0', 0.36, 0.24],
  [24, '#141a36', '#6f80d0', 0.35, 0.22],
]

/** 하루 중 어느 때인지. 화면 문구나 대사에서 쓴다. */
export type DayPart = 'dawn' | 'morning' | 'day' | 'evening' | 'night'

export function dayPart(hour: number): DayPart {
  if (hour >= 4.5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

/**
 * 해(밤엔 달)가 비추는 방향. 해는 6시 동쪽(+x)에서 떠 정오에 높이 올랐다가 18시 서쪽으로 진다.
 * 낮게 뜰수록 그림자가 길다. 밤엔 달이 같은 길을 반대 시간대에 지난다.
 */
export function sunDirection(hour: number): [number, number, number] {
  const day = hour >= 6 && hour < 18.6
  const k = day ? (hour - 6) / 12.6 : (((hour - 18.6 + 24) % 24) / 11.4)
  const a = k * Math.PI
  // 너무 낮으면 그림자가 끝없이 늘어나서 최소 높이를 둔다. 해 질 녘엔 그림자를 더 길게 눕힌다.
  const up = Math.max(0.2, Math.sin(a))
  return [Math.cos(a), up, 0.45]
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number]

/** 해의 높이(사인). 낮에는 6시 0에서 정오 위로, 18.6시 0에 지고 그 뒤 음수로 내려간다. 해 질 녘 빛에 쓴다. */
export function sunElevation(hour: number): number {
  const day = hour >= 6 && hour < 18.6
  const k = day ? (hour - 6) / 12.6 : (((hour - 18.6 + 24) % 24) / 11.4)
  return day ? Math.sin(k * Math.PI) : -Math.sin(k * Math.PI)
}

/** 하늘에서 해가 있는 방향(정규화). 해 원반과 빛 번짐을 놓는 자리다. 저녁엔 서쪽으로 진다. */
export function sunSkyDirection(hour: number): [number, number, number] {
  const day = hour >= 6 && hour < 18.6
  const a = day ? ((hour - 6) / 12.6) * Math.PI : hour >= 12 ? Math.PI : 0
  const x = Math.cos(a)
  const y = sunElevation(hour)
  const z = 0.45
  const n = Math.hypot(x, y, z)
  return [x / n, y / n, z / n]
}

export function lightingAt(hour: number): Lighting {
  const i = KEYS.findIndex((k, idx) => idx < KEYS.length - 1 && hour >= k[0] && hour < KEYS[idx + 1][0])
  const a = KEYS[Math.max(0, i)]
  const b = KEYS[Math.max(0, i) + 1]
  const t = (hour - a[0]) / (b[0] - a[0])
  return {
    sky: mix(hexRgb(a[1]), hexRgb(b[1]), t),
    sun: mix(hexRgb(a[2]), hexRgb(b[2]), t),
    sunIntensity: a[3] + (b[3] - a[3]) * t,
    ambient: a[4] + (b[4] - a[4]) * t,
  }
}
