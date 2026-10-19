import { describe, expect, it } from 'vitest'
import { ITEMS } from '../core/items'
import { VILLAGERS } from '../core/villagers'
import { activeObjective, houseLine, houseShortfall, idleObjectiveLine } from './objective'

const base = { day: '2026-10-18', dailyBase: {}, dailyClaimed: [] as string[] }

describe('activeObjective', () => {
  it('shows an actionable quest goal before the time-gated bloom goal', () => {
    const o = activeObjective({ ...base, quests: [{ id: 'blossom', baseline: {} }, { id: 'materials', baseline: {} }], stats: {} })
    expect(o?.quest.id).toBe('materials')
    expect(o?.goal.goal.label).toBe('목재 모으기')
  })

  it('falls back to the bloom goal with its how-to tip when nothing else is open', () => {
    const o = activeObjective({ ...base, quests: [{ id: 'blossom', baseline: {} }], stats: { bloom: 1 } })
    expect(o?.ready).toBe(false)
    expect(o?.goal.goal.label).toBe('꽃 피우기')
    expect(o?.goal.current).toBe(1)
    expect(o?.goal.goal.slow).toBe('매일 물 주기')
  })

  it('offers the reward first when a quest is complete', () => {
    const o = activeObjective({ ...base, quests: [{ id: 'blossom', baseline: {} }, { id: 'materials', baseline: {} }], stats: { bloom: 3, chop: 10, rock: 6 } })
    expect(o?.ready).toBe(true)
    expect(o?.quest.id).toBe('blossom')
  })

  it('returns null when no story quest is active', () => {
    expect(activeObjective({ ...base, quests: [], stats: {} })).toBeNull()
  })
})

describe('houseLine', () => {
  const cost = VILLAGERS.find((v) => v.id === 'bomi')!.cost
  const full = Object.entries(cost).map(([id, n]) => ({ id, count: n }))

  it('모자란 재료만 현재/필요로 보여 준다', () => {
    const inv = [{ id: 'wood', count: 2 }, { id: 'stone', count: cost.stone }]
    const line = houseLine('bomi', inv)
    expect(line).toBe(`🏠 봄이 집 · ${ITEMS.wood.icon}2/${cost.wood} ${ITEMS.iron.icon}0/${cost.iron}`)
  })

  it('재료가 다 있으면 준비 완료를 알린다', () => {
    expect(houseLine('bomi', full)).toBe('🏠 봄이 집 짓기 · 재료 준비 완료')
    expect(houseShortfall('bomi', full)).toEqual([])
  })
})

describe('idleObjectiveLine', () => {
  it('shows the next unlock hint when there is one', () => {
    expect(idleObjectiveLine('다음에 열려요 · 집 상담: 집을 짓고 싶으면')).toBe('다음에 열려요 · 집 상담: 집을 짓고 싶으면')
  })

  it('never returns an empty line, so the HUD still tells the player where to look', () => {
    const line = idleObjectiveLine(null)
    expect(line.length).toBeGreaterThan(0)
    expect(line).toContain('휴대폰')
  })
})
