/**
 * 도토리 마일리지. 섬 생활 업적(통계 기준 단계)을 넘을 때마다 마일이 쌓이고,
 * 교환소에서 여행 티켓·주머니 확장·레시피 카드로 바꾼다.
 */

/** 마일 값을 문구로: 천 단위 콤마를 넣고 뒤에 '마일'을 붙인다. 모든 화면과 편지가 이 함수를 쓴다. */
export const formatMiles = (n: number): string => `${n.toLocaleString()}마일`

export interface Milestone {
  id: string
  title: string
  stat: string
  tiers: number[]
  miles: number[]
}

const t = (id: string, title: string, tiers: number[], miles = [100, 300, 800]): Milestone => ({ id, title, stat: id, tiers, miles })

export const MILESTONES: Milestone[] = [
  t('shake', '열매 수확꾼', [5, 25, 100]),
  t('chop', '나무꾼', [10, 50, 200]),
  t('rock', '광부', [10, 50, 200]),
  t('dig', '보물 사냥꾼', [3, 15, 50]),
  t('bug', '곤충 박사', [3, 15, 50]),
  t('fish', '낚시 명인', [3, 15, 50]),
  t('plant', '꽃 심는 사람', [3, 15, 40]),
  t('water', '물 주는 사람', [5, 30, 100]),
  t('talk', '수다쟁이', [5, 30, 100]),
  t('give', '부탁 해결사', [1, 10, 30], [150, 400, 1000]),
  t('craft', 'DIY 장인', [1, 10, 30], [150, 400, 1000]),
  t('build', '섬 건축가', [1, 3, 5], [500, 1000, 2000]),
  t('trip', '섬 여행가', [1, 5, 15], [200, 500, 1200]),
  t('recruit', '이웃 모시기', [1, 3, 8], [300, 800, 2000]),
  t('fish-fresh', '민물 낚시꾼', [1, 10, 30]),
  t('rustle', '덤불 탐험가', [5, 30, 100]),
  t('earn', '도토리 부자', [1000, 10000, 50000], [200, 600, 1500]),
]

export function tierReached(m: Milestone, stats: Record<string, number>): number {
  const v = stats[m.stat] ?? 0
  return m.tiers.filter((x) => v >= x).length
}

/** 새로 넘은 단계들의 마일 합과 갱신된 단계 기록 */
export function newMiles(stats: Record<string, number>, claimed: Record<string, number>) {
  let miles = 0
  const next = { ...claimed }
  const reached: { m: Milestone; tier: number }[] = []
  for (const m of MILESTONES) {
    const tier = tierReached(m, stats)
    for (let k = claimed[m.id] ?? 0; k < tier; k++) {
      miles += m.miles[k]
      reached.push({ m, tier: k + 1 })
    }
    next[m.id] = Math.max(tier, claimed[m.id] ?? 0)
  }
  return { miles, claimed: next, reached }
}

export interface MileReward {
  id: 'trip-ticket' | 'pocket' | 'recipe' | 'gold-acorn'
  name: string
  icon: string
  cost: number
  note: string
}

export const MILE_SHOP: MileReward[] = [
  { id: 'trip-ticket', name: '섬 여행 티켓', icon: '🎫', cost: 300, note: '부두의 펠리에게 주면 다른 섬으로 데려다줘요' },
  { id: 'recipe', name: '레시피 카드', icon: '📃', cost: 400, note: '아직 모르는 DIY 레시피를 하나 배워요' },
  { id: 'pocket', name: '주머니 넓히기', icon: '👜', cost: 1000, note: '주머니가 10칸 늘어나요 (최대 40칸)' },
  { id: 'gold-acorn', name: '황금 도토리상', icon: '🏆', cost: 3000, note: '섬에 놓는 반짝이는 기념상' },
]

export const POCKET_MAX = 40

/** 마일을 얻은 이유 한 조각. 짧은 사이에 쌓인 같은 이유는 횟수와 마일을 더해 한 줄로 보여 준다. */
export interface MileGain {
  /** 이유 이름. 예: 할 일, 집 꾸미기 점수 */
  name: string
  /** 쌓인 횟수 */
  count: number
  /** 횟수의 단위. 예: 개, 마리 */
  unit: string
  /** 이 이유로 받은 마일 */
  amount: number
}

/** 같은 이름의 이유는 횟수와 마일을 더하고, 새 이유는 뒤에 붙인다 */
export function addMileGain(gains: MileGain[], gain: MileGain): MileGain[] {
  const i = gains.findIndex((g) => g.name === gain.name)
  if (i < 0) return [...gains, gain]
  return gains.map((g, k) => (k === i ? { ...g, count: g.count + gain.count, amount: g.amount + gain.amount } : g))
}

/** 마일 토스트 한 줄. 예: 🏅 +30마일 · 물고기 3마리 · 집 꾸미기 점수 */
export function mileToastText(gains: MileGain[]): string {
  const total = gains.reduce((a, g) => a + g.amount, 0)
  const parts = gains.map((g) => (g.count > 1 ? `${g.name} ${g.count}${g.unit}` : g.name))
  return `🏅 +${formatMiles(total)} · ${parts.join(' · ')}`
}

