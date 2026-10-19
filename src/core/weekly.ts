/**
 * 이번 주 목표. 매주 월요일에 작은 목표 세 개를 뽑습니다. 목표는 통계(stats)의 늘어난 양으로 셉니다.
 *
 * - 목표는 주 시드로 고르므로 같은 주에는 늘 같고, 주가 바뀌면 새로 뽑습니다.
 * - 오늘의 할 일(daily)과 같은 통계를 쓰더라도 수치는 주간답게 세 배 이상으로 잡습니다.
 * - 목표 하나를 채우면 마일리지 40, 셋을 모두 채우면 도토리 300과 위원회 편지 한 통을 줍니다.
 * - 저장은 `weekly` 한 칸뿐입니다. 주의 월요일, 주 시작 시점의 통계(base), 마일리지를 받은 목표(got), 주간 보상을 받았는지(bonus).
 */

import { hashString, mulberry32 } from './rng'
import { mondayOf } from './rating'
import { dayIndex } from './economy'
import { STORY_CHAPTERS } from './story'

export const WEEKLY_MILES = 40
export const WEEKLY_BONUS_MONEY = 300
export const WEEKLY_COUNT = 3

/** 섬 이야기 5장을 모두 마친 뒤에만 이번 주 목표가 시작된다. 마친 장 수로 판단한다. */
export const weeklyOpen = (storyChapter: number): boolean => storyChapter >= STORY_CHAPTERS.length

export interface WeeklyPick {
  stat: string
  target: number
  label: string
}

/** 후보 목록. 오늘의 할 일과 겹치는 통계는 목표 수치를 세 배 이상으로 잡았다. */
export const WEEKLY_POOL: readonly WeeklyPick[] = [
  { stat: 'bug', target: 8, label: '벌레 여덟 마리 잡기' },
  { stat: 'fish', target: 8, label: '물고기 여덟 마리 낚기' },
  { stat: 'shake', target: 12, label: '나무 열두 그루 흔들기' },
  { stat: 'water', target: 12, label: '꽃 열두 송이에 물 주기' },
  { stat: 'rock', target: 10, label: '바위 열 번 두드리기' },
  { stat: 'talk', target: 10, label: '주민과 열 번 이야기하기' },
  { stat: 'give', target: 3, label: '주민 부탁 세 번 들어주기' },
  { stat: 'chop', target: 15, label: '목재 열다섯 개 모으기' },
  { stat: 'shell', target: 10, label: '조개 열 개 줍기' },
  { stat: 'plant', target: 6, label: '꽃씨 여섯 개 심기' },
  { stat: 'dig', target: 5, label: '반짝이는 자리 다섯 번 파기' },
]

export interface WeeklyState {
  /** 이번 주 월요일(YYYY-MM-DD) */
  week: string
  /** 주가 시작될 때의 통계 값(목표 통계별) */
  base: Record<string, number>
  /** 마일리지를 받은 목표(통계 id) */
  got: string[]
  /** 주간 보상(도토리 300과 편지)을 받았는지 */
  bonus: boolean
}

/** 그 주의 목표 세 개. 같은 주면 늘 같다. 후보에서 겹치지 않게 고른다. */
export function weeklyPicks(week: string): WeeklyPick[] {
  const rng = mulberry32(hashString(`weekly:${week}`))
  const pool = [...WEEKLY_POOL]
  const out: WeeklyPick[] = []
  while (out.length < WEEKLY_COUNT && pool.length) {
    const i = Math.floor(rng() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

/** 주가 바뀔 때 새 주간 상태를 만든다. 주 시작 통계를 기준으로 잡는다. */
export function newWeekly(week: string, stats: Readonly<Record<string, number>>): WeeklyState {
  const base = Object.fromEntries(weeklyPicks(week).map((p) => [p.stat, stats[p.stat] ?? 0]))
  return { week, base, got: [], bonus: false }
}

export interface WeeklyRow extends WeeklyPick {
  current: number
  done: boolean
}

/**
 * 오늘 보여 줄 주간 목표. 저장된 주가 오늘의 주와 다르면(아직 넘어가지 않았으면) 진행 0 으로 본다.
 */
export function weeklyView(state: WeeklyState | null, day: string, stats: Readonly<Record<string, number>>): { week: string; rows: WeeklyRow[]; bonus: boolean } {
  const week = mondayOf(day)
  const live = state && state.week === week ? state : null
  const rows = weeklyPicks(week).map((p) => {
    const gained = live ? (stats[p.stat] ?? 0) - (live.base[p.stat] ?? 0) : 0
    const current = Math.max(0, Math.min(p.target, gained))
    return { ...p, current, done: current >= p.target }
  })
  return { week, rows, bonus: live?.bonus ?? false }
}

/** 아직 채우지 못한 목표 수. 주가 바뀌었으면 셋 모두 남은 것으로 본다. */
export function weeklyLeft(state: WeeklyState | null, day: string, stats: Readonly<Record<string, number>>): number {
  return weeklyView(state, day, stats).rows.filter((r) => !r.done).length
}

/** 저장에서 읽은 주간 상태를 검증한다. 맞지 않으면 null. */
export function cleanWeekly(v: unknown): WeeklyState | null {
  if (!v || typeof v !== 'object') return null
  const { week, base, got, bonus } = v as Record<string, unknown>
  if (typeof week !== 'string' || dayIndex(week) === null || mondayOf(week) !== week) return null
  if (!base || typeof base !== 'object') return null
  const cleanBase: Record<string, number> = {}
  for (const [k, n] of Object.entries(base as Record<string, unknown>)) {
    if (!WEEKLY_POOL.some((p) => p.stat === k) || typeof n !== 'number' || !Number.isFinite(n)) return null
    cleanBase[k] = n
  }
  if (!Array.isArray(got) || !got.every((g) => typeof g === 'string' && g in cleanBase)) return null
  if (typeof bonus !== 'boolean') return null
  return { week, base: cleanBase, got: [...new Set(got as string[])], bonus }
}
