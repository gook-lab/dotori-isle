/**
 * 집 꾸미기 점수: 매주 월요일 아침 편지로 온다. 가구 수, 종류 수, 벽·방 가운데 배치, 같은 색과 같은 시리즈 세트,
 * 불빛 가구, 사진 액자로 100점 만점을 매긴다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { homeCells, type HomeStage } from './home'
import type { HomeFloor } from './interior'
import { GLOWING, josa } from './items'
import { dayIndex } from './economy'
import type { Letter } from './letters'
import type { WallDir } from './placement'

/** 시리즈 세트: 세 가지를 다 놓으면 보너스. 색 변형과 상관없이 같은 가구 id 로 본다. */
export interface HomeSet {
  id: string
  name: string
  items: readonly string[]
}

export const HOME_SETS: readonly HomeSet[] = [
  { id: 'tea', name: '티타임', items: ['table', 'chair', 'flowerpot'] },
  { id: 'cabin', name: '통나무 오두막', items: ['log-stool', 'log-bench', 'wooden-box'] },
  { id: 'festival', name: '축제 홀', items: ['blossom-arch', 'paper-lantern', 'harvest-scarecrow'] },
  { id: 'winter', name: '겨울 방', items: ['snowman', 'ice-sculpture', 'stove'] },
  { id: 'study', name: '서재', items: ['bookshelf', 'reading-chair', 'floor-lamp', 'globe'] },
  { id: 'workshop', name: '지하 작업실', items: ['workbench', 'tool-rack', 'storage-shelf', 'boiler'] },
]

/** 세트 하나를 완성하면 집 점수 세트 칸에 더해지는 점수 */
export const SET_POINT = 8

/** 세트를 처음 완성할 때 한 번 주는 도토리 마일리지(세트마다 한 번, 다시 맞춰도 또 주지 않는다) */
export const SET_MILES = 5

/** 세트 진행: 세트마다 몇 개를 놓았는지. 여러 층에 흩어 놓아도 센다. 모자란 가구 id 도 준다. */
export interface SetProgress {
  id: string
  name: string
  owned: number
  total: number
  done: boolean
  missing: string[]
}

export function setProgress(furniture: readonly { itemId: string }[]): SetProgress[] {
  const owned = new Set(furniture.map((f) => f.itemId))
  return HOME_SETS.map((set) => {
    const have = set.items.filter((id) => owned.has(id)).length
    return { id: set.id, name: set.name, owned: have, total: set.items.length, done: have === set.items.length, missing: set.items.filter((id) => !owned.has(id)) }
  })
}

/** 지금 완성된 세트 id 목록 */
export function completedSetIds(furniture: readonly { itemId: string }[]): string[] {
  return setProgress(furniture).filter((p) => p.done).map((p) => p.id)
}

/** 방금 완성되어 아직 알리지 않은 세트 id 목록(알린 목록 prev 에 없는 것) */
export function newlyCompletedSets(prev: readonly string[], furniture: readonly { itemId: string }[]): string[] {
  return completedSetIds(furniture).filter((id) => !prev.includes(id))
}

/** 한정 가구: 최고 구간 보상으로만 받는다 */
export const LIMITED_ITEM = 'house-plaque'

/** 같은 색 보너스에 필요한 가구 수 */
const SAME_COLOR_MIN = 3

/** 같은 색 가구가 세 개 이상 있는지 */
function sameColorOf(furniture: readonly { variant?: string }[]): boolean {
  const colorCounts = new Map<string, number>()
  for (const f of furniture) if (f.variant) colorCounts.set(f.variant, (colorCounts.get(f.variant) ?? 0) + 1)
  return [...colorCounts.values()].some((n) => n >= SAME_COLOR_MIN)
}

/** 세트 칸 점수: 완성 세트 수 × 세트 점수 + 같은 색 보너스, 칸 상한(HOME_MAX.sets)까지 */
function setPartOf(doneCount: number, sameColor: boolean): number {
  return Math.min(HOME_MAX.sets, doneCount * SET_POINT + (sameColor ? 4 : 0))
}

/**
 * 이 세트를 완성하면 세트 칸이 실제로 오를 점수. 이미 완성했거나 칸 상한에 막히면 0이다.
 * 세트 안 가구의 색은 모르므로 같은 색 보너스는 지금 가구 기준으로만 본다.
 */
