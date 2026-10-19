import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { SHOP_LETTER_GIFT, shopUpgradeLetter } from './letters'
import { newItemsAt } from './shopTiers'
import { newItemsHighlight, TOP_TIER_LETTER_LINE } from './shopProgress'

describe('점장 편지', () => {
  it('큰 가게 선물은 가구이고, 백화점 선물도 실제 물건이다', () => {
    expect(ITEMS[SHOP_LETTER_GIFT[2]]?.kind).toBe('furniture')
    // 백화점에서 새로 나온 물건은 가구가 아니다(종이 등불은 id 가 두 번 정의돼 재료로 잡힌다)
    expect(ITEMS[SHOP_LETTER_GIFT[3]]).toBeDefined()
  })

  it('단계에서 처음 들여온 물건만 알린다', () => {
    const two = newItemsAt(2)
    expect(two).toEqual(expect.arrayContaining([ITEMS.campfire.name, ITEMS.stove.name, ITEMS.wardrobe.name]))
    // 서랍장은 가게(1단계)에서 이미 들여왔으니 큰 가게 소식에 또 나오지 않는다
    expect(two).not.toContain(ITEMS.drawer.name)
    expect(newItemsAt(0)).toEqual([])
  })

  it('편지는 점장이 보내고, 고마움과 새 물건과 선물을 해요체로 담는다', () => {
    const l = shopUpgradeLetter('2026-03-12', 2, ['모닥불', '옷장'], 'campfire')
    expect(l.id).toBe('shop-tier-2')
    expect(l.fromName).toBe('점장')
    expect(l.gift).toBe('campfire')
    expect(l.read).toBe(false)
    expect(l.claimed).toBe(false)
    expect(l.text).toContain('큰 가게로 키워 주셔서 정말 고마워요')
    expect(l.text).toContain('모닥불, 옷장을 새로 들여왔어요')
    expect(l.text).toContain(`작은 선물로 ${ITEMS.campfire.icon} 모닥불을 넣어 뒀어요`)
    expect(l.text).toMatch(/요[.!]/)
  })

  it('새로 들여온 물건이 없으면 소개 문장을 빼고 보낸다', () => {
    const l = shopUpgradeLetter('2026-03-12', 3, [], 'paper-lantern')
    expect(l.id).toBe('shop-tier-3')
    expect(l.text).toContain('도토리 백화점으로 키워 주셔서')
    expect(l.text).not.toContain('새로 들여왔어요')
  })
})

describe('점장 편지의 새 물건 문구', () => {
  it('새로 들인 물건은 최대 세 개만 이름으로 적고 나머지는 외 N가지로 줄인다', () => {
    for (const tier of [2, 3] as const) {
      const names = newItemsAt(tier)
      const letter = shopUpgradeLetter('2026-11-14', tier, names, SHOP_LETTER_GIFT[tier])
      expect(letter.text).toContain(`${newItemsHighlight(names)!}`)
      if (names.length > 3) expect(letter.text).toContain(`외 ${names.length - 3}가지`)
    }
  })
})

describe('가장 큰 백화점 편지', () => {
  it('백화점 편지 끝에는 계속할 일을 한 줄 붙이고, 큰 가게 편지에는 붙이지 않는다', () => {
    expect(shopUpgradeLetter('2026-11-14', 3, [], SHOP_LETTER_GIFT[3]).text).toContain(TOP_TIER_LETTER_LINE)
    expect(shopUpgradeLetter('2026-11-14', 2, [], SHOP_LETTER_GIFT[2]).text).not.toContain(TOP_TIER_LETTER_LINE)
  })
})
