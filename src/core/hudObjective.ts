/**
 * HUD "지금 할 일" 줄의 우선순위. 보상·여행·장날·퀘스트·집 줄이 한 화면에서 겹칠 때 무엇을 보일지 한 곳에서 정한다.
 * 주 줄 하나와 아래 힌트 한 줄, 최대 두 줄이다. 주 줄의 내용(목표 숫자, 짓는 재료 등)은 UI 가 채운다.
 *
 * 우선순위
 * - 보상 받기가 있으면 그 줄이 주 줄이다. 집 줄은 힌트로 붙되, 여행 섬에서는 본섬 것이라 숨긴다.
 * - 여행 섬: 돌아가는 법 한 줄만 보인다.
 * - 장날(이번 장에 안 샀을 때)은 장터 줄이 주 줄이다. 퀘스트 줄은 이날 뒤로 밀리고 집 줄이 힌트다.
 * - 그 밖에는 퀘스트 줄이 주 줄이다. 힌트는 집 빚·짓는 중이면 집 줄, 아니면 도토리 벌기 안내, 그것도 없으면 집 줄이다.
 */

import { homeNextLine } from './loanGuide'
import { lockedSystem, type UnlockCtx } from './unlocks'
import type { HomeStage } from './home'

/** 도토리 벌기 목표 아래에 붙는 한 줄 */
export const EARN_HINT = '도토리 상점에서 물건을 팔면 도토리가 생겨요'

export type HudMain = 'ready' | 'trip' | 'market' | 'quest'

export interface HudHint {
  kind: 'home' | 'earn'
  text: string
}

export interface HudObjectiveInput {
  /** 받을 보상이 있다 */
  ready: boolean
  /** 여행 섬에 있다 */
  trip: boolean
  /** 오늘이 장날이고 이번 장에서 아무것도 안 샀다 */
  market: boolean
  /** 현재 목표가 도토리 벌기다 */
  earn: boolean
  home: { stage: HomeStage; loan: number; order: { to: HomeStage } | null }
  /** 집 상담 잠금 판정용 값. 잠겨 있는지는 lockedSystem('home') 이 정한다. */
  unlock: UnlockCtx
}

export interface HudObjectiveLines {
  main: HudMain
  hint: HudHint | null
}

/** 빚이 남았거나 짓는 중이면 집 줄이 다른 안내보다 먼저다. 평소 빈 집 줄(다음 집 맡기기)은 도토리 안내에 밀린다. */
export function hudObjectiveLines(input: HudObjectiveInput): HudObjectiveLines {
  const { home } = input
  const homeOpen = lockedSystem('home', input.unlock) === null
  const homeText = homeNextLine(home.stage, home.loan, home.order, homeOpen)
  const homeHint: HudHint | null = homeText ? { kind: 'home', text: homeText } : null
  const earnHint: HudHint = { kind: 'earn', text: EARN_HINT }
  const homeUrgent = home.order !== null || home.loan > 0

  if (input.ready) return { main: 'ready', hint: input.trip ? null : homeHint }
  if (input.trip) return { main: 'trip', hint: null }
  if (input.market) return { main: 'market', hint: homeHint }
  if (input.earn && !homeUrgent) return { main: 'quest', hint: earnHint }
  return { main: 'quest', hint: homeHint ?? (input.earn ? earnHint : null) }
}