export function setGainIfDone(furniture: readonly { itemId: string; variant?: string }[], setId: string): number {
  const owned = new Set(furniture.map((f) => f.itemId))
  const doneCount = HOME_SETS.filter((set) => set.items.every((id) => owned.has(id))).length
  if (completedSetIds(furniture).includes(setId)) return 0
  const sameColor = sameColorOf(furniture)
  return setPartOf(doneCount + 1, sameColor) - setPartOf(doneCount, sameColor)
}

export interface HomeFurnitureInput {
  itemId: string
  x: number
  z: number
  /** 놓인 자리(본채 0, 다락 1, 옆방 2, 지하실 3). 없으면 본채다. 벽 판정은 그 자리의 칸으로 한다. */
  floor?: HomeFloor
  variant?: string
  off?: boolean
  /** 벽에 건 가구의 벽 면(core/wallHang.ts). 벽에 건 사진 액자만 사진 점수에 든다. */
  wall?: WallDir
}

/** 사진 점수: 벽에 건 사진(마이 앨범) 또는 벽에 건 사진 액자 가구 중 하나가 있으면 참이다. 바닥에 둔 액자는 든다고 치지 않는다. */
export function frameHung(wallPhoto: boolean, furniture: readonly { itemId: string; wall?: WallDir }[]): boolean {
  return wallPhoto || furniture.some((f) => !!f.wall && (f.itemId === 'photo-frame' || f.itemId === 'story-photo-frame'))
}

/** 바닥에 둔 사진 액자(예전 방식)는 사진 점수의 절반만 준다. 벽에 걸면 온점을 받는다. */
export function frameFloor(wallPhoto: boolean, furniture: readonly { itemId: string; wall?: WallDir }[]): boolean {
  return !frameHung(wallPhoto, furniture) && furniture.some((f) => f.itemId === 'photo-frame' || f.itemId === 'story-photo-frame')
}

export interface HomeScoreInput {
  stage: HomeStage
  furniture: readonly HomeFurnitureInput[]
  /** 벽에 사진 액자(마이 앨범의 벽 사진)를 걸었는지 */
  framed: boolean
  /** 바닥에 둔 사진 액자만 있는지(있으면 사진 점수의 절반) */
  framedFloor?: boolean
  /** 집 둘레 정원: 이어진 울타리 수와 바닥 칸 수(core/gardenTiles.ts gardenStats). 없으면 0으로 본다. */
  garden?: GardenInput
}

export interface GardenInput {
  fenceLinks: number
  tiles: number
}

export interface HomeScore {
  total: number
  parts: { count: number; variety: number; placement: number; sets: number; light: number; frame: number; garden: number }
  count: number
  kinds: number
  wall: number
  interior: number
  /** 다 채운 세트 id */
  doneSets: string[]
  /** 세트마다 놓은 가구 수(세트 id → 개수) */
  setOwned: Record<string, number>
  sameColor: boolean
  lit: boolean
  framed: boolean
  framedFloor: boolean
  garden: GardenInput
}

/** 부분 점수의 최대치. 합하면 100 이다. */
export const HOME_MAX = { count: 24, variety: 11, placement: 15, sets: 20, light: 10, frame: 10, garden: 10 } as const

/** 벽에 붙은 칸은 방 바닥 칸 가장자리에 있는 칸이다(바깥쪽 이웃이 방 밖) */
function isWallCell(x: number, z: number, cells: Set<string>): boolean {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !cells.has(`${x + dx},${z + dz}`))
}

