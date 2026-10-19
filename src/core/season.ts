import { devParam } from './devParam'
/** 계절은 날짜 키(YYYY-MM-DD)의 달로 정한다. 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울. */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonInfo {
  icon: string
  label: string
  /** 잔디 위·아래 색 */
  grass: [string, string]
  /** 활엽수 잎 네 덩이 색 */
  leaves: [string, string, string, string]
  /** 침엽수 세 단 색 */
  pine: [string, string, string]
  /** 바닥 꽃 색 */
  flowers: string[]
}

export const SEASON_INFO: Record<Season, SeasonInfo> = {
  spring: {
    icon: '🌸',
    label: '봄',
    grass: ['#8fd16a', '#79c05a'],
    leaves: ['#ffc4d6', '#ffd6e2', '#ffb3c8', '#ffe0ea'],
    pine: ['#3f9b62', '#4aa96b', '#57b878'],
    flowers: ['#ff8fa3', '#ffe066', '#ffffff', '#ffb3c1', '#b8c0ff'],
  },
  summer: {
    icon: '🌻',
    label: '여름',
    grass: ['#7cc85a', '#68b44a'],
    leaves: ['#6cc26a', '#79cc72', '#5fb75e', '#80d379'],
    pine: ['#3f9b62', '#4aa96b', '#57b878'],
    flowers: ['#ffe066', '#ff8fa3', '#ffffff', '#b8c0ff'],
  },
  autumn: {
    icon: '🍁',
    label: '가을',
    grass: ['#c2a35f', '#ad8f4f'],
    leaves: ['#f29b4b', '#f7b955', '#e8673e', '#f5c86a'],
    pine: ['#3d8a5a', '#47975f', '#53a46c'],
    flowers: ['#f7b955', '#e8673e', '#ffffff', '#c58fd9'],
  },
  winter: {
    icon: '⛄',
    label: '겨울',
    grass: ['#eef3f6', '#dfe8ee'],
    leaves: ['#f4f8fb', '#e8f0f5', '#ffffff', '#eef4f8'],
    pine: ['#3b7d5a', '#438a62', '#4f976d'],
    flowers: ['#ffffff', '#d9e6f2'],
  },
}

/** `?season=winter` 처럼 쿼리로 계절을 고정해 확인할 수 있다. */
function readOverride(): Season | null {
  if (typeof window === 'undefined') return null
  const raw = devParam('season')
  return raw === 'spring' || raw === 'summer' || raw === 'autumn' || raw === 'winter' ? raw : null
}

const override = readOverride()

export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function seasonFor(day: string): Season {
  return override ?? seasonOfMonth(Number(day.slice(5, 7)))
}

/** 가을 색 진행: 9월 초록 → 10월 중순 황토 → 11월 가장 갈색. 0(초록) ~ 1(갈색)을 날짜로 보간한다. */
export function autumnTone(day: string): number {
  const m = Number(day.slice(5, 7))
  const d = Number(day.slice(8, 10))
  // 9월 1일 = 0, 11월 말 ≈ 3
  const f = Math.min(3, Math.max(0, m - 9 + (d - 1) / 30))
  const pts: [number, number][] = [[0, 0], [1, 0.1], [1.5, 0.5], [2, 0.8], [3, 1]]
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    if (f <= x1) {
      const [x0, y0] = pts[i - 1]
      return y0 + ((f - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return 1
}

/** 땅·절벽·덤불 바닥 색 묶음. 가을은 날짜에 따라 달라진다. */
export type SeasonPalette = { grass: [string, string]; tuft: string; lip: string; foot: string; skirt: string }

const hexMix = (a: string, b: string, t: number): string => {
  const part = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const ch = (i: number) => Math.round(part(a, i) + (part(b, i) - part(a, i)) * t).toString(16).padStart(2, '0')
  return `#${ch(0)}${ch(1)}${ch(2)}`
}

const TUFT_BY_SEASON: Record<Season, string> = { spring: '#6cc26a', summer: '#5fb75e', autumn: '#b49a55', winter: '#cfdde6' }

export function paletteFor(season: Season, day: string): SeasonPalette {
  if (season === 'autumn') {
    const t = autumnTone(day)
    return {
      grass: [hexMix('#b5c46a', '#b89658', t), hexMix('#a3b05a', '#9e7f49', t)],
      tuft: hexMix('#8fb35a', '#b49a55', t),
      lip: hexMix('#86cc6e', '#b9975c', t),
      foot: hexMix('#7cc576', '#9d7f4c', t),
      skirt: '#6d6a3e',
    }
  }
  if (season === 'winter') {
    return { grass: SEASON_INFO.winter.grass, tuft: TUFT_BY_SEASON.winter, lip: '#f3f7fa', foot: '#f3f7fa', skirt: '#9aa6ad' }
  }
  return { grass: SEASON_INFO[season].grass, tuft: TUFT_BY_SEASON[season], lip: '#86cc6e', foot: '#7cc576', skirt: '#6d6a3e' }
}
