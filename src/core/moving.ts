/**
 * 이사 오고 가기. 여행 섬에서 놀러 와 집을 지어 산 손님(guest) 가운데 우정이 가장 낮은 주민이 한 달에 한 번쯤
 * 이사를 고민한다. 대화로 말리면 남고, 그대로 두면 사흘 뒤 떠난다. 떠난 자리는 빈 집터가 되고, 며칠 뒤 캠핑장 손님 하나가 이사 온다.
 * 처음 2주와 생일 주간에는 고민이 생기지 않는다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import type { Ask } from './chat'
import { addDays, dayIndex } from './economy'
import { josa } from './items'
import { isBirthday } from './birthdays'
import { hashString } from './rng'
import type { Villager } from './villagers'

/** 섬에 온 뒤 이만큼은 이사 고민이 생기지 않는다 */
export const MOVE_GRACE_DAYS = 14
/** 고민은 이 간격보다 자주 생기지 않는다 */
export const MOVE_INTERVAL_DAYS = 30
/** 그대로 두면 고민한 날부터 이만큼 뒤에 떠난다 */
export const MOVE_LEAVE_DAYS = 3
/** 떠난 자리에 손님이 오기까지 걸리는 날 */
export const ARRIVAL_DAYS = 3
/** 생일 앞뒤로 이만큼은 고민을 막는다 */
export const BIRTHDAY_BLOCK_DAYS = 3

/** 지금 고민 중인 주민 */
export interface MoveTalk {
  id: string
  since: string
}

/** 떠난 자리에 이사 올 손님 */
export interface Arrival {
  id: string
  day: string
}

/** 이사 고민 후보: 집을 지어 산 손님 주민. 처음부터 살던 주민과 이웃 주민은 이사하지 않는다. */
export function movers(villagers: readonly Villager[], houses: readonly string[]): Villager[] {
  return villagers.filter((v) => v.guest && houses.includes(v.id))
}

/** 생일 주간인지: 생일 앞뒤 BIRTHDAY_BLOCK_DAYS 안에 드는 날 */
export function birthdayWeek(id: string, day: string): boolean {
  for (let k = -BIRTHDAY_BLOCK_DAYS; k <= BIRTHDAY_BLOCK_DAYS; k++) {
    const d = addDays(day, k)
    if (d && isBirthday(id, d)) return true
  }
  return false
}

/** 지금 새 고민을 시작해도 되는지 */
export function canThinkOfMoving(c: { day: string; islandStart: string | null; lastMoveDay: string | null; moveTalk: MoveTalk | null }): boolean {
  if (c.moveTalk) return false
  if (!c.islandStart) return false
  const sinceStart = dayIndex(c.day)! - dayIndex(c.islandStart)!
  if (sinceStart < MOVE_GRACE_DAYS) return false
  if (c.lastMoveDay && dayIndex(c.day)! - dayIndex(c.lastMoveDay)! < MOVE_INTERVAL_DAYS) return false
  return true
}

/** 우정이 가장 낮은 후보. 같으면 날짜로 정한 순서를 따른다. 생일 주간인 주민은 빼고 고른다. */
export function pickMover(candidates: readonly { id: string; friendship: number }[], day: string): string | null {
  const ok = candidates.filter((c) => !birthdayWeek(c.id, day))
  if (!ok.length) return null
  const low = Math.min(...ok.map((c) => c.friendship))
  const tied = ok.filter((c) => c.friendship === low)
  return tied[hashString(`mover:${day}`) % tied.length].id
}

/** 고민한 날부터 떠나는 날 */
export const leaveDayOf = (since: string): string | null => addDays(since, MOVE_LEAVE_DAYS)

/** 떠난 날부터 손님이 오는 날. 손님은 캠핑장에 있는 손님 가운데 하나를 날짜로 고른다. */
export const arrivalDayOf = (leftDay: string): string | null => addDays(leftDay, ARRIVAL_DAYS)

/** 이사 올 캠핑장 손님: 아직 집을 짓지 않은 손님 가운데 날짜로 하나 */
export function pickReplacement(guests: readonly Villager[], houses: readonly string[], arrivals: readonly Arrival[], day: string): string | null {
  const free = guests.filter((g) => !houses.includes(g.id) && !arrivals.some((a) => a.id === g.id))
  if (!free.length) return null
  return free[hashString(`arrive:${day}`) % free.length].id
}

/** 떠나는 주민의 작별 편지. 사진 액자를 선물로 남긴다. */
export function farewellText(name: string, tic: string): string {
  return `${josa(name, '이에요', '예요')}${tic}. 여기서 지낸 날들이 정말 즐거웠어요. 이 액자에 우리 추억을 걸어 두세요.`
}

/** 이사 온 손님의 인사 편지 */
export function welcomeText(name: string, tic: string): string {
  return `${josa(name, '이에요', '예요')}${tic}! 이사 왔어요. 앞으로 이웃으로 잘 지내요.`
}

/** 이사 고민 중인 주민에게 말을 걸면 고르는 두 가지 대답. 앞은 남기고 우정을 두 칸 올리고, 뒤는 응원하며 보낸다. */
export const MOVE_ASK: Ask = {
  options: [
    { label: '가지 마요, 같이 있어요', reply: '고마워. 그럼 여기서 같이 지낼게!', stay: true },
    { label: '새 곳도 좋겠네요', reply: '응원해 줘서 고마워. 새 곳에서도 잘 지낼게!', stay: false },
  ],
}