/** 집 꾸미기 점수를 매긴다. */
export function scoreHome(input: HomeScoreInput): HomeScore {
  // 자리마다 칸이 따로라 벽 판정도 가구가 놓인 자리의 칸으로 한다(옆방 가구가 본채 벽으로 잘못 세지 않게)
  const cellSets = new Map<HomeFloor, Set<string>>()
  const cellsOf = (floor: HomeFloor) => {
    let set = cellSets.get(floor)
    if (!set) cellSets.set(floor, (set = new Set(homeCells(input.stage, floor).map((c) => `${c.x},${c.z}`))))
    return set
  }
  const furniture = input.furniture
  const count = furniture.length
  const kinds = new Set(furniture.map((f) => f.itemId)).size
  const wall = furniture.filter((f) => isWallCell(f.x, f.z, cellsOf(f.floor ?? 0))).length
  const interior = count - wall
  const owned = new Set(furniture.map((f) => f.itemId))
  const doneSets = HOME_SETS.filter((set) => set.items.every((id) => owned.has(id))).map((set) => set.id)
  const sameColor = sameColorOf(furniture)
  const lit = furniture.some((f) => GLOWING.has(f.itemId) && !f.off)

  const parts = {
    count: Math.min(HOME_MAX.count, count * 3),
    variety: Math.min(HOME_MAX.variety, kinds * 3),
    placement: (wall > 0 ? 5 : 0) + (interior > 0 ? 5 : 0) + (Math.min(wall, interior) >= 2 ? 5 : 0),
    sets: setPartOf(doneSets.length, sameColor),
    light: lit ? HOME_MAX.light : 0,
    frame: input.framed ? HOME_MAX.frame : input.framedFloor ? HOME_MAX.frame / 2 : 0,
    garden: gardenPoints(input.garden),
  }
  const total = Math.min(100, Object.values(parts).reduce((a, b) => a + b, 0))
  const setOwned = Object.fromEntries(HOME_SETS.map((set) => [set.id, set.items.filter((id) => owned.has(id)).length]))
  return { total, parts, count, kinds, wall, interior, doneSets, setOwned, sameColor, lit, framed: input.framed, framedFloor: !input.framed && !!input.framedFloor, garden: input.garden ?? { fenceLinks: 0, tiles: 0 } }
}

/** 정원 점수: 울타리 이음 최대 6점, 바닥 칸 세 칸마다 1점(최대 4점) */
export function gardenPoints(g: GardenInput | undefined): number {
  if (!g) return 0
  return Math.min(HOME_MAX.garden, Math.min(6, g.fenceLinks) + Math.min(4, Math.floor(g.tiles / 3)))
}

/** 구간별 칭찬과 보상. 보상은 도토리·마일리지, 최고 구간에는 한정 가구를 얹는다. */
export interface HomeTier {
  min: number
  name: string
  praise: string
  reward: { acorns?: number; miles?: number; item?: string }
}

export const HOME_TIERS: readonly HomeTier[] = [
  { min: 20, name: '작은 보금자리', praise: '방이 한결 따뜻해졌어요. 가구를 조금 더 들여 볼까요?', reward: { acorns: 60 } },
  { min: 40, name: '살기 좋은 집', praise: '가구가 늘어서 집이 편해 보여요. 이웃들도 좋아해요.', reward: { acorns: 150 } },
  { min: 60, name: '센스 있는 방', praise: '색을 맞춘 센스가 좋아요. 방 전체가 하나로 보여요.', reward: { miles: 20 } },
  { min: 80, name: '이웃이 구경 오는 집', praise: '배치가 균형 잡혔어요. 지나가는 주민들이 자꾸 들여다봐요.', reward: { acorns: 300, miles: 50 } },
  { min: 100, name: '완벽한 우리 집', praise: '흠잡을 데가 없는 집이에요! 이 현판을 문에 걸어 두세요.', reward: { miles: 100, item: LIMITED_ITEM } },
]

/** 점수가 닿은 가장 높은 구간. 20점 아래면 null. */
export function tierOf(total: number): HomeTier | null {
  return [...HOME_TIERS].reverse().find((t) => total >= t.min) ?? null
}

/** 다음 구간. 100점이면 null. */
export function nextTier(total: number): HomeTier | null {
  return HOME_TIERS.find((t) => t.min > total) ?? null
}

/** 보상 한 줄: 편지와 미리 보기에서 같이 쓴다 */
export function rewardText(reward: HomeTier['reward']): string {
  const parts: string[] = []
  if (reward.acorns) parts.push(`도토리 ${reward.acorns.toLocaleString()}개`)
  if (reward.miles) parts.push(`${reward.miles.toLocaleString()}마일`)
  if (reward.item) parts.push('한정 가구 현판')
  return parts.join(', ')
}

