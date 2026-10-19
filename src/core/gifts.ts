/**
 * 선물 주기. 주민마다 좋아하는 물건 종류가 있고, 그 종류를 주면 크게 기뻐한다.
 *
 * 종류: 주머니 물건의 `ItemKind` 를 그대로 쓰되 씨앗은 꽃으로 묶는다.
 * 취향은 주민 id 로 정한다. 제일 좋아하는 종류(love), 그다음 좋아하는 종류(like), 나머지(neutral),
 * 빈 깡통 같은 쓰레기(dislike). 생일에는 같은 물건도 더 크게 반응한다.
 * 하루에 한 주민에게 한 번만 준다(`canGiveToday`).
 */

import { withTic } from './chat'
import { ITEMS, josa } from './items'
import { hashString, mulberry32 } from './rng'

export type GiftCategory = 'fish' | 'bug' | 'shell' | 'fruit' | 'furniture' | 'flower' | 'treasure' | 'material' | 'junk'
export type Taste = 'love' | 'like' | 'neutral' | 'dislike'

/** 주민이 고를 수 있는 종류(쓰레기 제외) */
const LIKEABLE: GiftCategory[] = ['fish', 'bug', 'shell', 'fruit', 'furniture', 'flower', 'treasure', 'material']

/** 물건 id 의 종류. 없는 물건이면 null. */
export function categoryOf(itemId: string): GiftCategory | null {
  const def = ITEMS[itemId]
  if (!def) return null
  if (def.kind === 'seed') return 'flower'
  if (def.kind === 'junk') return 'junk'
  if (def.kind === 'ticket') return null
  return def.kind as GiftCategory
}

/** 주민이 가장 좋아하는 종류와 그다음 좋아하는 종류. id 로 정해져 늘 같다. */
export function tastesOf(villagerId: string): { love: GiftCategory; like: GiftCategory } {
  const rng = mulberry32(hashString(`taste:${villagerId}`))
  const i = Math.floor(rng() * LIKEABLE.length)
  const j = (i + 1 + Math.floor(rng() * (LIKEABLE.length - 1))) % LIKEABLE.length
  return { love: LIKEABLE[i], like: LIKEABLE[j] }
}

/** 이 주민에게 이 물건은 어떤 선물인지 */
export function tasteOf(villagerId: string, itemId: string): Taste {
  const cat = categoryOf(itemId)
  if (!cat) return 'neutral'
  if (cat === 'junk') return 'dislike'
  const t = tastesOf(villagerId)
  if (cat === t.love) return 'love'
  if (cat === t.like) return 'like'
  return 'neutral'
}

/** 취향과 생일 여부에 따른 호감도 점수. 생일엔 두 배 가까이 준다. */
export function giftPoints(taste: Taste, birthday: boolean): number {
  const base = { love: 10, like: 6, neutral: 3, dislike: 0 }[taste]
  if (!birthday) return base
  return { love: 25, like: 16, neutral: 8, dislike: 2 }[taste]
}

/** 하루에 한 주민에게 한 번만. 마지막으로 준 날이 오늘이면 못 준다. */
export function canGiveToday(lastGiftDay: string | undefined, today: string): boolean {
  return lastGiftDay !== today
}

/** 생일 답례로 주는 가구. 주민이 좋아하는 가구 목록에서 날짜로 하나를 고른다. */
export function presentFor(gifts: readonly string[], day: string, villagerId: string): string | null {
  if (!gifts.length) return null
  const rng = mulberry32(hashString(`present:${villagerId}:${day}`))
  return gifts[Math.floor(rng() * gifts.length)]
}

/**
 * 금박·반짝이 마감 가구를 편지에 동봉해 받았을 때, 마감을 알아보는 한 줄. 기본 가구와 색 변형은 null이다.
 * 주민 말투(반말 + 말끝 버릇)로 쓰고, 선물 취향 반응 앞에 붙인다.
 */
export function finishGlimpse(v: { tic: string }, variant: string | null | undefined): string | null {
  if (variant === 'gold') return `${withTic('금박이 번쩍번쩍하네', v.tic)} 이런 건 처음 봐.`
  if (variant === 'glitter') return `${withTic('반짝이 마감이라 반짝반짝하네', v.tic)} 눈이 부셔.`
  return null
}

export interface GiftReaction {
  points: number
  taste: Taste
  /** 대사 줄들. 생일이면 놀란 한마디가 먼저 온다. */
  lines: string[]
}

/**
 * 선물을 받은 뒤의 반응. 취향마다 다른 말투로 표정이 바뀐다(moodOf 키워드: 기쁨·놀람·시무룩·차분).
 */
export function giftReaction(v: { id: string; name: string; tic: string }, itemName: string, itemId: string, birthday: boolean): GiftReaction {
  const taste = tasteOf(v.id, itemId)
  const points = giftPoints(taste, birthday)
  const line = {
    love: `${itemName}이라니, 완전 좋아${v.tic}! 최고야!`,
    like: `${itemName} 고마워${v.tic}! 바로 써 볼게.`,
    neutral: `응, ${josa(itemName, '이구나', '구나')}. 잘 받아 둘게.`,
    dislike: `…${josa(itemName, '은', '는')} 내 취향이 아니야. 미안…`,
  }[taste]
  const lines = birthday ? ['앗, 오늘 내 생일 선물이야?!', line] : [line]
  return { points, taste, lines }
}
