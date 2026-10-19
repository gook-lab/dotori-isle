import { decodePaths } from './paths'
import { RECIPES } from './recipes'
import { treeState, type Felled } from './trees'

/**
 * 섬 별점. 꾸밈·꽃·나무·정돈·이웃·상점·도감을 100점으로 나누고 별 1~5개로 보여 준다.
 * 순수 계산만 한다. 입력은 저장 상태에서 `ratingInputOf` 로 뽑는다.
 */

/** 점수 계산에 쓰는 숫자만 모은 입력 */
export interface RatingInput {
  /** 섬에 놓은 가구 수 */
  placed: number
  /** 섬에 놓은 가구 종류 수 */
  variety: number
  /** 심은 꽃 수 */
  planted: number
  /** 그중 물을 준 꽃 수 (planted 를 넘지 않는다) */
  watered: number
  /** 베지 않고 서 있는 나무 수 */
  standing: number
  /** 섬의 나무 전체 수 */
  totalTrees: number
  /** 메우지 않은 구멍 수 */
  holes: number
  /** 바닥에 떨어진 쓰레기(빈 깡통 등) 수 */
  litter: number
  /** 칠해 깐 길 타일 수. 정돈 점수에 상한까지 더해진다. */
  paths?: number
  /** 이사 온 주민 수 */
  houses: number
  /** 상점 단계 0~2 */
  shopTier: number
  /** 전시관 기증 수 */
  museum: number
}

/** 저장되는 별점 기록. day 는 마지막으로 매긴 월요일, rewarded 는 보상을 받은 최고 별 단계(0·3·5). */
export interface RatingState {
  day: string | null
  stars: number
  rewarded: number
  /** 처음 별점을 세기 시작한 날. 아직 편지가 한 번도 없으면 여기서 사흘째에 첫 편지를 보낸다. */
  since: string | null
}

/** 별 기준 점수. 이 점수에 닿으면 한 칸 오른다. 별 1개는 0점부터다. */
export const STAR_STEPS = [20, 40, 60, 80] as const

/** 길(칠한 타일) 정돈 보너스 상한. 길을 몇 칸 깔면 정돈 점수에 조금 더해진다. */
export const PATH_BONUS_CAP = 5

/** 별 점수 항목. 합이 100점이다. */
export interface RatingParts {
  decor: number
  flowers: number
  trees: number
  tidy: number
  neighbours: number
  shop: number
  museum: number
}

/** 항목별 점수. 각 항목은 상한이 있어서 한 가지만 몰아서 채울 수 없다. */
export function ratingParts(i: RatingInput): RatingParts {
  const ratio = i.totalTrees > 0 ? i.standing / i.totalTrees : 0
  // 나무가 70% 아래로 줄면 벤 만큼 한 번 더 깎는다(과벌목 벌점)
  const overFelled = ratio < 0.7 ? Math.round((0.7 - ratio) * 20) : 0
  return {
    decor: Math.min(12, i.placed * 2) + Math.min(8, i.variety * 2),
    flowers: Math.min(10, i.planted) + Math.min(5, i.watered),
    trees: Math.max(0, Math.round(15 * ratio) - overFelled),
    tidy: Math.max(0, 10 - Math.min(10, i.holes * 2 + i.litter * 2)) + Math.min(PATH_BONUS_CAP, Math.floor((i.paths ?? 0) / 3)),
    neighbours: Math.min(25, i.houses * 5),
    shop: Math.min(10, i.shopTier * 5),
    museum: Math.min(5, i.museum),
  }
}

export function islandScore(i: RatingInput): number {
  const p = ratingParts(i)
  return Math.min(100, Object.values(p).reduce((a, b) => a + b, 0))
}

/** 점수를 별 개수(1~5)로 바꾼다 */
export function starsOf(score: number): number {
  return 1 + STAR_STEPS.filter((t) => score >= t).length
}

/** 섬 별점. 점수와 별 개수를 함께 준다. */
export function islandRating(i: RatingInput): { score: number; stars: number } {
  const score = islandScore(i)
  return { score, stars: starsOf(score) }
}

interface TipCandidate {
  /** 최대 몇 단위까지 시도할지 */
  max: number
  apply: (i: RatingInput) => RatingInput
  /** 조건 문장 앞부분. 예: "꽃을 3송이 더 심으면" */
  say: (k: number) => string
}

/** 조언 후보. 한 단위씩 더했을 때 별이 오르는 최소 단위를 찾는다. */
const TIPS: TipCandidate[] = [
  { max: 10, apply: (i) => ({ ...i, planted: i.planted + 1 }), say: (k) => `꽃을 ${k}송이 더 심으면` },
  { max: 10, apply: (i) => (i.watered < i.planted ? { ...i, watered: i.watered + 1 } : i), say: (k) => `심은 꽃 ${k}송이에 물을 주면` },
  // 새 가구는 종류도 하나 늘린다고 본다(꾸밈은 개수와 종류를 함께 센다)
  { max: 10, apply: (i) => ({ ...i, placed: i.placed + 1, variety: i.variety + 1 }), say: (k) => `가구를 ${k}개 더 놓으면` },
  { max: 60, apply: (i) => ({ ...i, holes: Math.max(0, i.holes - 1) }), say: (k) => `구멍 ${k}개를 메우면` },
  { max: 20, apply: (i) => ({ ...i, litter: Math.max(0, i.litter - 1) }), say: (k) => `떨어진 쓰레기 ${k}개를 치우면` },
  { max: 10, apply: (i) => ({ ...i, standing: Math.min(i.totalTrees, i.standing + 1) }), say: (k) => `나무를 ${k}그루 덜 베면` },
  { max: 1, apply: (i) => ({ ...i, houses: i.houses + 1 }), say: () => '이웃이 한 명 더 이사 오면' },
  { max: 1, apply: (i) => ({ ...i, shopTier: Math.min(2, i.shopTier + 1) }), say: () => '상점을 한 단계 키우면' },
]

