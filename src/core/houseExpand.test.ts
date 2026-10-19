import { describe, expect, it } from 'vitest'
import { VILLAGERS } from './villagers'
import {
  cleanExpanded,
  cleanHouseExpand,
  completeHouseExpand,
  donateHouse,
  EXPAND_MIN,
  HOUSE_TAP,
  houseTapAmount,
  expandable,
  expandChoiceLabel,
  expandCost,
  expandDoneLine,
  expandOffer,
  HOUSE_EXPAND_STAGE,
  type HouseExpand,
} from './houseExpand'

const DAY = '2026-10-26'
const ID = 'mocha'

describe('주민 집 증축 — 값과 자격', () => {
  it('주민마다 5,000~8,000 사이 1,000 단위 값이고, 같은 주민이면 늘 같다', () => {
    for (const v of VILLAGERS) {
      const c = expandCost(v.id)
      expect(c).toBeGreaterThanOrEqual(EXPAND_MIN)
      expect(c).toBeLessThanOrEqual(EXPAND_MIN + 3000)
      expect(c % 1000).toBe(0)
      expect(expandCost(v.id)).toBe(c)
    }
  })

  it('내 집 5단계 전에는 증축할 수 없고, 집이 지어져 있고 아직 안 넓힌 주민만 된다', () => {
    expect(expandable(HOUSE_EXPAND_STAGE - 1, [ID], [], ID)).toBe(false)
    expect(expandable(HOUSE_EXPAND_STAGE, [], [], ID)).toBe(false)
    expect(expandable(HOUSE_EXPAND_STAGE, [ID], [ID], ID)).toBe(false)
    expect(expandable(HOUSE_EXPAND_STAGE, [ID], [], ID)).toBe(true)
  })

  it('대화 선택지는 남은 값을 보여 주고, 다른 집이 진행 중이면 숨는다', () => {
    expect(expandOffer(HOUSE_EXPAND_STAGE, [ID], [], null, ID)).toEqual({ remaining: expandCost(ID) })
    const other: HouseExpand = { villagerId: 'bomi', fund: 100, ready: null }
    expect(expandOffer(HOUSE_EXPAND_STAGE, [ID], [], other, ID)).toBeNull()
    const ready: HouseExpand = { villagerId: ID, fund: expandCost(ID), ready: '2026-10-27' }
    expect(expandOffer(HOUSE_EXPAND_STAGE, [ID], [], ready, ID)).toBeNull()
  })
})

describe('주민 집 증축 — 기부와 완성', () => {
  it('한 번 누르는 양은 1,000개이고, 남은 값과 지갑이 더 적으면 그만큼만 보탠다', () => {
    expect(HOUSE_TAP).toBe(1000)
    expect(houseTapAmount(5000, 20000)).toBe(1000)
    expect(houseTapAmount(300, 20000)).toBe(300)
    expect(houseTapAmount(5000, 400)).toBe(400)
    expect(houseTapAmount(5000, 0)).toBe(0)
  })

  it('여러 번 나눠 내고, 값이 차면 다음 날을 완성일로 적는다', () => {
    const cost = expandCost(ID)
    const a = donateHouse(null, 10_000, 2000, DAY, ID)
    expect(a).toMatchObject({ ok: true, money: 8000, done: false, state: { villagerId: ID, fund: 2000, ready: null } })
    if (!a.ok) return
    const b = donateHouse(a.state, a.money, cost - 2000, DAY, ID)
    expect(b).toMatchObject({ ok: true, done: true, state: { fund: cost, ready: '2026-10-27' } })
  })

  it('값보다 많이, 지갑보다 많이, 다른 집이 있을 때는 기부할 수 없다', () => {
    const cost = expandCost(ID)
    expect(donateHouse(null, 10_000, cost + 1, DAY, ID).ok).toBe(false)
    expect(donateHouse(null, 100, 500, DAY, ID)).toEqual({ ok: false, reason: '도토리가 모자라요' })
    const other: HouseExpand = { villagerId: 'bomi', fund: 0, ready: null }
    expect(donateHouse(other, 10_000, 500, DAY, ID)).toEqual({ ok: false, reason: '다른 집을 먼저 증축하고 있어요' })
  })

  it('값이 다 찬 집에는 더 낼 수 없다', () => {
    const ready: HouseExpand = { villagerId: ID, fund: expandCost(ID), ready: '2026-10-27' }
    expect(donateHouse(ready, 10_000, 100, DAY, ID)).toEqual({ ok: false, reason: '이 집은 내일 아침에 완성돼요' })
  })

  it('완성일 아침에 증축 목록에 넣고 진행 칸을 비운다. 그 전에는 그대로다', () => {
    const ready: HouseExpand = { villagerId: ID, fund: expandCost(ID), ready: '2026-10-27' }
    expect(completeHouseExpand(ready, [], DAY)).toEqual({ current: ready, expanded: [], done: null })
    expect(completeHouseExpand(ready, [], '2026-10-27')).toEqual({ current: null, expanded: [ID], done: ID })
    expect(completeHouseExpand(null, [ID], '2026-10-27')).toEqual({ current: null, expanded: [ID], done: null })
  })

  it('완성 알림과 선택지 글에 주민 이름이 들어간다', () => {
    expect(expandDoneLine(ID)).toBe('🏠 모카네 집 현관에 차양이 달렸어요')
    expect(expandChoiceLabel(ID, 5000)).toBe('🏠 모카네 집 증축 돕기 · 도토리 1,000개 (남은 도토리 5,000개)')
    expect(expandChoiceLabel(ID, 300)).toBe('🏠 모카네 집 증축 돕기 · 도토리 300개 (남은 도토리 300개)')
  })
})

describe('주민 집 증축 — 저장 검사', () => {
  it('진행 칸은 아는 주민과 맞는 값·날짜만 받는다', () => {
    expect(cleanHouseExpand({ villagerId: ID, fund: 1000, ready: null })).toEqual({ villagerId: ID, fund: 1000, ready: null })
    expect(cleanHouseExpand({ villagerId: 'nobody', fund: 1000, ready: null })).toBeNull()
    expect(cleanHouseExpand({ villagerId: ID, fund: expandCost(ID) + 1, ready: null })).toBeNull()
    expect(cleanHouseExpand({ villagerId: ID, fund: 10, ready: 'nope' })).toBeNull()
    expect(cleanHouseExpand(undefined)).toBeNull()
  })

  it('끝낸 집 목록은 아는 주민만, 중복 없이 남긴다', () => {
    expect(cleanExpanded([ID, ID, 'nobody', 5, 'bomi'])).toEqual([ID, 'bomi'])
    expect(cleanExpanded('x')).toEqual([])
  })
})