/** 꾸미기 팁 두 가지. 점수를 가장 많이 올릴 수 있는 것부터 고른다. */
export function homeTips(score: HomeScore): string[] {
  const tips: { gap: number; text: string }[] = []
  const countGap = HOME_MAX.count - score.parts.count
  if (countGap > 0) tips.push({ gap: countGap, text: `가구를 더 들여 보세요. 지금 ${score.count}개예요` })
  const varietyGap = HOME_MAX.variety - score.parts.variety
  if (varietyGap > 0) tips.push({ gap: varietyGap, text: `다른 종류의 가구를 더 놓아 보세요. 지금 ${score.kinds}종이에요` })
  if (score.wall === 0 || score.interior === 0) tips.push({ gap: 5, text: '벽에 붙는 가구와 방 가운데 가구를 함께 놓아 보세요' })
  else if (Math.min(score.wall, score.interior) < 2) tips.push({ gap: 5, text: '벽쪽과 가운데에 가구를 두 개 이상씩 놓아 보세요' })
  // 가장 많이 채운 세트부터 알려 준다(세 가지 중 몇 개 놓았는지)
  const undone = HOME_SETS.filter((set) => !score.doneSets.includes(set.id)).sort((a, b) => score.setOwned[b.id] - score.setOwned[a.id])
  if (undone.length) {
    const best = undone[0]
    tips.push({ gap: 8, text: `${best.name} 세트를 맞춰 보세요. 지금 ${score.setOwned[best.id]}/${best.items.length}개예요` })
  }
  if (!score.sameColor) tips.push({ gap: 4, text: '같은 색 가구를 세 개 이상 맞춰 보세요. 리폼 코너에서 색을 바꿔요' })
  if (!score.lit) tips.push({ gap: HOME_MAX.light, text: '등불이나 램프를 켜 보세요. 불빛이 방을 따뜻하게 해요' })
  if (!score.framed) tips.push(score.framedFloor ? { gap: HOME_MAX.frame / 2, text: '바닥의 액자를 벽에 걸면 사진 점수를 다 받아요' } : { gap: HOME_MAX.frame, text: '벽에 사진 액자를 걸어 보세요' })
  if (score.parts.garden < HOME_MAX.garden) tips.push({ gap: HOME_MAX.garden - score.parts.garden, text: '집 둘레에 울타리를 잇거나 바닥을 깔아 보세요. 정원 꾸미기 허가가 필요해요' })
  return tips.sort((a, b) => b.gap - a.gap).slice(0, 2).map((t) => t.text)
}

/** 등급 별 번호(1~5). 20점 아래는 별이 없어 0이다. 구간 순서가 곧 별 번호다. */
export function starsOf(total: number): number {
  const t = tierOf(total)
  return t ? HOME_TIERS.indexOf(t) + 1 : 0
}

/** 처음 오른 등급에 주는 기념품(편지 선물). 등급마다 한 번이고, 이 게임에만 있는 별 모양 가구다. 최고 구간의 한정 현판은 따로 매주 온다. */
export const STAR_GIFTS: Readonly<Record<number, string>> = { 1: 'star-sprout', 2: 'star-cushion', 3: 'star-bell', 4: 'star-stand', 5: 'star-trophy' }

/** 이번 별 등급의 기념품. 이미 준 등급이면 null이다. */
export function starGiftFor(stars: number, given: readonly number[]): string | null {
  if (stars < 1 || given.includes(stars)) return null
  return STAR_GIFTS[stars] ?? null
}

const STRENGTH: Readonly<Record<keyof typeof HOME_MAX, string>> = {
  count: '가구가 많아 집이 가득 차 보여요',
  variety: '가구 종류가 다양해요',
  placement: '벽쪽과 가운데 배치가 좋아요',
  sets: '세트를 맞춘 솜씨가 좋아요',
  light: '불빛이 방을 따뜻하게 해요',
  frame: '사진 액자로 추억을 걸어 두었어요',
  garden: '정원까지 잘 가꿨어요',
}

/** 별 진행: 지금 별과 다음 별까지 남은 점수, 다음 별 구간 안에서 간 비율(0~1). 최고 등급이면 next 는 null. */
export function starProgress(total: number): { stars: number; next: HomeTier | null; left: number; ratio: number } {
  const stars = starsOf(total)
  const next = nextTier(total)
  if (!next) return { stars, next: null, left: 0, ratio: 1 }
  const from = stars ? HOME_TIERS[stars - 1].min : 0
  return { stars, next, left: next.min - total, ratio: Math.min(1, (total - from) / (next.min - from)) }
}

/** 다음 별까지 한 줄. 편지와 점수 창이 같이 쓴다. 최고 등급이면 null. */
export function nextStarLine(total: number): string | null {
  const p = starProgress(total)
  return p.next ? `다음 별(${p.next.name})까지 ${p.left}점 남았어요` : null
}

