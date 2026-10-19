/**
 * 시즌 이벤트 달력: 한 달을 7열로 펼치고, 칸마다 그날의 일정 아이콘을 모은다.
 * 축제, 장날, 낚시 대회, 생일, 맑은 밤의 별똥별 기회, 이사 예정, 편지 답장 예정을 기존 모듈에서 가져온다.
 * 저장 필드는 없다. 순수 로직이라 React 에 의존하지 않는다.
 */

import { festivalOn } from './festivals'
import { addDays, dayIndex } from './economy'
import { josa } from './items'
import { HARVEST_FROM, HARVEST_TO, isHarvestFairDay } from './harvestFair'
import { isPumpkinDay, PUMPKIN_FROM, PUMPKIN_TO } from './pumpkin'
import { SONGI_FROM, SONGI_TO } from './songi'
import { isMeteorNight, METEOR_FORECAST_DAYS, METEOR_LINE } from './skyEvents'
import { isBirthday } from './birthdays'
import { isFirstSnowDay, isFirstSnowEve } from './firstSnow'
import { isMarketDay, weekdayOf } from './market'
import { leaveDayOf, type Arrival, type MoveTalk } from './moving'
import type { OutLetter } from './mail'
import { TOURNEY_WEEKDAY } from './tourney'
import type { Weather } from './weather'
import type { Villager } from './villagers'

export type CalendarKind = 'festival' | 'market' | 'tourney' | 'birthday' | 'sky' | 'moving' | 'reply' | 'pumpkin' | 'harvest' | 'songi' | 'firstsnow'

export interface CalendarEvent {
  kind: CalendarKind
  icon: string
  /** 줄에 쓰는 이름(시간 빼고). 알림 문구에 쓴다. */
  name: string
  /** 줄에 쓰는 짧은 이름(시간 포함). 달력 칸 목록에 쓴다. */
  label: string
  /** 누르면 펼치는 한두 문장 설명 */
  note: string
}

export interface CalendarCtx {
  /** 오늘. 별똥별 예보는 오늘부터 이 날 수 안에서만 보여 준다. */
  today: string
  /** 날의 날씨. 별똥별 밤은 맑은 날 밤에만 정해진다. */
  weatherOn: (day: string) => Weather
  villagers: readonly Pick<Villager, 'id' | 'name'>[]
  moveTalk: MoveTalk | null
  arrivals: readonly Arrival[]
  outLetters: readonly OutLetter[]
  /** 주민 이름 찾기 */
  nameOf?: (id: string) => string
}

/** 그날의 일정. 아이콘과 한 줄 설명을 순서대로 돌려준다. */
export function eventsOn(day: string, ctx: CalendarCtx): CalendarEvent[] {
  const out: CalendarEvent[] = []
  const fest = festivalOn(day)
  if (fest) out.push({ kind: 'festival', icon: fest.icon, name: `${fest.name} 축제`, label: `${fest.name} 축제`, note: fest.goal })
  if (isMarketDay(day)) out.push({ kind: 'market', icon: '🛍️', name: '장날', label: '장날 (광장 떠돌이 상인)', note: '광장에 떠돌이 상인이 와요. 그날만 파는 물건이 있어요.' })
  if (weekdayOf(day) === TOURNEY_WEEKDAY) out.push({ kind: 'tourney', icon: '🎣', name: '낚시 대회', label: '낚시 대회 (9시~18시)', note: '광장에서 3분 동안 잡은 물고기 수로 겨뤄요. 참가는 하루에 한 번이에요.' })
  if (weekdayOf(day) === TOURNEY_WEEKDAY) out.push({ kind: 'songi', icon: '🍄', name: '송이 상인', label: `송이 상인 (${SONGI_FROM}시~${SONGI_TO}시)`, note: '아침에만 와요. 송이를 묶음으로 사서 시세가 좋을 때 팔아요.' })
  if (isPumpkinDay(day)) out.push({ kind: 'pumpkin', icon: '🎃', name: '호박 등불 밤', label: `호박 등불 밤 (${PUMPKIN_FROM}시~${PUMPKIN_TO}시)`, note: '저녁부터 광장과 상점 앞에 등불이 켜져요. 사탕을 주면 주민들이 기뻐해요.' })
  if (isHarvestFairDay(day)) out.push({ kind: 'harvest', icon: '🌰', name: '도토리 감사 장날', label: `도토리 감사 장날 (${HARVEST_FROM}시~${HARVEST_TO}시)`, note: '광장에서 수확물을 나눠요. 떨어진 열매와 도토리를 가져가면 좋아요.' })
  // 첫눈 날은 날짜가 정해져 있지 않다. 달력에는 전날부터 예보로만 보이고, 당일에는 그날 행사로 보인다.
  if (isFirstSnowDay(day, ctx.weatherOn)) out.push({ kind: 'firstsnow', icon: '❄️', name: '첫눈 오는 날', label: '첫눈 오는 날', note: '올해 처음 눈이 와요. 광장에서 눈사람을 함께 만들어요.' })
  else if (isFirstSnowEve(day, ctx.weatherOn)) out.push({ kind: 'firstsnow', icon: '❄️', name: '첫눈 예보', label: '첫눈 예보', note: '내일 올해 첫눈이 와요. 눈사람 인형을 놓으면 기념 가구를 받아요.' })
  for (const v of ctx.villagers) if (isBirthday(v.id, day)) out.push({ kind: 'birthday', icon: '🎂', name: `${v.name} 생일`, label: `${v.name} 생일`, note: `${v.name}의 생일이에요. 집에 가서 축하 인사를 건네 봐요.` })
  // 별똥별은 실제 별똥별 밤만 보여 준다. 오늘부터 일주일 안은 예보, 그 뒤는 비공개, 지난 날은 있었던 일로 본다.
  const ahead = (dayIndex(day) ?? 0) - (dayIndex(ctx.today) ?? 0)
  if (isMeteorNight(day, ctx.weatherOn(day)) && ahead <= METEOR_FORECAST_DAYS) {
    const past = ahead < 0
    out.push({ kind: 'sky', icon: '🌠', name: past ? '별똥별' : '별똥별 예보', label: past ? '별똥별이 왔던 밤' : '별똥별 예보', note: past ? '그날 밤엔 별똥별이 떨어졌어요.' : METEOR_LINE })
  }
  const name = (id: string) => ctx.nameOf?.(id) ?? ctx.villagers.find((v) => v.id === id)?.name ?? '주민'
  if (ctx.moveTalk && leaveDayOf(ctx.moveTalk.since) === day) {
    const who = name(ctx.moveTalk.id)
    out.push({ kind: 'moving', icon: '🚚', name: `${who} 이사`, label: `${who} 이사 가는 날`, note: `${josa(who, '이', '가')} 섬을 떠나는 날이에요. 인사를 나눠 봐요.` })
  }
  for (const a of ctx.arrivals) {
    if (a.day !== day) continue
    const who = name(a.id)
    out.push({ kind: 'moving', icon: '🏡', name: `${who} 이사`, label: `${who} 이사 오는 날`, note: `${josa(who, '이', '가')} 새 집에 들어와요. 찾아가서 인사해 봐요.` })
  }
  for (const l of ctx.outLetters) {
    if (l.replied || l.replyDay !== day) continue
    const who = name(l.to)
    out.push({ kind: 'reply', icon: '💌', name: `${who} 답장`, label: `${who} 답장 오는 날`, note: `${who}에게 보낸 편지의 답장이 우편함에 와요.` })
  }
  return out
}

