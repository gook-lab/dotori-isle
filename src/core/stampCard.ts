/**
 * 단골 스탬프 카드. 상점에서 물건을 살 때마다 그날 처음이면 한 칸 찍는다.
 * 여섯 칸을 다 채우면 도토리 보상을 주고 빈 카드로 바꾼다. 순수 함수라 React·Three 에 의존하지 않는다.
 *
 * - 하루에 최대 한 칸이라 한 번에 몰아 사도 여섯 칸은 엿새 이상 걸린다.
 * - 카드 장수(cards)는 완성한 횟수를 세어 안내 문장에 쓴다.
 */

export const STAMP_GOAL = 6
export const STAMP_REWARD = 150

export interface StampCard {
  /** 찍힌 칸 수. 목표 이상이면(목표를 낮춘 뒤 저장) 다음 구매 때 완성한다. */
  n: number
  /** 마지막으로 찍은 날(YYYY-MM-DD). 같은 날에는 또 찍지 않는다. */
  last: string | null
  /** 지금까지 완성한 카드 수 */
  cards: number
}

export const NEW_STAMP_CARD: StampCard = { n: 0, last: null, cards: 0 }

export interface StampResult {
  card: StampCard
  /** 이번 구매로 칸이 찍혔는지 */
  stamped: boolean
  /** 카드를 완성해 받은 도토리(없으면 0) */
  reward: number
}

/** 상점에서 산 날 호출한다. 그날 이미 찍었으면 카드를 그대로 두고 아무것도 주지 않는다. */
export function stampOn(card: StampCard | null, day: string): StampResult {
  const c = card ?? NEW_STAMP_CARD
  if (c.last === day) return { card: c, stamped: false, reward: 0 }
  const n = c.n + 1
  if (n >= STAMP_GOAL) return { card: { n: 0, last: day, cards: c.cards + 1 }, stamped: true, reward: STAMP_REWARD }
  return { card: { n, last: day, cards: c.cards }, stamped: true, reward: 0 }
}

/** 구매 안내 뒤에 붙이는 한 줄. 찍지 않은 날에는 빈 문자열이다. */
export function stampLine(r: StampResult): string {
  if (r.reward > 0) return `단골 스탬프 ${STAMP_GOAL}칸을 다 채워서 도토리 ${r.reward.toLocaleString()}개를 받았어요!`
  if (!r.stamped) return ''
  return `단골 스탬프를 찍었어요! ${r.card.n}/${STAMP_GOAL}`
}

/** 구매 토스트 한 줄에 스탬프 안내를 이어 붙인다. 찍히지 않은 날에는 구매 문장 그대로다. */
export function withStampNote(text: string, r: StampResult): string {
  const note = stampLine(r)
  return note ? `${text} · ${note}` : text
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 저장에서 읽은 값을 검사한다. 맞지 않으면 null(처음 상태로 본다). 목표보다 많이 찍힌 저장은 그대로 받는다(다음 구매 때 완성). */
export function cleanStampCard(v: unknown): StampCard | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const { n, last, cards } = o
  if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 99) return null
  if (!(last === null || (typeof last === 'string' && DAY_RE.test(last)))) return null
  if (!Number.isInteger(cards) || (cards as number) < 0) return null
  return { n: n as number, last: last as string | null, cards: cards as number }
}

/** 오늘 이미 찍었는지 */
export function stampedOn(card: StampCard | null, day: string): boolean {
  return (card?.last ?? null) === day
}

/** 찍기 안내 한 줄: 오늘 찍었으면 완료, 아니면 오늘 처음 사면 찍힌다. */
export function stampHint(card: StampCard | null, day: string): string {
  return stampedOn(card, day) ? '오늘 도장 찍었어요' : '오늘 처음 사면 한 칸 찍어요'
}

/** 몇 번째 카드인지. 첫 카드는 말하지 않는다(완성한 적이 있을 때만). */
export function cardNumberLine(cards: number): string | null {
  return cards >= 1 ? `${cards + 1}번째 카드` : null
}
