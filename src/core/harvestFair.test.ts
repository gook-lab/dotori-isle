import { describe, expect, it } from 'vitest'
import type { Personality } from './chat'
import { newsFor } from '../game/news'
import { ITEMS } from './items'
import { NEW_SHOP } from './shopTiers'
import {
  harvestAskLines,
  harvestFairLetter,
  harvestFurnitureFor,
  harvestNoneLines,
  harvestThanksLetter,
  harvestThanksLines,
  HARVEST_DAY_LINE,
  HARVEST_EVE_LINE,
  HARVEST_FURNITURE,
  HARVEST_REWARD_MONEY,
  isHarvestFairDay,
  isHarvestFairEve,
  isHarvestFairHour,
  isHarvestGift,
  pickHarvestGift,
} from './harvestFair'

const home = { stage: 0 as const, loan: 0, order: null }
const PERSONALITIES: Personality[] = ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy']

describe('도토리 감사 장날 날짜', () => {
  it('셋째 주 토요일만 장날이다(2026년 11월 21일)', () => {
    expect(isHarvestFairDay('2026-11-21')).toBe(true)
    expect(isHarvestFairDay('2026-11-14')).toBe(false) // 둘째 주 토요일
    expect(isHarvestFairDay('2026-11-22')).toBe(false) // 셋째 주 일요일
    expect(isHarvestFairDay('2026-10-17')).toBe(false) // 다른 달
  })

  it('장날 전날에 방송이 나간다', () => {
    expect(isHarvestFairEve('2026-11-20')).toBe(true)
    expect(isHarvestFairEve('2026-11-21')).toBe(false)
  })

  it('낮 10시부터 16시까지만 장이 선다', () => {
    expect(isHarvestFairHour('2026-11-21', 9)).toBe(false)
    expect(isHarvestFairHour('2026-11-21', 10)).toBe(true)
    expect(isHarvestFairHour('2026-11-21', 15)).toBe(true)
    expect(isHarvestFairHour('2026-11-21', 16)).toBe(false)
    expect(isHarvestFairHour('2026-11-14', 12)).toBe(false)
  })

  it('장날 아침 방송과 편지가 나온다', () => {
    expect(newsFor({ day: '2026-11-20', houses: [], shop: NEW_SHOP, home })).toContain(HARVEST_EVE_LINE)
    expect(newsFor({ day: '2026-11-21', houses: [], shop: NEW_SHOP, home })).toContain(HARVEST_DAY_LINE)
    expect(newsFor({ day: '2026-11-19', houses: [], shop: NEW_SHOP, home }).join(' ')).not.toContain('감사 장날')
    expect(harvestFairLetter('2026-11-21')).toMatchObject({ id: 'harvest-fair-2026-11-21', from: 'committee', gift: null })
    expect(HARVEST_DAY_LINE).toContain('도토리 감사 장날')
  })
})

describe('수확물과 답례', () => {
  it('과일과 요리만 건넬 수 있다', () => {
    expect(isHarvestGift('peach')).toBe(true)
    expect(isHarvestGift('dish-fruit-pie')).toBe(true)
    expect(isHarvestGift('candy')).toBe(false)
    expect(isHarvestGift('wood')).toBe(false)
  })

  it('가방에서 처음 찾은 수확물을 고른다', () => {
    const inv = [
      { id: 'wood', count: 3 },
      { id: 'orange', count: 1 },
      { id: 'peach', count: 2 },
    ]
    expect(pickHarvestGift(inv)).toBe('orange')
    expect(pickHarvestGift([{ id: 'wood', count: 3 }])).toBeNull()
  })

  it('답례 가구는 주민과 날짜로 늘 같게 정해진다', () => {
    const a = harvestFurnitureFor('2026-11-21:mocha')
    expect(harvestFurnitureFor('2026-11-21:mocha')).toBe(a)
    expect(HARVEST_FURNITURE).toContain(a)
    const picks = new Set(['mocha', 'bomi', 'pengdol', 'guriguri', 'dongri', 'bori'].map((v) => harvestFurnitureFor(`2026-11-21:${v}`)))
    expect(picks.size).toBe(2)
  })

  it('답례 가구와 바구니 정의가 있고 가구로 놓을 수 있다', () => {
    for (const id of HARVEST_FURNITURE) {
      expect(ITEMS[id]).toMatchObject({ kind: 'furniture', stack: 1 })
    }
    expect(HARVEST_REWARD_MONEY).toBeGreaterThan(0)
  })

  it('답례 편지는 받는 주민과 가구를 담는다', () => {
    const l = harvestThanksLetter('2026-11-21', { id: 'bomi', name: '보미' }, 'harvest-basket')
    expect(l).toMatchObject({ id: 'harvest-thanks-2026-11-21-bomi', from: 'bomi', fromName: '보미', gift: 'harvest-basket' })
  })

})

describe('장날 대화 줄', () => {
  it('성격마다 요청·고마움·아쉬움 두 줄씩 다르다', () => {
    for (const p of PERSONALITIES) {
      expect(harvestAskLines(p)).toHaveLength(2)
      expect(harvestThanksLines(p, '수확 바구니🧺')).toHaveLength(2)
      expect(harvestNoneLines(p)).toHaveLength(2)
      expect(new Set(harvestAskLines(p)).size).toBe(2)
    }
    expect(new Set(PERSONALITIES.map((p) => harvestAskLines(p)[0])).size).toBe(PERSONALITIES.length)
  })

  it('고마움 줄에 답례 가구 이름이 들어간다', () => {
    for (const p of PERSONALITIES) {
      expect(harvestThanksLines(p, '도토리 화환🌰').join(' ')).toContain('도토리 화환🌰')
    }
  })
})
