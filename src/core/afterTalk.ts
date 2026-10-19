import type { Personality } from './chat'
import { addDays } from './economy'
import { MILESTONE_KEY_RE } from './afterKeys'

/**
 * 섬 이야기 이후 목표를 채운 날과 그다음 날, 말을 건 첫 주민 한 명이 그 목표 이야기를 꺼낸다.
 * 목표마다 한 번만 꺼내므로 같은 목표로 두 주민이 말하는 일은 없다. 대사는 목표 종류와 성격마다 두 줄씩이다.
 * 순수 로직이라 React 에 의존하지 않는다. 저장은 목표 키별 채운 날과 이야기를 끝낸 키만 남긴다.
 */

type AfterKind = 'home-stars' | 'shop-tier' | 'dex' | 'island-stars'

const AFTER_TALK: Record<AfterKind, Record<Personality, [string, string]>> = {
  'home-stars': {
    cheery: ['우리 집이 벌써 별 {n}개래! 다들 구경하러 가자!', '집 꾸미기 솜씨가 대단해. 나도 본받아야겠어!'],
    shy: ['…별 {n}개 집이 생겼대. 멋있더라…', '…나도 우리 집을 조금 더 꾸며 볼까…'],
    cool: ['집이 별 {n}개라니. 꽤 잘 꾸몄군.', '배치를 보면 감각이 있는 사람이 살고 있어.'],
    lazy: ['별 {n}개짜리 집이래~ 소파가 엄청 편하겠다~', '집 구경 가고 싶은데 귀찮아~'],
    sporty: ['집이 별 {n}개라고? 달리기 코스로 쓸 만하겠다!', '다음엔 집 꾸미기 대결 어때?'],
    grumpy: ['흥, 별 {n}개 집이라고 자랑이 대단하네.', '…솔직히 좀 부럽다. 쳇.'],
  },
  'shop-tier': {
    cheery: ['도토리 백화점이 문을 열었대! 층마다 구경할 게 많겠지?', '백화점 진열 바뀌면 꼭 알려 줘!'],
    shy: ['…백화점이 생겼대. 조용히 한 바퀴 돌아보고 싶어…', '…물건이 많아서 조금 떨려…'],
    cool: ['백화점이라. 진열이 제법이겠군.', '물건 고르는 눈이 있으면 거기서 살 게 많겠어.'],
    lazy: ['백화점 생겼대~ 엘리베이터 타고 올라가 볼래~', '걸어 다니기 귀찮으면 2층 소파에서 쉬면 돼~'],
    sporty: ['백화점이다! 층계 뛰어 올라가기 대결하자!', '새 가게는 구경하면서 걷는 게 최고야!'],
    grumpy: ['흥, 백화점이 생겼다고 다들 난리네.', '…비싼 거 아니면 나한테 권하지 마. 쳇.'],
  },
  dex: {
    cheery: ['도감이 벌써 {n}종이래요! 박물관이 북적이겠어요!', '{n}종이면 대단하다! 나도 하나 찾아볼게!'],
    shy: ['…도감이 {n}종이래. 박물관에 사람이 많겠어…', '…나도 아직 못 본 게 있어. 찾아볼게…'],
    cool: ['도감이 {n}종이라. 꽤 부지런히 채웠군.', '박물관 전시를 보면 실력이 보여.'],
    lazy: ['도감이 {n}종이래~ 박물관 의자에 앉아 구경하면 되겠다~', '도감 채우는 건 나한테 맡겨~ 천천히~'],
    sporty: ['도감 {n}종이다! 다음 목표는 더 높게 잡아 보자!', '탐험하면서 채우면 금방이지!'],
    grumpy: ['도감 {n}종이라고? 흥, 나도 곧 따라잡을 거야.', '…박물관에 또 줄 서겠네. 쳇.'],
  },
  'island-stars': {
    cheery: ['섬 별점이 {n}개래! 다들 자랑하고 싶어 할 거야!', '우리 섬이 제일 좋아! 별 {n}개 축하해!'],
    shy: ['…섬이 별 {n}개를 받았대. 다행이야…', '…이웃들이 다 좋아해서 기뻐…'],
    cool: ['섬 별점이 {n}개라. 그럴 만한 섬이지.', '여기서 살아 보니 과연 좋은 섬이야.'],
    lazy: ['별 {n}개 섬이래~ 그냥 여기 누워 있기 좋은 섬이야~', '축하는 낮잠 자고 나서 할게~'],
    sporty: ['별 {n}개 섬이다! 섬 한 바퀴 뛰면서 축하하자!', '우리 섬 최고! 다음엔 별 더 받아 보자!'],
    grumpy: ['별 {n}개? 흥, 나쁘지 않네.', '…인정할게. 이 섬 괜찮아. 쳇.'],
  },
}

/** 목표 키의 종류 */
export function afterKindOf(key: string): AfterKind {
  const kind = key.split(':')[0]
  return kind as AfterKind
}

/** 목표 키의 숫자(집 별 단계, 도감 종 수, 섬 별점). 백화점은 숫자가 없다. */
const numberOf = (key: string): string => key.split(':')[1] ?? ''

/** 성격에 맞는 두 줄. {n} 자리에 목표 숫자를 넣는다. */
export function afterTalkLines(p: Personality, key: string): string[] {
  const n = numberOf(key)
  return AFTER_TALK[afterKindOf(key)][p].map((line) => line.replace('{n}', n))
}

/**
 * 오늘 꺼낼 목표 이야기 키. 채운 날이나 그다음 날이고, 아직 꺼내지 않은 목표 가운데 가장 먼저 채운 것을 고른다.
 * 없으면 null이다. 채운 날 맵은 목표 키 → 날짜(YYYY-MM-DD) 꼴이다.
 */
export function afterTalkKey(reachedDays: Readonly<Record<string, string>>, done: readonly string[], day: string): string | null {
  const due = Object.entries(reachedDays)
    .filter(([key, reached]) => !done.includes(key) && (reached === day || addDays(reached, 1) === day))
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  return due[0]?.[0] ?? null
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
export const AFTER_TALK_KEEP = 20

/** 저장된 채운 날 맵을 읽는다. 목표 키와 날짜 꼴이 아닌 항목은 버리고, 최근 것만 남긴다. */
export function cleanAfterDays(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (e): e is [string, string] => MILESTONE_KEY_RE.test(e[0]) && typeof e[1] === 'string' && DAY_KEY_RE.test(e[1]),
  )
  return Object.fromEntries(entries.slice(-AFTER_TALK_KEEP))
}

/** 저장된 이야기 끝낸 키 목록을 읽는다. */
export function cleanAfterTalkDone(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((k): k is string => typeof k === 'string' && MILESTONE_KEY_RE.test(k)))].slice(-AFTER_TALK_KEEP)
}
