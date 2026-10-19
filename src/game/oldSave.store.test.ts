import { describe, expect, it } from 'vitest'
import { COUPON_DAILY_MAX, couponsLeft, createBank } from '../core/bank'
import { countOf } from '../core/inventory'
import { NEW_ISLAND_GIFT } from '../core/islandGift'
import { loadSave, migrateSave, saveOf, useGame } from './store'

// 오늘 더한 선택 필드(쿠폰·주간 한정·섬 가꾸기 2차 아침 감사·주민 집 증축·집 감사 편지)가 예전 저장에서도 안전한지 본다.
const DAY = '2026-10-19'
const NEW_KEYS = ['islandAcorn', 'islandThanksDay', 'weeklyBuy', 'houseExpand', 'expanded', 'houseThanks'] as const

/** 오늘 추가 전 저장 모양을 흉내 낸다: 지금 저장에서 새 필드를 빼고, 돈·인벤토리·집 단계 같은 기존 값을 채운다 */
function oldSave(): Record<string, unknown> {
  useGame.setState({ day: DAY })
  const fresh = JSON.parse(JSON.stringify(saveOf(useGame.getState()))) as Record<string, unknown>
  for (const k of NEW_KEYS) delete fresh[k]
  const bank = { ...(fresh.bank as object) } as Record<string, unknown>
  delete bank.coupons
  return {
    ...fresh,
    bank,
    money: 1234,
    day: DAY,
    inventory: [{ id: 'wood', count: 9 }, { id: 'stone', count: 4 }],
    home: { stage: 3, loan: 0, order: null },
    houses: ['mocha', 'bomi'],
  }
}

describe('예전 저장 이행 — 오늘 추가 필드의 기본값', () => {
  it('새 필드가 없는 큰 예전 저장도 오류 없이 읽고, 새 필드는 기본값이 된다', () => {
    const old = oldSave()
    expect(NEW_KEYS.every((k) => !(k in old))).toBe(true)
    const s = migrateSave(old)
    expect(s.islandAcorn).toEqual(NEW_ISLAND_GIFT)
    expect(s.islandThanksDay).toBeNull()
    expect(s.weeklyBuy).toBeNull()
    expect(s.houseExpand).toBeNull()
    expect(s.expanded).toEqual([])
    expect(s.houseThanks).toBeNull()
    expect(s.bank.coupons).toBeUndefined()
    expect(couponsLeft(s.bank, DAY)).toBe(COUPON_DAILY_MAX)
  })

  it('기존 값(돈·인벤토리·집 단계·주민 집·날짜)은 그대로 남는다', () => {
    const s = migrateSave(oldSave())
    expect(s.money).toBe(1234)
    expect(s.day).toBe(DAY)
    expect(countOf(s.inventory, 'wood')).toBe(9)
    expect(countOf(s.inventory, 'stone')).toBe(4)
    expect(s.home.stage).toBe(3)
    expect(s.houses).toEqual(['mocha', 'bomi'])
  })

  it('loadSave 로 읽어도 백업 경로로 빠지지 않고 같은 값을 준다', () => {
    const s = loadSave(oldSave(), 29)
    expect(s.money).toBe(1234)
    expect(s.houseExpand).toBeNull()
    expect(s.islandAcorn).toEqual(NEW_ISLAND_GIFT)
  })
})

describe('망가진 새 필드: 오류 없이 기본값으로 돌아간다', () => {
  it('잘못된 타입·날짜·id 가 들어 있어도 기존 값은 그대로 두고 새 필드만 기본값으로 바꾼다', () => {
    const broken = {
      ...oldSave(),
      islandAcorn: 'x',
      islandThanksDay: 'soon',
      weeklyBuy: 5,
      houseExpand: { villagerId: 'nobody', fund: -3, ready: 'x' },
      expanded: 'mocha',
      houseThanks: { id: 'ghost', day: 'x' },
      bank: { ...(oldSave().bank as object), coupons: { day: DAY, n: 99 } },
    }
    const s = migrateSave(broken)
    expect(s.islandAcorn).toEqual(NEW_ISLAND_GIFT)
    expect(s.islandThanksDay).toBeNull()
    expect(s.weeklyBuy).toBeNull()
    expect(s.houseExpand).toBeNull()
    expect(s.expanded).toEqual([])
    expect(s.houseThanks).toBeNull()
    expect(s.bank.coupons).toBeUndefined()
    expect(s.money).toBe(1234)
    expect(countOf(s.inventory, 'wood')).toBe(9)
    expect(s.home.stage).toBe(3)
  })

  it('저장이 통째로 비어 있어도 이행이 던지지 않고 새 게임 기본값을 준다', () => {
    const s = migrateSave({})
    expect(s.islandAcorn).toEqual(NEW_ISLAND_GIFT)
    expect(s.bank).toEqual(createBank(s.day))
    expect(s.expanded).toEqual([])
  })
})
