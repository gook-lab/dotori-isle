/**
 * 공사·완성 알림 문구. 상점과 집이 공사를 맡기거나 끝날 때 토스트 줄을 같은 갈래로 묶어,
 * 새 알림이 뜨면 옛 공사 알림을 지우는 데 쓴다. 날짜만 보는 순수 함수다.
 */

import { dayIndex } from './economy'
import { CLOSED_DAYS } from './shopTiers'

/** 공사 알림 갈래인지. 공사 시작·대기·완성·재개장 문구가 여기 든다. */
const BUILD_TOAST = /^(🚧|🏗️)|공사 중이에요|공사를 시작했어요|완성됐어요|문을 열었어요|짓기를 맡겼어요/

export function isBuildToast(text: string): boolean {
  return BUILD_TOAST.test(text)
}

/** 상점이 다시 여는 날까지 남은 날. 맡긴 날 기준으로 닫힌 날 뒤의 날이다. 이미 열렸거나 날짜가 틀리면 0. */
export function shopDaysLeft(orderDay: string, day: string): number {
  const from = dayIndex(orderDay)
  const now = dayIndex(day)
  if (from === null || now === null) return 0
  const reopen = from + CLOSED_DAYS + 1
  return Math.max(0, reopen - now)
}

/** 공사 중 상점 버튼을 누를 때 띄우는 문구. 남은 날이 하루면 "내일", 그 이상이면 "모레"로 말한다. */
export function shopPendingText(name: string, daysLeft: number): string {
  const when = daysLeft <= 1 ? '내일' : '모레'
  return `🚧 ${name} 공사 중이에요. ${when} 새 간판을 달아요`
}
