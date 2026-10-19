import type { Letter } from './letters'
import type { Personality } from './chat'

/**
 * 플레이어 생일. 설정 창에서 월과 일을 고르면(일은 1~28일만, 2월 걱정 없이) 해마다 그날 섬 주민들이 축하한다.
 * 그날 아침 위원회 편지와 작은 선물(화분 한 개), 주민들의 축하 수다가 온다. 저장은 선택 칸 `playerBirthday` 하나다.
 */

export interface PlayerBirthday {
  month: number
  day: number
}

/** 플레이어가 고를 수 있는 월과 일의 범위 */
export const PLAYER_BIRTHDAY_MONTHS = 12
export const PLAYER_BIRTHDAY_DAYS = 28
/** 생일 축하 선물(주인공 방에 놓는 작은 가구) */
export const PLAYER_BIRTHDAY_GIFT = 'flowerpot'

/** 저장된 생일 칸을 검사한다. 범위를 벗어나거나 깨진 값은 정하지 않은 것(null)으로 본다. */
export function cleanPlayerBirthday(raw: unknown): PlayerBirthday | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const month = o.month
  const day = o.day
  if (typeof month !== 'number' || typeof day !== 'number') return null
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > PLAYER_BIRTHDAY_MONTHS || day < 1 || day > PLAYER_BIRTHDAY_DAYS) return null
  return { month, day }
}

/** 날짜 키(YYYY-MM-DD)가 플레이어 생일인지 본다. 정하지 않았으면 언제나 거짓이다. */
export function isPlayerBirthday(bd: PlayerBirthday | null | undefined, day: string): boolean {
  if (!bd) return false
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return false
  return Number(m[1]) === bd.month && Number(m[2]) === bd.day
}

/** 설정 창에서 쓰는 날짜 이름. 예: 10월 7일 */
export function playerBirthdayLabel(bd: PlayerBirthday | null): string {
  return bd ? `${bd.month}월 ${bd.day}일` : '정하지 않음'
}

/** 생일 아침 위원회 편지. 선물 칸에 작은 화분이 들어 있다. */
export function playerBirthdayLetter(day: string): Letter {
  return {
    id: `player-birthday-${day}`,
    from: 'committee',
    fromName: '섬 가꾸기 위원회',
    day,
    text: '오늘은 당신의 생일이에요! 섬 주민들이 축하 인사를 준비했어요. 작은 화분을 보내니 방에 놓아 주세요.',
    gift: PLAYER_BIRTHDAY_GIFT,
    read: false,
    claimed: false,
  }
}

/** 플레이어 생일 날 주민과 처음 말을 나눌 때는 축하 수다를 꼭 한다(하루 첫 대화 보장) */
export const playerBirthdayTalkDue = (bd: PlayerBirthday | null | undefined, day: string, firstToday: boolean): boolean =>
  firstToday && isPlayerBirthday(bd, day)

/** 생일 날 주민들이 건네는 축하 수다. 성격마다 두 줄씩 다르다. */
const PLAYER_BIRTHDAY_TALK: Record<Personality, [string, string]> = {
  cheery: ['오늘 네 생일이래! 생일 축하해!', '같이 광장에서 축하 파티 하자, 헤헤!'],
  shy: ['…오늘 네 생일이라고 들었어. 축하해…', '…작은 선물 준비했는데, 받아 줄래…?'],
  cool: ['생일이라지. 축하해. 한 살 더 먹었군.', '오늘 하루는 편하게 쉬어.'],
  lazy: ['오늘 네 생일이래~ 축하해~', '생일엔 낮잠 자도 된대~ 헤헤~'],
  sporty: ['생일 축하해! 오늘 달리기 기록 세우자!', '생일엔 역시 광장 한 바퀴지!'],
  grumpy: ['흥, 생일이래. 축하해. 쳇.', '…별로 축하하고 싶은 건 아니지만, 축하해. 쳇.'],
}

/** 플레이어 생일 축하 수다 줄(성격별 두 줄) */
export const playerBirthdayTalkLines = (p: Personality): string[] => [...PLAYER_BIRTHDAY_TALK[p]]
