import type { Personality } from './chat'
import { addDays } from './economy'
import type { Letter } from './letters'
import { hashString } from './rng'
import type { Weather } from './weather'

/**
 * 첫눈 오는 날: 그 해 처음 눈이 오는 날을 겨울 행사로 연다. 날짜가 고정돼 있지 않아서 달력에는 전날부터 "첫눈 예보"로만 보인다.
 * - 아침 방송과 위원회 편지로 알리고, 주민들이 광장에서 눈사람을 함께 만든다(눈사람 자리는 weatherLife 의 snowmanBuilder).
 * - 그날 눈사람 인형을 섬에 놓으면 눈사람을 완성한 것으로 보고, 이 게임만의 기념 가구를 편지로 준다. 겨울마다 한 번이다.
 * 겨울은 12월 1일부터 다음 해 2월 말까지다. 12월에 온 눈과 1~2월의 눈이 같은 겨울에 속하고, 그 겨울의 첫 눈이 첫눈이다.
 * 날씨는 호출하는 쪽이 weatherOn 으로 넘긴다(날씨 규칙을 여기서 다시 만들지 않는다). 순수 로직이다.
 */

/** 첫눈 날 완성 보상으로 주는 기념 가구(items.ts) */
export const FIRST_SNOW_REWARD = 'first-snow-crystal'
/** 눈사람 완성으로 보는 물건(눈사람 인형) */
export const FIRST_SNOW_SNOWMAN = 'snowman'
/** 보상을 받은 겨울을 얼마나 남길지. 저장 칸이 무한히 늘지 않게 막는다. */
export const FIRST_SNOW_KEEP = 10

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const WINTER_KEY_RE = /^\d{4}-\d{2}$/

/** 날짜가 속한 겨울의 시작 연도. 12월은 그해 겨울, 1~2월은 전년도 겨울이다. 겨울이 아니면 null. */
export function winterOf(day: string): number | null {
  const m = DAY_RE.exec(day)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo === 12) return y
  if (mo <= 2) return y - 1
  return null
}

