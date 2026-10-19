import { dayIndex } from './economy'
import { weekdayOf } from './market'

/**
 * 이번 주 소식. 일요일 아침 마을회관 방송에 지난 7일 동안 한 일을 3~4줄로 요약한다.
 * 요약은 지금 통계에서 지난 기준값(mark)을 뺀 차이로 만든다. 저장은 mark 한 칸뿐이다.
 * 일요일 아침에 요약을 만들고, mark 를 지금 값과 오늘 날짜로 옮긴다. 같은 날 방송을 다시 틀면 그 요약을 보여 준다.
 */

/** 요약에 쓰는 통계 id. 저장할 때도 이 목록만 남긴다. */
export const RECAP_STATS = ['fish', 'bug', 'earn', 'build', 'letter', 'chop', 'shake', 'rock', 'dig', 'water', 'plant', 'shell'] as const
/** 방송 한 번에 보여 주는 요약 줄 수 상한 */
export const RECAP_MAX = 4
export const QUIET_LINE = '조용한 한 주였어요. 다음 주에는 무엇을 해 볼까요?'
/** 요약 앞에 붙는 구분 머리글. 방송 카드와 휴대폰 알림에 같은 글자로 남는다. */
export const RECAP_HEAD = '📅 지난 7일 이야기'
const WORK_STATS = ['chop', 'shake', 'rock', 'dig', 'water', 'plant', 'shell'] as const
const TIER_MAX = 3

/** 한 시점의 기준값. 통계 몇 개, 상점 단계, 주민 수. */
export interface WeekSnapshot {
  stats: Record<string, number>
  tier: number
  houses: number
}

export interface WeekMark extends WeekSnapshot {
  /** 기준값을 잡은 날. 일요일 아침이면 그날, 처음 시작했으면 그날이다. */
  day: string
  /** 그 일요일에 낸 요약 줄. 같은 날 마을 방송을 다시 틀 때 쓴다. */
  recap: string[]
}

export function snapshotOf(stats: Readonly<Record<string, number>>, tier: number, houses: number): WeekSnapshot {
  const picked: Record<string, number> = {}
  for (const k of RECAP_STATS) picked[k] = stats[k] ?? 0
  return { stats: picked, tier, houses }
}

export const isRecapDay = (day: string): boolean => weekdayOf(day) === 0

/**
 * 지금과 기준값의 차이로 한 주 요약 줄을 만든다. 한 일이 없으면 조용한 한 주 한 줄.
 * 병 편지 수(letter)는 기준값을 따로 잡지 않는다. 처음 기준값은 0에서 세므로 첫 주에는 그 주에 주운 편지만 잡힌다.
 */
export function recapLines(now: WeekSnapshot, base: WeekSnapshot, extra: readonly string[] = []): string[] {
  const d = (k: string) => Math.max(0, (now.stats[k] ?? 0) - (base.stats[k] ?? 0))
  const lines: string[] = []
  const fish = d('fish')
  if (fish) lines.push(`🐟 물고기 ${fish}마리를 낚았어요.`)
  const bug = d('bug')
  if (bug) lines.push(`🦋 벌레 ${bug}마리를 잡았어요.`)
  const earn = d('earn')
  if (earn) lines.push(`🌰 도토리 ${earn.toLocaleString()}개를 벌었어요.`)
  const tier = Math.max(0, now.tier - base.tier)
  if (tier) lines.push(`🏗️ 도토리 상점을 ${tier}단계 키웠어요.`)
  const built = d('build')
  if (built) lines.push(`🏡 집 ${built}채가 완성됐어요.`)
  const moved = Math.max(0, now.houses - base.houses)
  if (moved) lines.push(`🚪 새 주민 ${moved}명이 이사 왔어요.`)
  const letter = d('letter')
  if (letter) lines.push(`🍾 병 편지 ${letter}통을 주웠어요.`)
  const work = WORK_STATS.reduce((sum, k) => sum + d(k), 0)
  if (work) lines.push(`🪓 섬일을 ${work}번 했어요.`)
  // 이번 주에 채운 섬 이야기 목표 축하는 요약의 맨 앞에 둔다(최대 두 줄)
  const all = [...extra.slice(0, 2), ...lines]
  if (all.length === 0) return [QUIET_LINE]
  return all.slice(0, RECAP_MAX)
}

export function nextMark(now: WeekSnapshot, day: string, recap: string[]): WeekMark {
  return { ...now, day, recap }
}

/** 저장에서 읽은 기준값을 검증한다. 맞지 않으면 null. 통계는 요약 목록만 남기고 빠진 값은 0으로 본다. */
export function cleanWeekMark(v: unknown): WeekMark | null {
  if (!v || typeof v !== 'object') return null
  const m = v as Record<string, unknown>
  if (typeof m.day !== 'string' || dayIndex(m.day) === null) return null
  if (!m.stats || typeof m.stats !== 'object') return null
  const raw = m.stats as Record<string, unknown>
  const stats: Record<string, number> = {}
  for (const k of RECAP_STATS) {
    const x = raw[k]
    stats[k] = typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : 0
  }
  if (!Number.isInteger(m.tier) || (m.tier as number) < 0 || (m.tier as number) > TIER_MAX) return null
  if (!Number.isInteger(m.houses) || (m.houses as number) < 0) return null
  const recap = Array.isArray(m.recap) ? m.recap.filter((x): x is string => typeof x === 'string' && x.length <= 120).slice(0, RECAP_MAX) : []
  return { day: m.day, stats, tier: m.tier as number, houses: m.houses as number, recap }
}
