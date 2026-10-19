import { describe, expect, it } from 'vitest'
import { newItemsAt, SHOP_TIERS, tierDef, unlockChecks, type ShopStats, type ShopTier } from './shopTiers'
import { currentNewLine, newItemsHighlight, newItemsLine, nextTierLine, SHOP_FIRST_HINT, shopFirstHint, shopNextLine, shopReopenText, TOP_TIER_LINE } from './shopProgress'
import { dailyStock } from './shopTiers'
import { monthlyFurniture } from './shopEvents'

const EMPTY: ShopStats = { sold: 0, spent: 0, questsDone: [] }

describe('상점 단계 진행 안내', () => {
  it('다음 단계까지 판매 몇 개가 남았는지 맨 위 줄에 보여 준다', () => {
    const need = unlockChecks(1, EMPTY).find((c) => c.label.includes('팔기'))!.need
    const line = nextTierLine(0, EMPTY)!
    expect(line).toContain(`다음 단계(${SHOP_TIERS[1].name})까지`)
    expect(line).toContain(`판매 0/${need.toLocaleString()}`)
  })

  it('판매 조건을 넘기면 판매 숫자가 목표에 맞춰 바뀐다', () => {
    const need = unlockChecks(1, EMPTY).find((c) => c.label.includes('팔기'))!.need
    const half = { ...EMPTY, sold: Math.floor(need / 2) }
    expect(nextTierLine(0, half)).toContain(`판매 ${Math.floor(need / 2).toLocaleString()}/`)
  })

  it('조건을 다 채우면 가게 탭에서 올리라고 알려 준다', () => {
    const quest = tierDef(1).unlock.quest
    const full = { sold: 1e9, spent: 1e9, questsDone: quest ? [quest] : [], stars: 99 }
    expect(nextTierLine(0, full)).toContain('조건을 다 채웠어요')
  })

  it('가장 큰 가게에는 다음 단계 줄이 없다', () => {
    expect(nextTierLine(3, EMPTY)).toBeNull()
  })

  it('새로 파는 물건 줄은 그 단계에서 처음 진열되는 이름이다', () => {
    const names = newItemsAt(1)
    expect(names.length).toBeGreaterThan(0)
    expect(newItemsLine(1)).toBe(`새로 파는 물건: ${names.join(', ')}`)
    expect(newItemsLine(0)).toBeNull()
  })
})

describe('가게부터 올리라는 안내', () => {
  const quest = tierDef(1).unlock.quest
  const READY: ShopStats = { sold: 1e9, spent: 0, questsDone: quest ? [quest] : [], stars: 0 }
  const base = { loan: 0, tier: 0 as ShopTier, pending: false, stats: READY }

  it('대출이 0이고 노점이고 조건을 채우면 안내를 보인다', () => {
    expect(shopFirstHint(base)).toBe(SHOP_FIRST_HINT)
  })

  it('대출이 남아 있으면 안내를 보이지 않는다', () => {
    expect(shopFirstHint({ ...base, loan: 1 })).toBeNull()
  })

  it('가게 이상이면 안내를 보이지 않는다', () => {
    expect(shopFirstHint({ ...base, tier: 1 })).toBeNull()
  })

  it('공사 중이면 안내를 보이지 않는다', () => {
    expect(shopFirstHint({ ...base, pending: true })).toBeNull()
  })

  it('가게 올리기 조건을 아직 못 채웠으면 안내를 보이지 않는다', () => {
    expect(shopFirstHint({ ...base, stats: { sold: 0, spent: 0, questsDone: [] } })).toBeNull()
  })
})

describe('재개장·새 물건 문구', () => {
  it('새로 들인 물건은 최대 세 개까지 이름으로 적고 나머지는 외 N가지로 줄인다', () => {
    expect(newItemsHighlight([])).toBeNull()
    expect(newItemsHighlight(['가', '나'])).toBe('가, 나')
    expect(newItemsHighlight(['가', '나', '다'])).toBe('가, 나, 다')
    expect(newItemsHighlight(['가', '나', '다', '라', '마'])).toBe('가, 나, 다 외 2가지')
  })

  it('노점은 새 물건 줄이 없고, 가게 이상은 이번 단계에서 들인 물건을 적는다', () => {
    expect(currentNewLine(0)).toBeNull()
    for (const tier of [1, 2, 3] as const) {
      const line = currentNewLine(tier)
      expect(line).toMatch(/^이번 단계에서 새로 들인 물건: /)
      const names = newItemsAt(tier)
      expect(line).toContain(newItemsHighlight(names)!)
    }
  })

  it('재개장 알림은 마일 보상이 있을 때만 마일을 붙인다', () => {
    expect(shopReopenText('큰 가게', 200)).toBe('🏪 큰 가게 문을 열었어요! 🏅 200마일')
    expect(shopReopenText('가게', 0)).toBe('🏪 가게 문을 열었어요!')
  })
})

describe('가장 큰 백화점 이후 상점 문구', () => {
  it('최고 단계에서는 다음 단계 조건 대신 계속할 거리를 한 줄로 보여 준다', () => {
    expect(shopNextLine(3, EMPTY)).toBe(TOP_TIER_LINE)
    expect(shopNextLine(2, EMPTY)).toBe(nextTierLine(2, EMPTY))
  })

  it('백화점 줄이 약속하는 것(매일 진열이 바뀌고 매달 이달의 가구가 있다)이 실제로 그렇다', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
    const stocks = new Set(days.map((d) => dailyStock(3, d).map((e) => e.itemId).join(',')))
    expect(stocks.size).toBeGreaterThan(1)
    for (const m of ['2026-10', '2026-11', '2026-12']) expect(monthlyFurniture(`${m}-05`)).not.toBeNull()
  })
})
