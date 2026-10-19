import { describe, expect, it } from 'vitest'
import { EARN_HINT, hudObjectiveLines, type HudObjectiveInput } from './hudObjective'
import type { UnlockCtx } from './unlocks'

/** 집 상담이 열린 상태: 재료 퀘스트를 깨고 사흘이 지났다 */
const OPEN: UnlockCtx = {
  day: '2026-10-19',
  islandStart: '2026-10-01',
  questsDone: ['materials'],
  dexCount: 0,
  stats: { sold: 0, spent: 0, questsDone: ['materials'] },
}
/** 집 상담이 잠긴 상태: 재료 퀘스트를 아직 못 깼다 */
const LOCKED: UnlockCtx = { ...OPEN, questsDone: [], stats: { sold: 0, spent: 0, questsDone: [] } }

/** 기본값은 평일 퀘스트 한 줄. 경우마다 필요한 칸만 덮어쓴다. */
const base: HudObjectiveInput = {
  ready: false,
  trip: false,
  market: false,
  earn: false,
  home: { stage: 2, loan: 0, order: null },
  unlock: OPEN,
}
const run = (over: Partial<HudObjectiveInput> = {}, home: Partial<HudObjectiveInput['home']> = {}) =>
  hudObjectiveLines({ ...base, ...over, home: { ...base.home, ...home } })

describe('HUD 목표 줄 우선순위', () => {
  it('평일에 집 줄이 없으면 퀘스트 한 줄만 보인다', () => {
    expect(run({}, { stage: 5, loan: 0 })).toEqual({ main: 'quest', hint: null })
  })

  it('평일 도토리 벌기 목표는 집 빚이 없을 때 판매 안내를 힌트로 단다', () => {
    expect(run({ earn: true }, { stage: 0, loan: 0 })).toEqual({ main: 'quest', hint: { kind: 'earn', text: EARN_HINT } })
  })

  it('평일 도토리 벌기 목표도 대출이 남았으면 집 줄이 판매 안내보다 먼저다', () => {
    const r = run({ earn: true }, { stage: 2, loan: 2000 })
    expect(r.main).toBe('quest')
    expect(r.hint).toEqual({ kind: 'home', text: '대출은 도토리 상점 안 ATM에서 갚아요' })
  })

  it('평일 퀘스트에 대출이 남으면 대출 줄을 힌트로 단다', () => {
    expect(run({}, { stage: 2, loan: 2000 }).hint?.text).toBe('대출은 도토리 상점 안 ATM에서 갚아요')
  })

  it('짓는 중이면 주 줄은 퀘스트이고 힌트는 짓는 중 줄이다', () => {
    const r = run({}, { stage: 1, loan: 2500, order: { to: 2 } })
    expect(r.main).toBe('quest')
    expect(r.hint).toEqual({ kind: 'home', text: '큰 집 짓는 중이에요. 내일 아침 완성돼요' })
  })

  it('짓는 중에 도토리 벌기 목표여도 짓는 중 줄이 먼저다', () => {
    const r = run({ earn: true }, { stage: 1, loan: 0, order: { to: 2 } })
    expect(r.hint?.kind).toBe('home')
  })

  it('장날에는 장터 줄이 주 줄이고 집 줄이 힌트로 남는다', () => {
    const r = run({ market: true }, { stage: 2, loan: 2000 })
    expect(r).toEqual({ main: 'market', hint: { kind: 'home', text: '대출은 도토리 상점 안 ATM에서 갚아요' } })
  })

  it('장날이고 집 줄이 없으면 장터 줄만 보인다', () => {
    expect(run({ market: true }, { stage: 5, loan: 0 })).toEqual({ main: 'market', hint: null })
  })

  it('짓는 중인 장날에도 장터 줄과 짓는 중 줄이 같이 보인다', () => {
    const r = run({ market: true }, { stage: 1, loan: 2500, order: { to: 2 } })
    expect(r.main).toBe('market')
    expect(r.hint?.text).toBe('큰 집 짓는 중이에요. 내일 아침 완성돼요')
  })

  it('보상 받기가 있으면 보상이 주 줄이고 집 줄이 힌트다', () => {
    expect(run({ ready: true, market: true }, { stage: 2, loan: 2000 })).toEqual({
      main: 'ready',
      hint: { kind: 'home', text: '대출은 도토리 상점 안 ATM에서 갚아요' },
    })
  })

  it('여행 섬에서는 집 줄과 장터 줄을 보이지 않는다', () => {
    expect(run({ trip: true, market: true }, { stage: 2, loan: 2000 })).toEqual({ main: 'trip', hint: null })
  })

  it('여행 섬에서 보상이 있으면 보상이 주 줄이고 집 줄은 본섬 것이라 붙지 않는다', () => {
    expect(run({ trip: true, ready: true }, { stage: 2, loan: 2000 })).toEqual({ main: 'ready', hint: null })
  })

  it('텐트에서 집 상담이 열렸으면 "다 갚았어요" 없이 작은 집 맡기 줄을 힌트로 단다', () => {
    expect(run({}, { stage: 0, loan: 0 })).toEqual({ main: 'quest', hint: { kind: 'home', text: '집 상담에서 작은 집을 맡길 수 있어요' } })
  })

  it('텐트에서 집 상담이 아직 잠겼으면 집 줄을 내지 않는다', () => {
    expect(run({ unlock: LOCKED }, { stage: 0, loan: 0 })).toEqual({ main: 'quest', hint: null })
  })

  it('텐트에서 잠겼어도 도토리 벌기 안내는 그대로 보인다', () => {
    expect(run({ earn: true, unlock: LOCKED }, { stage: 0, loan: 0 })).toEqual({ main: 'quest', hint: { kind: 'earn', text: EARN_HINT } })
  })

  it('가장 큰 집을 다 갚았으면 집 줄이 없다', () => {
    expect(run({ earn: true }, { stage: 5, loan: 0 }).hint).toEqual({ kind: 'earn', text: EARN_HINT })
  })
})
