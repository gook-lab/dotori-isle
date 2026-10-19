/**
 * 송이 시세. 일요일 아침 떠돌이 상인에게서 송이버섯을 묶음으로 사고, 월~토 오전·오후에 바뀌는 시세로 판다.
 * 시세는 주(일요일 시작) 단위로 정해진 모양(4가지) 가운데 하나를 따른다. 날짜만으로 정해지는 순수 함수라
 * 저장하지 않아도 같은 날에는 같은 값이 나온다. 다음 일요일이 되면 남은 송이는 상한다.
 */

import { addDays, dayIndex } from './economy'
import type { Slot } from './inventory'

/** 날짜 키의 요일(0 = 일요일). 시장 모듈을 끌어오지 않으려고 여기서 직접 셈한다. */
function weekdayOf(key: string): number | null {
  if (dayIndex(key) === null) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const SONGI_ID = 'songi'
export const SONGI_SPOILED_ID = 'songi-spoiled'
/** 한 묶음 개수와 묶음 값(개당 40개 꼴). 한 일요일에 살 수 있는 묶음 수는 WEEKLY_BUNDLE_MAX 까지다. */
export const SONGI_BUNDLE = 10
export const SONGI_BUNDLE_PRICE = 400
export const SONGI_WEEKLY_BUNDLE_MAX = 3
/** 상인이 머무는 시간(시작 시각 포함, 끝 시각 제외) */
export const SONGI_FROM = 5
export const SONGI_TO = 12
const SUNDAY = 0
/** 시세 기준가 범위: 주마다 80~100 사이에서 정한다 */
const BASE_MIN = 80
const BASE_SPAN = 21
const FLOOR = 20

export type SongiPattern = 'rise' | 'fall' | 'wave' | 'spike'
export const SONGI_PATTERNS: readonly SongiPattern[] = ['rise', 'fall', 'wave', 'spike']

/** 문자열을 32비트 정수로 섞는다(djb2). 같은 입력이면 항상 같은 값이 나온다. */
function hash(text: string): number {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return h >>> 0
}

/** 주의 일요일 날짜. 일요일이 아니면 그 주 일요일을 돌려준다. 날짜가 잘못되면 null. */
export function songiWeekOf(day: string): string | null {
  const w = weekdayOf(day)
  if (w === null) return null
  return addDays(day, -w)
}

/** 그 주의 시세 모양. 주가 같으면 같은 모양이다. */
export function songiPattern(week: string): SongiPattern {
  return SONGI_PATTERNS[hash(`pattern:${week}`) % SONGI_PATTERNS.length]
}

/** 그 주의 기준가(시세의 가운데 값). */
export function songiBase(week: string): number {
  return BASE_MIN + (hash(`base:${week}`) % BASE_SPAN)
}

/**
 * 주 안의 칸 번호(0 = 월요일 오전, 11 = 토요일 오후)에 따른 배율.
 * 오름은 점점 오르고, 내림은 점점 내리고, 출렁은 위아래로 흔들고, 한 번 튀는 주는 목요일 무렵 크게 한 번 뛴다.
 */
export function songiFactor(pattern: SongiPattern, slot: number): number {
  const k = Math.min(11, Math.max(0, slot))
  if (pattern === 'rise') return 0.6 + 0.06 * k
  if (pattern === 'fall') return 1.3 - 0.06 * k
  if (pattern === 'wave') return 1 + 0.35 * Math.sin((k * Math.PI) / 3)
  return k >= 6 && k <= 8 ? 1.9 : 0.85
}

/** 칸 번호: 월요일 오전 0, 월요일 오후 1, … 토요일 오후 11. 일요일은 칸이 없어 null. */
export function songiSlotOf(day: string, am: boolean): number | null {
  const w = weekdayOf(day)
  if (w === null || w === SUNDAY) return null
  return (w - 1) * 2 + (am ? 0 : 1)
}

/** 그날 오전(am) 또는 오후 시세. 일요일이나 잘못된 날짜는 null. 시세는 송이를 팔 때만 쓰인다. */
export function songiQuote(day: string, am: boolean): number | null {
  const slot = songiSlotOf(day, am)
  const week = songiWeekOf(day)
  if (slot === null || week === null) return null
  return quoteAt(week, slot)
}

function quoteAt(week: string, slot: number): number {
  return Math.max(FLOOR, Math.round(songiBase(week) * songiFactor(songiPattern(week), slot)))
}

/** 지금 시각(시 단위, 소수 가능)의 시세. 오전은 12시 전이다. 팔 수 없으면 0. */
export function songiNow(day: string, hour: number): number {
  return songiQuote(day, hour < 12) ?? 0
}

/** 그 주 전체 시세 12칸(월 오전 ~ 토 오후). 시세표를 보여 줄 때 쓴다. */
export function songiWeekQuotes(week: string): number[] {
  return Array.from({ length: 12 }, (_, slot) => quoteAt(week, slot))
}

/** 상인이 지금 와 있는가: 일요일 SONGI_FROM 시 ~ SONGI_TO 시 전. */
export function songiOpen(day: string, hour: number): boolean {
  return weekdayOf(day) === SUNDAY && hour >= SONGI_FROM && hour < SONGI_TO
}

/** 그 주에 아직 살 수 있는 묶음 수. 다른 주의 기록은 새 주로 보고 한도를 다시 센다. */
export function songiBundlesLeft(buy: { week: string; n: number } | null, week: string): number {
  const used = buy && buy.week === week ? buy.n : 0
  return Math.max(0, SONGI_WEEKLY_BUNDLE_MAX - used)
}

/** 다음 일요일이 되면 남은 송이는 상한 송이가 된다. 수량은 그대로 옮긴다. */
export function spoilSongi(inv: readonly Slot[]): Slot[] {
  return inv.map((s) => (s.id === SONGI_ID ? { ...s, id: SONGI_SPOILED_ID } : s))
}

/** 저장에서 읽은 송이 구매 기록을 검증한다. 맞지 않으면 null. */
export function cleanSongiBuy(v: unknown): { week: string; n: number } | null {
  if (!v || typeof v !== 'object') return null
  const { week, n } = v as { week?: unknown; n?: unknown }
  if (typeof week !== 'string' || dayIndex(week) === null || weekdayOf(week) !== SUNDAY) return null
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > SONGI_WEEKLY_BUNDLE_MAX) return null
  return { week, n }
}