/** 집 상담에 쓰는 점수 한 줄: 지금 점수와 별, 다음 별까지 남은 점수. 휴대폰 점수 창과 같은 계산을 따른다. */
/**
 * 지금 집에 이 가구를 더 놓으면 집 꾸미기 점수가 얼마나 오르는지(정수). 놓기 전에 안내하는 용도다.
 * 같은 입력으로 점수를 두 번 매긴 차이라서, 입력에 없는 것(벽 사진 등)은 base 에 넣은 대로만 본다. 음수가 나올 수 있다.
 */
export function scoreGainOf(base: HomeScoreInput, add: HomeFurnitureInput): number {
  const before = scoreHome(base).total
  const after = scoreHome({ ...base, furniture: [...base.furniture, add] }).total
  return after - before
}

export function scoreSummaryLine(total: number): string {
  const stars = starsOf(total)
  const head = `집 꾸미기 ${total}점${stars ? ` · 별 ${stars}개` : ''}`
  return `${head} · ${nextStarLine(total) ?? '최고 등급이에요'}`
}

/** 이번 주 팁 한 줄. 편지와 점수 창이 같은 함수를 쓴다. 점수를 가장 많이 올릴 팁을 고른다. */
export function weeklyTip(score: HomeScore): string {
  return homeTips(score)[0] ?? '지금 집이 좋아요. 가구를 계속 더해 보세요'
}

/** 잘한 점 한 줄: 최대치에 가장 가깝게 채운 부분. 아무것도 못 채웠으면 그렇게 말한다. */
export function strengthLine(score: HomeScore): string {
  const keys = Object.keys(HOME_MAX) as (keyof typeof HOME_MAX)[]
  const ratio = (k: keyof typeof HOME_MAX) => score.parts[k] / HOME_MAX[k]
  const best = keys.reduce((a, b) => (ratio(b) > ratio(a) ? b : a))
  return ratio(best) > 0 ? STRENGTH[best] : '아직 두드러진 점은 없어요'
}

/**
 * 섬이 시작한 날이 채점하는 지난주 안에 있으면 "지난주" 기록이 없는 첫 주다.
 * 저장에 islandStart 가 없으면(예전 저장) 지난주가 있었다고 본다.
 */
export function firstScoreWeek(islandStart: string | null, day: string): boolean {
  if (!islandStart) return false
  const d = dayIndex(day)
  const s = dayIndex(islandStart)
  return d !== null && s !== null && d - s < 7
}

/** 월요일 평가 편지. 지난주 집 점수, 별 등급, 잘한 점, 다음 등급까지 팁 한 줄을 적는다.
 * 보상(도토리·마일리지)은 store 가 편지와 같이 준다. 선물은 처음 오른 등급의 기념 가구,
 * 그 밖에는 최고 구간의 한정 현판이다. given 은 기념 가구를 이미 받은 등급 목록이다.
 * first 가 참이면 지난주 기록이 없으니 "이번 주 집 점수는"으로 쓴다(주간 규칙은 그대로다). */
export function homeScoreLetter(score: HomeScore, day: string, given: readonly number[] = [], first = false): Letter {
  const tier = tierOf(score.total)
  const progress = starProgress(score.total)
  const stars = progress.stars
  const grade = tier ? `별 ${stars}개 ${tier.name}` : '아직 별이 없어요'
  const nextText = nextStarLine(score.total) ?? '최고 등급이에요'
  const tip = weeklyTip(score)
  const praise = tier ? tier.praise : '아직 시작이에요.'
  const reward = tier ? ` 보상은 ${josa(rewardText(tier.reward), '이에요', '예요')}.` : ''
  const starGift = starGiftFor(stars, given)
  const giftText = starGift ? ` 처음 오른 ${tier?.name} 등급 기념으로 가구 하나를 선물로 붙였어요.` : ''
  return {
    id: `home-score-${day}`,
    from: 'committee',
    fromName: '섬 꾸미기 위원회',
    day,
    text: `${first ? '이번 주' : '지난주'} 집 점수는 ${score.total}점, ${tier ? josa(grade, '이에요', '예요') : '아직 별이 없어요'}. ${praise}${reward}${giftText} 잘한 점: ${strengthLine(score)}. ${nextText}. 팁: ${tip}`,
    gift: starGift ?? tier?.reward.item ?? null,
    read: false,
    claimed: false,
  }
}
