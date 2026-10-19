/**
 * 주민 생일. 주민마다 id 로 정한 달·날짜가 해마다 같이 돌아온다.
 *
 * 열두 달을 고르게 쓴다(봄·여름·가을·겨울이 셋씩). 날짜는 1~28일만 쓴다(2월 걱정 없이).
 * 생일 날에는 아침 편지로 초대하고, 다른 주민은 그 주민 이야기를 꺼낸다.
 */

import { seasonOfMonth, type Season } from './season'
import { hashString, mulberry32 } from './rng'
import type { Personality } from './chat'

export interface MonthDay {
  month: number
  day: number
}

/** 주민 id 로 정한 생일(월·일). 같은 id 면 언제나 같다. */
export function birthdayOf(id: string): MonthDay {
  const rng = mulberry32(hashString(`birthday:${id}`))
  return { month: 1 + Math.floor(rng() * 12), day: 1 + Math.floor(rng() * 28) }
}

/** 생일이 드는 계절. 달력의 계절과 같다. */
export function seasonOfBirthday(id: string): Season {
  return seasonOfMonth(birthdayOf(id).month)
}

/** 날짜 키(YYYY-MM-DD) 가 생일인지 본다. */
export function isBirthday(id: string, day: string): boolean {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return false
  const b = birthdayOf(id)
  return Number(m[1]) === b.month && Number(m[2]) === b.day
}

/** 날짜 키의 생일을 가진 주민 id 목록(주어진 주민 가운데서). */
export function birthdaysOn(ids: readonly string[], day: string): string[] {
  return ids.filter((id) => isBirthday(id, day))
}

/** 생일 날 아침 편지 본문. 말끝 버릇은 주민이 쓰는 대로 붙인다. */
export function birthdayInviteText(tic: string): string {
  return `오늘은 내 생일이야${tic}! 선물 들고 놀러 와 줘. 기다릴게!`
}

/** 다른 주민이 생일 이야기를 꺼낼 때 한 줄. */
export function birthdayMentionLine(name: string): string {
  return `오늘 ${name} 생일이래! 만나면 같이 축하해 줘.`
}

/** 생일인 주민을 처음 만났을 때 먼저 하는 말. */
export function birthdayHelloLine(tic: string): string {
  return `오늘 내 생일이야${tic}! 이렇게 와 줘서 고마워.`
}

/**
 * 생일 날 수다 줄. 생일인 주민과 말을 나눌 때(처음이든 두 번째든) 성격마다 두 줄씩 다르게 말한다.
 * 첫 대화의 인사(birthdayHelloLine)와 겹치지 않게, 축하와 이야기 쪽으로 붙인다.
 */
const BIRTHDAY_TALK: Record<Personality, [string, string]> = {
  cheery: ['생일이라서 오늘 하루가 완전 특별해! 같이 축하해 줄래?', '케이크 대신 과일 나눠 먹으면 더 좋을 것 같아!'],
  shy: ['…오늘 생일이라 조금 떨려… 그래도 기뻐…', '…나 생일 축하 받으니까 조금 웃음이 나. 고마워…'],
  cool: ['생일이라고 특별한 건 없어. 그래도 축하는 받을게.', '한 살 더 먹었으니 오늘은 봐줄게.'],
  lazy: ['생일이라 오늘은 낮잠 자도 괜찮지~ 축하해 줄 거지~?', '케이크 한 조각이면 충분해~ 헤헤~'],
  sporty: ['생일이다! 한 살 더 먹었으니 오늘 달리기 기록 깰 거야!', '축하해 주면 같이 광장 한 바퀴 뛰자!'],
  grumpy: ['흥, 생일이라고 다들 난리야. 쳇.', '…축하 한마디쯤은 받아 줄게. 고마워. 쳇.'],
}

/** 생일인 주민과 나누는 수다 줄(성격별 두 줄) */
export const birthdayTalkLines = (p: Personality): string[] => [...BIRTHDAY_TALK[p]]

/** 생일 날 주민과 처음 말을 나눌 때 파티 연출을 켠다. 같은 날 두 번째 대화에는 켜지 않는다. */
export function birthdayPartyNow(id: string, day: string, firstToday: boolean): boolean {
  return firstToday && isBirthday(id, day)
}

/**
 * 생일 날 생일 수다를 아직 하지 않았는지 본다. 같은 날 두 번째 이후 대화에서 한 번은 반드시 나오게 하려고 쓴다.
 * 첫 대화는 인사(birthdayHelloLine)로 생일을 알리므로 여기서는 보장하지 않는다.
 * done 은 `날짜:주민 id` 기록 목록이다(저장 칸 birthdayChatDone).
 */
export function birthdayChatDue(id: string, day: string, firstToday: boolean, done: readonly string[]): boolean {
  return !firstToday && isBirthday(id, day) && !done.includes(`${day}:${id}`)
}
