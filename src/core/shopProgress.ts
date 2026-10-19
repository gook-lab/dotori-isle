/**
 * 상점 단계 진행 안내. 상점 패널 맨 위의 "다음 단계까지" 줄과 가게 탭의 "새로 파는 물건" 줄을 만든다.
 * 조건과 진열은 shopTiers 를 그대로 쓰고, 여기서는 문장만 고른다. 모든 함수는 순수하다.
 */

import { formatMiles } from './miles'
import { newItemsAt, tierDef, unlockChecks, unlockedFor, type ShopStats, type ShopTier, type UnlockCheck } from './shopTiers'

/** 조건 한 줄을 짧은 목표 문구로 바꾼다. 판매·지출·별점은 현재/목표 숫자를 붙인다. */
function goalText(c: UnlockCheck): string {
  if (c.label.includes('팔기')) return `판매 ${c.have.toLocaleString()}/${c.need.toLocaleString()}`
  if (c.label.includes('쓰기')) return `지출 ${c.have.toLocaleString()}/${c.need.toLocaleString()}`
  if (c.label.includes('별점')) return `별점 ${c.have}/${c.need}★`
  return c.label
}

/**
 * 상점 패널 맨 위 줄. 다음 단계의 조건 가운데 아직 못 채운 첫 조건을 보여 준다.
 * 가장 큰 가게면 null 이다(다음 단계가 없다).
 */
export function nextTierLine(tier: ShopTier, stats: ShopStats): string | null {
  if (tier >= 3) return null
  const next = tierDef((tier + 1) as ShopTier)
  const unmet = unlockChecks(next.tier, stats).find((c) => !c.done)
  if (!unmet) return `다음 단계(${next.name})의 조건을 다 채웠어요. 가게 탭에서 올려요`
  return `다음 단계(${next.name})까지: ${goalText(unmet)}`
}

/** 가장 큰 백화점 상점 창 맨 위 줄. 올릴 단계는 없어도 매일의 진열과 이달의 가구로 계속 들른다. */
export const TOP_TIER_LINE = '가장 큰 백화점이에요. 매일 진열이 바뀌고 매달 이달의 가구가 들어와요'
/** 가게 탭에서 최고 단계일 때 카드 아래에 두는 안내. 계속할 일(리폼, 주문)을 가리킨다. */
export const TOP_TIER_UPGRADE_NOTE = '더 올릴 단계는 없어요. 리폼 코너에서 가구 색을 바꾸고, 주문 탭에서 가구를 주문할 수 있어요'
/** 최고 단계 편지 끝에 붙이는 한 줄. 편지가 끝나도 할 일이 있다는 것을 알려 준다. */
export const TOP_TIER_LETTER_LINE = '여기가 가장 큰 가게예요. 이제 매일 진열과 이달의 가구를 구경해 보세요.'

/** 상점 패널 맨 위 줄. 다음 단계 조건을 보여 주고, 최고 단계에서는 계속할 거리를 보여 준다(빈 줄을 남기지 않는다). */
export function shopNextLine(tier: ShopTier, stats: ShopStats): string | null {
  return tier >= 3 ? TOP_TIER_LINE : nextTierLine(tier, stats)
}

/** 가게 탭의 "새로 파는 물건" 줄. 그 단계에서 처음 진열되는 물건 이름을 쉼표로 잇는다. 없으면 null 이다. */
export function newItemsLine(tier: ShopTier): string | null {
  const names = newItemsAt(tier)
  if (names.length === 0) return null
  return `새로 파는 물건: ${names.join(', ')}`
}

/**
 * 새로 들인 물건 이름을 최대 max 개까지 잇고, 나머지는 "외 N가지"로 줄인다. 없으면 null 이다.
 * 점장 편지와 상점 패널이 같은 방식으로 적어서 긴 목록이 줄을 넘치지 않게 한다.
 */
export function newItemsHighlight(names: readonly string[], max = 3): string | null {
  if (names.length === 0) return null
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} 외 ${names.length - max}가지` : shown
}

/** 상점 패널의 "이번 단계에서 새로 들인 물건" 줄. 이 단계에서 처음 진열된 물건이 없으면 null 이다(노점). */
export function currentNewLine(tier: ShopTier): string | null {
  const names = newItemsHighlight(newItemsAt(tier))
  return names ? `이번 단계에서 새로 들인 물건: ${names}` : null
}

/** 재개장 아침 "문을 열었어요" 알림. 마일 보상이 있으면 뒤에 붙인다. 리본 연출과 같은 날 뜬다. */
export function shopReopenText(name: string, miles: number): string {
  return `🏪 ${name} 문을 열었어요!${miles ? ` 🏅 ${formatMiles(miles)}` : ''}`
}

/** 집 상담 안내 문구: 대출 없이 노점인데 가게 조건을 채웠을 때 짓기 전에 한 번 권한다. */
export const SHOP_FIRST_HINT = '대출을 받으면 다 갚을 때까지 가게를 올릴 수 없어요. 가게부터 올리면 판매가 더 빨라져요'

/**
 * 가게를 먼저 올리라는 안내를 보일지. 대출이 0이고, 상점이 아직 노점이고(공사 중이 아니고), 가게 올리기 조건을 채웠을 때만 보인다.
 * 짓기 버튼은 막지 않는다. 안내 문구만 돌려준다.
 */
export function shopFirstHint(p: { loan: number; tier: ShopTier; pending: boolean; stats: ShopStats }): string | null {
  if (p.loan > 0 || p.tier !== 0 || p.pending) return null
  return unlockedFor(1, p.stats) ? SHOP_FIRST_HINT : null
}
