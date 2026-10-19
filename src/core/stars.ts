/**
 * 별자리와 망원경. 섬 테마로 직접 지은 이름만 쓴다(실제 별자리 이름은 쓰지 않는다).
 * 계절마다 세 개씩, 모두 열두 개다. 망원경으로 볼 별자리는 날짜 시드로 정하니 같은 날엔 늘 같다.
 */
import type { Weather } from './weather'
import { hashString, mulberry32 } from './rng'
import type { Season } from './season'
import { VIEWPOINT } from './viewpoint'

/** 하늘 평면 좌표 -1~1. 가로(u)는 방위 차이, 세로(v)는 높이 차이다. */
export type SkyPt = [number, number]

export interface Constellation {
  id: string
  season: Season
  name: string
  points: SkyPt[]
  /** 점 번호 쌍을 이은 선 */
  links: [number, number][]
}

export const CONSTELLATIONS: Constellation[] = [
  {
    id: 'spring-fence', season: 'spring', name: '도토리 울타리',
    points: [[-0.6, -0.2], [-0.3, -0.2], [0, -0.2], [0.3, -0.2], [0.6, -0.2], [-0.6, 0.3], [0.6, 0.3]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [4, 6]],
  },
  {
    id: 'spring-basket', season: 'spring', name: '벚꽃 바구니',
    points: [[-0.5, 0.2], [0, -0.4], [0.5, 0.2], [0, 0.5], [-0.2, 0]],
    links: [[0, 1], [1, 2], [2, 0], [0, 4], [4, 2], [3, 4]],
  },
  {
    id: 'spring-rod', season: 'spring', name: '작은 낚싯대',
    points: [[-0.6, 0.5], [-0.2, 0.1], [0.2, -0.3], [0.6, -0.6], [0.6, 0.2]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'summer-pelican', season: 'summer', name: '펠리컨 날개',
    points: [[-0.7, 0], [-0.3, 0.3], [0, 0.1], [0.3, 0.3], [0.7, 0]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'summer-lighthouse', season: 'summer', name: '등대 불빛',
    points: [[0, -0.6], [0, 0.1], [-0.3, 0.4], [0.3, 0.4], [0, 0.6]],
    links: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
  {
    id: 'summer-wave', season: 'summer', name: '파도 모자',
    points: [[-0.6, -0.1], [-0.3, -0.4], [0, -0.2], [0.3, -0.5], [0.6, -0.1]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'autumn-key', season: 'autumn', name: '단풍 열쇠',
    points: [[-0.4, -0.5], [-0.4, 0.1], [0, 0.5], [0.4, 0.1], [0.4, -0.5]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]],
  },
  {
    id: 'autumn-dragonfly', season: 'autumn', name: '고추잠자리',
    points: [[-0.6, 0], [-0.2, 0.3], [0.2, 0.3], [0.6, 0], [0, -0.4]],
    links: [[0, 1], [1, 2], [2, 3], [0, 4], [3, 4]],
  },
  {
    id: 'autumn-campfire', season: 'autumn', name: '모닥불 셋',
    points: [[-0.5, -0.4], [0, 0.4], [0.5, -0.4], [0, -0.1]],
    links: [[0, 3], [1, 3], [2, 3]],
  },
  {
    id: 'winter-snowmen', season: 'winter', name: '눈사람 셋',
    points: [[-0.5, -0.4], [-0.5, -0.05], [-0.5, 0.3], [0.5, -0.4], [0.5, 0.3]],
    links: [[0, 1], [1, 2], [3, 4]],
  },
  {
    id: 'winter-scarf', season: 'winter', name: '뜨개 목도리',
    points: [[-0.7, 0.2], [-0.3, -0.2], [0.1, 0.2], [0.5, -0.2], [0.8, 0.2]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'winter-sled', season: 'winter', name: '썰매 길',
    points: [[-0.6, -0.5], [-0.2, -0.1], [0.2, 0.2], [0.6, 0.5], [0.2, 0.5]],
    links: [[0, 1], [1, 2], [2, 3], [2, 4]],
  },
]

/** 망원경으로 볼 수 있는 시각: 저녁 8시부터 새벽 4시 전까지 */
export const SKY_FROM = 20
export const SKY_UNTIL = 4

/** 맑은 날(sunny)에 밤 시각일 때만 망원경이 열린다. 흐리거나 비 오면 별이 안 보인다. */
export function telescopeOpen(hour: number, weather: Weather): boolean {
  return weather === 'sunny' && (hour >= SKY_FROM || hour < SKY_UNTIL)
}

/** 그날 망원경에 보이는 별자리: 계절의 세 개 중 날짜 시드로 하나 */
export function constellationOf(day: string, season: Season): Constellation {
  const list = CONSTELLATIONS.filter((c) => c.season === season)
  const r = mulberry32(hashString(`star:${day}`))()
  return list[Math.floor(r * list.length)]
}

/** 처음 본 별자리인지. 이미 기록된 것은 다시 기록하지 않는다. */
export function isNewSighting(seen: readonly string[], id: string): boolean {
  return !seen.includes(id)
}

/** 열두 개를 모두 봤는지 */
export function starsComplete(seen: readonly string[]): boolean {
  return CONSTELLATIONS.every((c) => seen.includes(c.id))
}

/** 망원경 자리: 전망 벤치 옆(벤치 오른쪽). 벤치는 바다 쪽을 보고 있다. */
export const TELESCOPE = {
  x: VIEWPOINT.x + Math.cos(VIEWPOINT.rot) * 1.3,
  z: VIEWPOINT.z - Math.sin(VIEWPOINT.rot) * 1.3,
  rot: VIEWPOINT.rot,
}

/** 망원경에 다가갔는지 */
export function nearTelescope(x: number, z: number, reach = 1.6): boolean {
  return Math.hypot(x - TELESCOPE.x, z - TELESCOPE.z) < reach
}

/** 가로 펼침(라디안). 화면이 좁으면 `skyViewSpread` 가 줄여 준다. */
export const SKY_SPREAD = 0.45

/** 화면 가로세로비에 맞춘 펼침. 넓은 화면은 기본값, 휴대폰 세로 화면은 좁힌다. */
export function skyViewSpread(aspect: number): number {
  return SKY_SPREAD * Math.min(1, aspect / 1.6)
}

/**
 * 하늘 평면 점을 방향 벡터로. facing 은 플레이어가 보는 방향(sin, cos 기준)이다.
 * 망원경 카메라는 거의 수평으로 보므로 중심을 지평선 위 8도쯤에 두고, 화면 안에 들어오도록 폭을 좁힌다.
 */
export function skyDir(pt: SkyPt, facing: number, spread = SKY_SPREAD): [number, number, number] {
  const az = facing + pt[0] * spread
  const el = 0.14 + pt[1] * 0.16
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]
}

/** 저장된 '본 별자리' 목록을 믿을 수 있는 값으로 맞춘다. 배열이 아니거나 모르는 id 는 버리고, 중복도 뺀다. */
export function sanitizeStars(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const known = new Set(CONSTELLATIONS.map((c) => c.id))
  const out: string[] = []
  for (const id of raw) if (typeof id === 'string' && known.has(id) && !out.includes(id)) out.push(id)
  return out
}