/**
 * 가장 적은 노력으로 다음 별을 채울 조언 한 가지. 이미 별 다섯 개면 null.
 * 한 가지만으로 별이 안 오르면, 점수를 가장 많이 올리는 한 가지를 골라 남은 점수를 함께 알려 준다.
 * 같은 노력이면 목록 앞쪽 항목을 고른다.
 */
export function ratingTip(i: RatingInput): { text: string; units: number } | null {
  const score = islandScore(i)
  const now = starsOf(score)
  if (now >= 5) return null
  let best: { text: string; units: number } | null = null
  for (const c of TIPS) {
    let cur = i
    for (let k = 1; k <= c.max; k++) {
      cur = c.apply(cur)
      if (starsOf(islandScore(cur)) > now) {
        if (!best || k < best.units) best = { text: `${c.say(k)} 별이 하나 늘어요`, units: k }
        break
      }
    }
  }
  if (best) return best
  // 한 가지로는 못 채운다. 점수를 가장 많이 올리는 후보를 고른다.
  const target = STAR_STEPS.find((t) => t > score) ?? 100
  let pick: { gain: number; text: string; units: number } | null = null
  for (const c of TIPS) {
    // 실제로 점수가 변하는 만큼만 센다(구멍이나 쓰레기가 없으면 0)
    let cur = i
    let k = 0
    for (let n = 1; n <= c.max; n++) {
      const next = c.apply(cur)
      if (islandScore(next) === islandScore(cur)) break
      cur = next
      k = n
    }
    const gain = islandScore(cur) - score
    if (gain > 0 && (!pick || gain > pick.gain)) {
      pick = { gain, text: `${c.say(k)} 점수가 ${gain}점 올라요. 별 하나까지 ${target - score}점 남았어요`, units: k }
    }
  }
  return pick ? { text: pick.text, units: pick.units } : { text: '섬 곳곳을 조금씩 더 가꿔 보세요', units: 0 }
}

/** 한 번 받은 별 보상은 다시 주지 않는다. 3★ 에 DIY 레시피, 5★ 에 황금 물뿌리개. */
export type RatingReward = 'recipe' | 'golden-can'

export function ratingRewards(stars: number, rewarded: number): RatingReward[] {
  const out: RatingReward[] = []
  if (stars >= 3 && rewarded < 3) out.push('recipe')
  if (stars >= 5 && rewarded < 5) out.push('golden-can')
  return out
}

/** 보상을 준 뒤 기록할 최고 별 단계 */
export function nextRewarded(stars: number, rewarded: number): number {
  if (stars >= 5) return 5
  if (stars >= 3) return Math.max(rewarded, 3)
  return rewarded
}

/** 날짜 키가 속한 주의 월요일 키. 일요일은 앞 주 월요일로 본다. */
export function mondayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d)
  const offset = (new Date(t).getUTCDay() + 6) % 7
  return new Date(t - offset * 86400000).toISOString().slice(0, 10)
}

/** 아직 모르는 DIY 레시피 중 목록 순서대로 하나. 다 알면 null. */
export function firstNewRecipe(known: readonly string[]): string | null {
  return RECIPES.find((r) => !known.includes(r.id))?.id ?? null
}

/** 저장 상태에서 점수 입력을 뽑는다. 나무 목록은 world.ts 의 TREES 를 받는다. */
export function ratingInputOf(
  s: {
    placed: { itemId: string }[]
    plants: { watered: boolean }[]
    holes: unknown[]
    ground: { itemId: string }[]
    houses: string[]
    shop: { tier: number }
    museum: string[]
    felled: Felled
    day: string
    infra?: { paths: string }
  },
  trees: readonly { id: string }[],
  isJunk: (itemId: string) => boolean,
): RatingInput {
  const planted = s.plants.length
  return {
    paths: decodePaths(s.infra?.paths).length,
    placed: s.placed.length,
    variety: new Set(s.placed.map((p) => p.itemId)).size,
    planted,
    watered: Math.min(planted, s.plants.filter((p) => p.watered).length),
    standing: trees.filter((t) => treeState(t.id, s.felled, s.day) === 'tree').length,
    totalTrees: trees.length,
    holes: s.holes.length,
    litter: s.ground.filter((g) => isJunk(g.itemId)).length,
    houses: s.houses.length,
    shopTier: s.shop.tier,
    museum: s.museum.length,
  }
}
