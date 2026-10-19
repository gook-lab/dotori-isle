/**
 * 일요일 낚시 대회. 일요일 9시부터 18시 전까지 광장에 진행자 주민이 서고, 참가하면 3분 동안 잡은 물고기를 센다.
 * 마릿수에 따라 대회 포인트를 받고, 포인트로 대회 전용 가구를 바꾼다. 하루에 한 번만 나간다.
 * 순수 로직이라 React·Three 에 의존하지 않는다. 진행 중인 판(TourneyRun)은 저장하지 않는다.
 */

import { MARKET_SITE, weekdayOf } from './market'

/** 일요일(0) */
export const TOURNEY_WEEKDAY = 0
/** 대회 시간대: 9시 이상 18시 미만 */
export const TOURNEY_OPEN_HOUR = 9
export const TOURNEY_CLOSE_HOUR = 18
/** 한 판의 길이(밀리초) */
export const TOURNEY_LEN_MS = 3 * 60 * 1000

/** 마릿수 구간별 대회 포인트 */
export const SCORE_TIERS: readonly { min: number; points: number; name: string }[] = [
  { min: 12, points: 3, name: '금메달' },
  { min: 8, points: 2, name: '은메달' },
  { min: 4, points: 1, name: '동메달' },
  { min: 0, points: 0, name: '참가상' },
]

/** 포인트로 바꾸는 대회 전용 가구 */
export const TOURNEY_PRIZES: readonly { id: string; cost: number }[] = [
  { id: 'tourney-trophy', cost: 3 },
  { id: 'tourney-fish', cost: 2 },
  { id: 'tourney-flag', cost: 2 },
]

/** 저장되는 대회 기록: 가진 포인트와 마지막으로 참가한 날 */
export interface TourneyState {
  points: number
  lastDay: string | null
}

export const NEW_TOURNEY: TourneyState = { points: 0, lastDay: null }

/** 진행 중인 판. 끝나는 시각과 지금까지 잡은 마릿수. */
export interface TourneyRun {
  day: string
  endAt: number
  count: number
}

/** 대회 날 낮 시간대인지 */
export function tourneyWindow(day: string, hour: number): boolean {
  return weekdayOf(day) === TOURNEY_WEEKDAY && hour >= TOURNEY_OPEN_HOUR && hour < TOURNEY_CLOSE_HOUR
}

/** 참가할 수 있는지: 대회 시간대이고, 오늘 아직 안 나갔고, 판이 돌고 있지 않을 때 */
export function canJoin(state: TourneyState, day: string, hour: number, running: boolean): boolean {
  return !running && tourneyWindow(day, hour) && state.lastDay !== day
}

/** 판을 시작한다. 끝나는 시각은 지금부터 3분 뒤다. */
export function startRun(day: string, now: number): TourneyRun {
  return { day, endAt: now + TOURNEY_LEN_MS, count: 0 }
}

/** 한 마리 더 잡았다. 판이 없으면 그대로 둔다. */
export function countCatch(run: TourneyRun | null): TourneyRun | null {
  return run ? { ...run, count: run.count + 1 } : null
}

/** 판이 끝났는지 */
export const runOver = (run: TourneyRun, now: number): boolean => now >= run.endAt

/** 남은 시간(밀리초). 끝났으면 0. */
export const remainingMs = (run: TourneyRun, now: number): number => Math.max(0, run.endAt - now)

/** 남은 시간을 분:초로. 올림해서 0:01 까지 보여 준다. */
export function clockText(ms: number): string {
  const sec = Math.ceil(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** 마릿수로 받을 포인트 */
export function scoreOf(count: number): number {
  return SCORE_TIERS.find((t) => count >= t.min)?.points ?? 0
}

/** 마릿수에 맞는 메달 이름 */
export function medalOf(count: number): string {
  return SCORE_TIERS.find((t) => count >= t.min)?.name ?? '참가상'
}

/** 판을 끝내면 포인트를 더한다. 마지막 참가일을 기록한다. */
export function finishRun(state: TourneyState, run: TourneyRun): TourneyState {
  return { points: state.points + scoreOf(run.count), lastDay: run.day }
}

/** 포인트로 가구 하나를 바꿀 수 있는지 */
export function canExchange(id: string, points: number): { ok: true; cost: number } | { ok: false; reason: string } {
  const p = TOURNEY_PRIZES.find((x) => x.id === id)
  if (!p) return { ok: false, reason: '대회 상품이 아니에요' }
  if (points < p.cost) return { ok: false, reason: `포인트가 ${p.cost - points} 모자라요` }
  return { ok: true, cost: p.cost }
}

/** 저장된 기록을 믿을 수 있는 값으로 맞춘다. */
export function sanitizeTourney(raw: unknown): TourneyState {
  const r = (raw ?? {}) as Partial<TourneyState>
  const points = typeof r.points === 'number' && Number.isFinite(r.points) && r.points >= 0 ? Math.floor(r.points) : 0
  const lastDay = typeof r.lastDay === 'string' ? r.lastDay : null
  return { points, lastDay }
}

/** 진행자가 서는 자리: 광장(장터 자리)에서 조금 떨어진 쪽 */
export const ANNOUNCER_OFFSET = { x: -3.2, z: 2.4 }
/** 진행자 앞에서 말을 걸 수 있는 거리 */
export const ANNOUNCER_R = 1.8

export function announcerSpot(): { x: number; z: number } | null {
  return MARKET_SITE ? { x: MARKET_SITE.x + ANNOUNCER_OFFSET.x, z: MARKET_SITE.z + ANNOUNCER_OFFSET.z } : null
}