/** 겨울 저장 키(예: 2026-27). 시작 연도 2026의 겨울은 2026년 12월부터 2027년 2월까지다. */
export const winterKey = (startYear: number): string => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`

/** 날짜가 속한 겨울의 저장 키. 겨울이 아니면 null. */
export function winterKeyOf(day: string): string | null {
  const w = winterOf(day)
  return w === null ? null : winterKey(w)
}

/** 그 겨울의 첫눈 날(날짜 키). 12월 1일부터 2월 말까지 훑어, 처음 눈이 오는 날을 준다. 눈이 없으면 null이다. */
export function firstSnowDay(startYear: number, weatherOn: (day: string) => Weather): string | null {
  const end = `${startYear + 1}-03-01`
  let day: string | null = `${startYear}-12-01`
  while (day && day < end) {
    if (weatherOn(day) === 'snow') return day
    day = addDays(day, 1)
  }
  return null
}

/** 날짜 키가 그 겨울의 첫눈 날인지 */
export function isFirstSnowDay(day: string, weatherOn: (day: string) => Weather): boolean {
  const w = winterOf(day)
  if (w === null) return false
  return firstSnowDay(w, weatherOn) === day
}

/** 내일이 첫눈 날이면 오늘이 첫눈 예보 날이다(달력과 아침 방송이 전날부터 보여 준다) */
export function isFirstSnowEve(day: string, weatherOn: (day: string) => Weather): boolean {
  const next = addDays(day, 1)
  return next !== null && isFirstSnowDay(next, weatherOn)
}

/** 첫눈 날 눈사람 완성 판정: 그날 눈사람 인형을 놓았고, 그 겨울 보상을 아직 받지 않았을 때만 true */
export function firstSnowCompleted(day: string, itemId: string, doneWinters: readonly string[], weatherOn: (day: string) => Weather): boolean {
  if (itemId !== FIRST_SNOW_SNOWMAN) return false
  if (!isFirstSnowDay(day, weatherOn)) return false
  const key = winterKeyOf(day)
  return key !== null && !doneWinters.includes(key)
}

/**
 * 저장된 보상 겨울 목록을 읽는다. 겨울 키(2026-27) 형식의 값을 남기고 중복은 없앤다.
 * 예전 저장은 연도(2026)로 적었는데, 그 첫눈은 1~2월에 왔으니 전년도 겨울(2025-26)로 옮긴다.
 */
export function cleanFirstSnowWinters(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const keys = raw.flatMap((v): string[] => {
    if (typeof v === 'string' && WINTER_KEY_RE.test(v)) return [v]
    if (typeof v === 'number' && Number.isInteger(v) && v >= 2001 && v <= 2999) return [winterKey(v - 1)]
    return []
  })
  return [...new Set(keys)].slice(-FIRST_SNOW_KEEP)
}

/** 눈사람을 같이 만드는 주민 가운데 눈사람을 빚는 주민 말고 둘을 고른다(같은 날이면 같은 주민). */
export function firstSnowHelpers(day: string, ids: readonly string[], builderId: string, n = 2): string[] {
  return ids
    .filter((id) => id !== builderId)
    .sort((a, b) => hashString(`${day}:helper:${a}`) - hashString(`${day}:helper:${b}`))
    .slice(0, n)
}

/** 아침 마을 방송: 전날 예보와 당일 알림 */
export const FIRST_SNOW_EVE_LINE = '❄️ 내일은 올해 첫눈이 와요. 광장에서 눈사람을 함께 만들어요.'
export const FIRST_SNOW_DAY_LINE = '❄️ 올해 첫눈이 내렸어요! 주민들이 광장에서 눈사람을 만들고 있어요.'

/** 첫눈 날 아침 위원회 편지. 눈사람 인형 하나를 동봉하고, 섬에 놓으면 완성으로 본다고 적는다. */
export function firstSnowLetter(day: string): Letter {
  return {
    id: `first-snow-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '올해 첫눈이 왔어요! 동봉한 눈사람 인형을 섬에 놓아 주세요. 오늘 놓으면 눈사람을 완성한 것으로 보고 기념품을 보내 드려요.',
    gift: FIRST_SNOW_SNOWMAN,
    read: false,
    claimed: false,
  }
}

/** 눈사람을 완성했을 때 보내는 기념 가구 편지. 연도마다 한 번이다. */
export function firstSnowRewardLetter(day: string): Letter {
  return {
    id: `first-snow-reward-${winterKeyOf(day) ?? day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '올해 첫 눈사람을 완성했어요! 눈결정을 닮은 기념 장식을 보내요. 섬 어디에 놓아도 좋아요.',
    gift: FIRST_SNOW_REWARD,
    read: false,
    claimed: false,
  }
}

/** 첫눈 날 대화 줄. 성격마다 두 줄씩 다르게 말한다. */
const FIRST_SNOW_TALK: Record<Personality, [string, string]> = {
  cheery: ['첫눈이다! 우리 같이 눈사람 만들자!', '눈덩이 굴리면 금방 커져. 재밌겠지?'],
  shy: ['…올해 첫눈이야. 같이 만들래…?', '…눈사람은 조금 작아도 괜찮아…'],
  cool: ['올해 첫눈이군. 눈사람이나 하나 만들까.', '눈은 금방 녹으니 서둘러야겠어.'],
  lazy: ['첫눈이래~ 눈사람 만들기엔 딱 좋은 날이야~', '굴리기만 하면 되니까 쉬운 편이야~'],
  sporty: ['첫눈이다! 눈덩이 굴리기 대결 어때?', '뛰어다니면 몸도 금방 따뜻해져!'],
  grumpy: ['흥, 첫눈이라고 호들갑이네. 눈사람은 만들어 주지.', '…눈 맞으면 감기 걸린다. 쳇, 그래도 한 번은 만들자.'],
}

export const firstSnowTalkLines = (p: Personality): string[] => [...FIRST_SNOW_TALK[p]]
