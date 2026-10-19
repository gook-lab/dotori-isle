import type { Letter } from './letters'
import type { Personality } from './chat'
import type { Slot } from './inventory'
import { ITEMS } from './items'
import { addDays } from './economy'
import { hashString } from './rng'

/**
 * 도토리 감사 장날: 11월 셋째 주 토요일(2026년은 11월 21일) 낮 10시부터 16시까지 열리는 이 섬의 수확 장터.
 * - 주민은 수확물을 나눠 달라고 한다. 과일이나 요리를 하나 건네면 도토리와 답례 가구 편지를 받는다.
 * - 가진 게 없으면 아쉬워하기만 한다. 기록을 남기지 않아 다시 와도 된다.
 * - 한 주민에게는 장날마다 한 번만 받는다.
 * 판정은 모두 순수 함수다. 저장은 주민별 교환 기록(harvestFairDone)만 남긴다.
 */

/** 장날이 열리는 달과 주 안의 날 범위(셋째 주 토요일은 15~21일 사이의 토요일) */
const HARVEST_MONTH = 11
const HARVEST_WEEK_DAYS = [15, 21] as const
export const HARVEST_FROM = 10
export const HARVEST_TO = 16
export const HARVEST_REWARD_MONEY = 60
export const HARVEST_FURNITURE = ['harvest-basket', 'acorn-garland'] as const

const SATURDAY = 6

/** 주어진 날짜 키가 셋째 주 토요일 장날인지 */
export function isHarvestFairDay(day: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo !== HARVEST_MONTH || d < HARVEST_WEEK_DAYS[0] || d > HARVEST_WEEK_DAYS[1]) return false
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay() === SATURDAY
}

/** 장날 바로 전날인지(방송으로 미리 알린다) */
export function isHarvestFairEve(day: string): boolean {
  const next = addDays(day, 1)
  return next !== null && isHarvestFairDay(next)
}

/** 장날 낮 장이 서 있는 시간인지 */
export const isHarvestFairHour = (day: string, hour: number): boolean =>
  isHarvestFairDay(day) && hour >= HARVEST_FROM && hour < HARVEST_TO

/** 주민에게 건넬 수 있는 수확물: 과일과 요리 */
export const isHarvestGift = (id: string): boolean => {
  const kind = ITEMS[id]?.kind
  return kind === 'fruit' || kind === 'dish'
}

/** 가방에서 처음 찾은 수확물 id. 없으면 null */
export function pickHarvestGift(inv: readonly Slot[]): string | null {
  return inv.find((s) => s.count > 0 && isHarvestGift(s.id))?.id ?? null
}

/** 주민과 날짜로 답례 가구를 고른다. 같은 조합은 늘 같은 가구다. */
export function harvestFurnitureFor(key: string): (typeof HARVEST_FURNITURE)[number] {
  return HARVEST_FURNITURE[hashString(key) % HARVEST_FURNITURE.length]
}

/** 장날 아침 마을 방송 한 줄 */
export const HARVEST_EVE_LINE = '🌰 내일은 도토리 감사 장날이에요. 수확물을 들고 광장으로 나와 주세요.'
export const HARVEST_DAY_LINE = '🌰 오늘은 도토리 감사 장날이에요. 낮 10시부터 16시까지 광장에서 수확물을 나눠요.'

/** 장날 아침 주민들이 보내는 편지 */
export function harvestFairLetter(day: string): Letter {
  return {
    id: `harvest-fair-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '오늘은 도토리 감사 장날이에요. 낮에 수확물을 가져오면 주민들이 도토리와 답례를 준비해 두었어요.',
    gift: null,
    read: false,
    claimed: false,
  }
}

/** 수확물 답례 편지 */
export function harvestThanksLetter(day: string, v: { id: string; name: string }, gift: string): Letter {
  return {
    id: `harvest-thanks-${day}-${v.id}`,
    from: v.id,
    fromName: v.name,
    day,
    text: '수확물 고마워! 감사 장날 답례로 작은 선물을 넣었어!',
    gift,
    read: false,
    claimed: false,
  }
}

/**
 * 장날 대화 줄. 성격마다 두 줄씩 다르게 말한다.
 * ask: 수확물을 나눠 달라는 말, thanks: 받은 고마움과 답례 소개, none: 수확물이 없을 때의 아쉬움.
 */
const HARVEST_TALK: Record<Personality, { ask: [string, string]; thanks: (gift: string) => [string, string]; none: [string, string] }> = {
  cheery: {
    ask: ['감사 장날이다! 수확물 있으면 나눠 줄래?', '과일이든 요리든 좋아, 같이 나눠 먹자!'],
    thanks: (g) => ['고마워! 올해 수확 최고야!', `답례로 ${g} 줄게!`],
    none: ['아이고, 오늘은 빈손이구나. 다음엔 꼭 챙겨 와!', '광장에 과일 가져온 사람이 많던데, 부럽다~'],
  },
  shy: {
    ask: ['…감사 장날이래… 수확물 나눠 줄 수 있어…?', '…과일이나 요리면 다 좋아…'],
    thanks: (g) => ['…고마워. 올해 것 제일 맛있어…', `…답례로 ${g} 줄게…`],
    none: ['…괜찮아. 다음 장날에 같이 나눠 먹자…', '…나 혼자 먹기엔 많아서 조금 아쉬워…'],
  },
  cool: {
    ask: ['감사 장날이군. 수확물 하나 나눠 줄래?', '과일이든 요리든 가리지 않아.'],
    thanks: (g) => ['고마워. 올해 수확은 괜찮군.', `답례로 ${g} 줄게.`],
    none: ['빈손이라. 다음 장날엔 챙겨 와.', '장터 구경은 충분히 했으니 됐어.'],
  },
  lazy: {
    ask: ['감사 장날이래~ 수확물 나눠 줄 거지~?', '과일 하나면 낮잠 깨기 딱 좋아~'],
    thanks: (g) => ['고마워~ 올해 것 달다~', `답례로 ${g} 줄게~`],
    none: ['빈손이구나~ 그래도 괜찮아~', '다음 장날엔 과일 하나만 들고 와~'],
  },
  sporty: {
    ask: ['감사 장날이다! 수확물 나눠 주세요!', '과일 먹고 광장 한 바퀴 뛰자!'],
    thanks: (g) => ['좋아! 올해 수확 완전 좋다!', `답례로 ${g} 줄게!`],
    none: ['빈손이야? 다음엔 에너지 충전할 과일 들고 와!', '장터 뛰어다니는 것만으로는 배 안 불러!'],
  },
  grumpy: {
    ask: ['흥, 감사 장날이라고 했지. 수확물 한 개 줘.', '…나눠 주기 싫으면 말고. 쳇.'],
    thanks: (g) => ['흥, 고마워. 올해 건 나쁘지 않네.', `답례로 ${g} 줘. 쳇.`],
    none: ['흥, 빈손이네. 다음엔 챙겨 와.', '…과일 가져온 사람 얘기는 듣고 싶지 않아. 쳇.'],
  },
}

export const harvestAskLines = (p: Personality): string[] => [...HARVEST_TALK[p].ask]
export const harvestThanksLines = (p: Personality, gift: string): string[] => [...HARVEST_TALK[p].thanks(gift)]
export const harvestNoneLines = (p: Personality): string[] => [...HARVEST_TALK[p].none]