/** 내일 알림에서 이름을 고를 때의 순서. 앞에 있을수록 먼저 알린다. */
const ALERT_RANK: CalendarKind[] = ['festival', 'pumpkin', 'harvest', 'firstsnow', 'songi', 'tourney', 'market', 'birthday', 'moving', 'reply', 'sky']

/**
 * 내일 행사 알림: 저녁 18시 이후에만, 내일 일정이 있으면 첫 행사 이름을 돌려준다. 없으면 null.
 * 휴대폰 아이콘과 달력 앱의 점 배지에 쓴다(본 날 지우는 것은 store 가 맡는다).
 */
export function tomorrowAlert(day: string, hour: number, ctx: CalendarCtx): { name: string; count: number } | null {
  if (hour < 18) return null
  const next = addDays(day, 1)
  if (!next) return null
  const events = eventsOn(next, ctx)
  if (events.length === 0) return null
  // 알림 이름은 가장 큰 행사를 고른다(축제·축제형 행사 먼저, 장날·생일은 나중)
  const top = [...events].sort((a, b) => ALERT_RANK.indexOf(a.kind) - ALERT_RANK.indexOf(b.kind))[0]
  return { name: top.name, count: events.length }
}

/** 내일 알림 문장: 이름 받침에 따라 이/가를 고른다(예: 호박 등불 밤이, 낚시 대회가). */
export function tomorrowLine(name: string): string {
  const last = name.charCodeAt(name.length - 1)
  const hasBatchim = (last - 0xac00) % 28 !== 0
  return `내일 ${name}${hasBatchim ? '이' : '가'} 있어요`
}

export interface UpcomingDay {
  day: string
  events: CalendarEvent[]
}

/**
 * 오늘부터 n일 안의 일정을 날짜순으로 모은다. 일정이 없는 날은 뺀다. 지난 날은 넣지 않는다.
 * 날짜 규칙은 eventsOn 이 쓰는 모듈 함수를 그대로 쓴다(여기서 새 규칙을 만들지 않는다).
 */
export function upcomingEvents(day: string, n: number, ctx: CalendarCtx): UpcomingDay[] {
  const out: UpcomingDay[] = []
  for (let i = 0; i < n; i++) {
    const d = addDays(day, i)
    if (!d) break
    const events = eventsOn(d, ctx)
    if (events.length) out.push({ day: d, events })
  }
  return out
}

/** 한 달의 칸: 일요일부터 시작하는 7열. 달 밖의 칸은 null 이다. */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lead = weekdayOf(first) ?? 0
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= count; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

/** 달을 앞뒤로 옮긴다 */
export function shiftMonth(year: number, month: number, step: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + step
  return { year: Math.floor(i / 12), month: (i % 12) + 1 }
}

/** 날짜 키에서 연·월 */
export function yearMonthOf(day: string): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) }
}
