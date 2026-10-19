import { STORY_CHAPTERS } from './story'
import { josa } from './items'
import { DEX_MILESTONES, HOME_STAR_MAX, ISLAND_STAR_MAX, MILESTONE_KEY_RE, SHOP_DEPARTMENT_TIER } from './afterKeys'

export { DEX_MILESTONES, HOME_STAR_MAX, ISLAND_STAR_MAX, MILESTONE_KEY_RE, SHOP_DEPARTMENT_TIER }

/**
 * 섬 이야기 에필로그 이후의 다음 목표. 5장을 모두 마치면 목표 후보를 진행도로 골라 세 개를 보여 준다.
 * 후보는 집 별 등급, 도토리 백화점, 도감 종 수, 섬 별점이다. 이미 채운 후보는 빼고, 남은 비율이 큰(가까운) 순서로 고른다.
 * 순수 로직이라 React 에 의존하지 않는다. 진행 값은 호출하는 쪽이 지금 상태에서 넘긴다.
 */

/** 휴대폰 미션 맨 위에 보여 줄 목표 수 */
export const AFTER_GOAL_COUNT = 3

export interface AfterGoal {
  id: 'home-stars' | 'shop-tier' | 'dex' | 'island-stars'
  label: string
  current: number
  target: number
}

export interface AfterStoryInput {
  storyChapter: number
  /** 집 꾸미기 등급 별 번호(0~5) */
  homeStars: number
  /** 상점 단계(0~3) */
  shopTier: number
  /** 도감에 오른 종 수 */
  dexFound: number
  /** 섬 별점(0~5) */
  islandStars: number
}

/** 섬 이야기를 다 마쳤는지. 다 마친 뒤에만 다음 목표가 생긴다. */
export const afterStoryOpen = (storyChapter: number): boolean => storyChapter >= STORY_CHAPTERS.length

/** 채울 수 있는 다음 목표 후보 전부. 이미 채운 것은 뺀다. */
export function afterStoryCandidates(input: AfterStoryInput): AfterGoal[] {
  const out: AfterGoal[] = []
  if (input.homeStars < HOME_STAR_MAX) {
    const next = input.homeStars + 1
    out.push({ id: 'home-stars', label: `집 별 ${next}`, current: input.homeStars, target: next })
  }
  if (input.shopTier < SHOP_DEPARTMENT_TIER) out.push({ id: 'shop-tier', label: '백화점 열기', current: input.shopTier, target: SHOP_DEPARTMENT_TIER })
  const milestone = DEX_MILESTONES.find((m) => m > input.dexFound)
  if (milestone !== undefined) out.push({ id: 'dex', label: `도감 ${milestone}종`, current: input.dexFound, target: milestone })
  if (input.islandStars < ISLAND_STAR_MAX) out.push({ id: 'island-stars', label: `섬 별점 ${ISLAND_STAR_MAX}개`, current: input.islandStars, target: ISLAND_STAR_MAX })
  return out
}

/**
 * 에필로그 이후 보여 줄 가장 가까운 목표 세 개. 5장을 마치기 전이면 빈 배열이다.
 * 남은 비율(current/target)이 큰 순서로 고르고, 같으면 후보 순서를 따른다.
 */
export function nearestAfterGoals(input: AfterStoryInput): AfterGoal[] {
  if (!afterStoryOpen(input.storyChapter)) return []
  return afterStoryCandidates(input)
    .map((g, i) => ({ g, i, ratio: g.target > 0 ? g.current / g.target : 1 }))
    .sort((a, b) => b.ratio - a.ratio || a.i - b.i)
    .slice(0, AFTER_GOAL_COUNT)
    .map((x) => x.g)
}

/** 휴대폰 미션 맨 위 한 줄. 목표 진행을 괄호로 붙인다. 목표가 없으면 null. */
export function afterStoryLine(goals: readonly AfterGoal[]): string | null {
  if (goals.length === 0) return null
  return `다음 목표: ${goals.map((g) => `${g.label} (${g.current}/${g.target})`).join(' · ')}`
}

/** HUD 목표 줄: 다음 목표 첫 번째 하나만. 목표가 없으면 null. */
export function afterStoryHudLine(goals: readonly AfterGoal[]): string | null {
  const first = goals[0]
  return first ? `🎯 다음 목표: ${first.label} (${first.current}/${first.target})` : null
}

/** 목표를 채웠을 때 축하를 남기는 기준. 같은 목표는 한 번만 축하하도록 키를 저장한다. */
export const AFTER_CELEBRATED_KEEP = 20
export const WEEK_MILESTONE_KEEP = 4

/** 지금 값에서 채운 목표 키 전부. 키는 `home-stars:2`, `shop-tier:3`, `dex:50`, `island-stars:5` 꼴이다. */
export function reachedAfterKeys(p: AfterStoryInput): string[] {
  const keys: string[] = []
  for (let n = 1; n <= Math.min(p.homeStars, HOME_STAR_MAX); n++) keys.push(`home-stars:${n}`)
  if (p.shopTier >= SHOP_DEPARTMENT_TIER) keys.push(`shop-tier:${SHOP_DEPARTMENT_TIER}`)
  for (const m of DEX_MILESTONES) if (p.dexFound >= m) keys.push(`dex:${m}`)
  if (p.islandStars >= ISLAND_STAR_MAX) keys.push(`island-stars:${ISLAND_STAR_MAX}`)
  return keys
}

/** 목표 키의 이름. 축하 글과 주간 소식에 쓴다. */
export function milestoneLabel(key: string): string {
  const [kind, num] = key.split(':')
  if (kind === 'home-stars') return `집 별 ${num}`
  if (kind === 'shop-tier') return '백화점 열기'
  if (kind === 'dex') return `도감 ${num}종`
  return `섬 별점 ${num}개`
}

/**
 * 이번 변화로 새로 채운 목표 키. 이전에 이미 채웠거나 축하를 남긴 목표는 뺀다.
 * 섬 이야기를 마치기 전에는 없다. 예전 저장에서 이미 채운 목표는 처음 바뀔 때도 새로 채운 것이 아니다.
 */
export function newAfterMilestones(prev: AfterStoryInput, now: AfterStoryInput, celebrated: readonly string[]): string[] {
  if (!afterStoryOpen(now.storyChapter)) return []
  const before = new Set(reachedAfterKeys(prev))
  return reachedAfterKeys(now).filter((k) => !before.has(k) && !celebrated.includes(k))
}

/** 목표를 채운 순간의 축하 글. 다음 목표 하나를 함께 말한다. 다음 목표가 없으면 다 채웠다고 말한다. */
export function milestoneText(key: string, next: AfterGoal | null): string {
  const done = `🎯 ${milestoneLabel(key)} 목표를 채웠어요!`
  return next ? `${done} 다음 목표는 ${josa(next.label, '이에요', '예요')}` : `${done} 섬 이야기 이후 목표를 모두 채웠어요`
}

/** 주간 소식에 남기는 짧은 한 줄 */
export const milestoneWeekLine = (key: string): string => `🎯 ${milestoneLabel(key)} 목표를 채웠어요`

/** 저장된 축하 키를 읽는다. 목표 키 형식이 아니거나 중복인 값은 버린다. */
export function cleanAfterCelebrated(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((k): k is string => typeof k === 'string' && MILESTONE_KEY_RE.test(k)))].slice(-AFTER_CELEBRATED_KEEP)
}

/** 저장된 주간 소식 축하 줄을 읽는다. 너무 긴 줄과 넘치는 개수는 버린다. */
export function cleanWeekMilestones(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.length <= 120).slice(-WEEK_MILESTONE_KEEP)
}
