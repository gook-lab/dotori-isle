/**
 * 가구 리폼: 상점 2단계 이상의 리폼 코너에서 가구 하나를 색 변형으로 바꾼다.
 * 변형은 가구 인스턴스(주머니 칸, 방 가구)의 variant 칸에 적고, 색은 원래 색을 변형 색 쪽으로 섞어 낸다.
 * 순수 로직이라 React·Three 에 의존하지 않는다. 도감에는 변형을 적지 않는다(기본 가구 id 만 기록).
 */

import { ITEMS } from './items'

export interface Variant {
  id: string
  name: string
  /** 원래 색에 섞을 색 */
  color: string
  /** 섞는 비율(0~1). 높을수록 변형 색이 강하다. */
  mix: number
  /** 재질 마감만 주는 발광 색. 색 변형은 없고, 어두운 곳에서 살짝 빛나는 느낌을 준다. */
  emissive?: string
}

/** 리폼 색 변형 네 종. 목재 톤, 파스텔 두 종, 짙은색. */
export const VARIANTS: readonly Variant[] = [
  { id: 'honey', name: '꿀빛 목재', color: '#e0a862', mix: 0.55 },
  { id: 'mint', name: '민트 파스텔', color: '#9fdcc4', mix: 0.6 },
  { id: 'rose', name: '장미 파스텔', color: '#f2a7b8', mix: 0.6 },
  { id: 'charcoal', name: '짙은 숯색', color: '#4a4240', mix: 0.62 },
]

/**
 * 고급 마감(재질 변형). 도토리 백화점(상점 3단계) 이후에만 고를 수 있다. 색 변형과 같은 variant 칸을 쓰므로
 * 저장 모양과 주머니·보관함 합치기는 그대로다. 재질 값(색·발광)만 바꾸고, 셰이더는 새로 만들지 않는다.
 */
export const FINISHES: readonly Variant[] = [
  { id: 'gold', name: '금박 마감', color: '#e8c15a', mix: 0.6, emissive: '#3a2a08' },
  { id: 'glitter', name: '반짝이 마감', color: '#c9d8f0', mix: 0.5, emissive: '#2c3a52' },
]

/** 리폼 비용: 도토리는 가구 값의 40%(최소 20), 재료는 목재 1 */
export const REFORM_RATE = 0.4
export const REFORM_MIN_ACORNS = 20
export const REFORM_WOOD = 1
/** 리폼 코너가 열리는 상점 단계 */
export const REFORM_TIER = 2
/** 고급 마감이 열리는 상점 단계(도토리 백화점) */
export const ADVANCED_REFORM_TIER = 3
/** 고급 마감 도토리: 가구 값의 3배, 1,500~3,000 사이 */
export const ADVANCED_RATE = 3
export const ADVANCED_MIN_ACORNS = 1500
export const ADVANCED_MAX_ACORNS = 3000

export const isFinish = (id: string | null | undefined): boolean => FINISHES.some((f) => f.id === id)

export const variantById = (id: string | null | undefined): Variant | null => [...VARIANTS, ...FINISHES].find((v) => v.id === id) ?? null

/** 칸 이름: 색 변형이나 마감이 있으면 이름 앞에 그 첫 낱말을 붙인다. 예: 반짝이 모닥불, 꿀빛 나무 의자. 없으면 이름 그대로다. */
export function slotTitle(itemName: string, variantId: string | null | undefined): string {
  const v = variantById(variantId)
  return v ? `${v.name.split(' ')[0]} ${itemName}` : itemName
}

/** 리폼 비용 도토리. 가구가 아니면 null. */
export function reformAcorns(itemId: string): number | null {
  const def = ITEMS[itemId]
  if (!def || def.kind !== 'furniture') return null
  return Math.max(REFORM_MIN_ACORNS, Math.round(def.price * REFORM_RATE))
}

/** 고급 마감 도토리. 가구가 아니면 null. */
export function advancedAcorns(itemId: string): number | null {
  const def = ITEMS[itemId]
  if (!def || def.kind !== 'furniture') return null
  return Math.min(ADVANCED_MAX_ACORNS, Math.max(ADVANCED_MIN_ACORNS, Math.round(def.price * ADVANCED_RATE)))
}

/**
 * 리폼할 수 있는지: 가구이고, 있는 변형이고, 도토리와 목재가 충분할 때.
 * 고급 마감은 tier 가 도토리 백화점 이상이어야 하고, 도토리 값도 따로 센다.
 */
export function canReform(
  itemId: string,
  variantId: string,
  money: number,
  wood: number,
  tier: number = REFORM_TIER,
): { ok: true; acorns: number } | { ok: false; reason: string } {
  const basic = reformAcorns(itemId)
  if (basic === null) return { ok: false, reason: '가구만 리폼할 수 있어요' }
  if (!variantById(variantId)) return { ok: false, reason: '없는 색이에요' }
  if (isFinish(variantId) && tier < ADVANCED_REFORM_TIER) return { ok: false, reason: '도토리 백화점이 열리면 고급 마감을 할 수 있어요' }
  const acorns = isFinish(variantId) ? advancedAcorns(itemId) ?? basic : basic
  if (wood < REFORM_WOOD) return { ok: false, reason: '목재가 부족해요' }
  if (money < acorns) return { ok: false, reason: `도토리가 ${(acorns - money).toLocaleString()} 모자라요` }
  return { ok: true, acorns }
}

/** 두 색을 섞는다. t=0 이면 base, t=1 이면 tint. 입력은 #rrggbb 형식이다. */
export function mixHex(base: string, tint: string, t: number): string {
  const a = parseHex(base)
  const b = parseHex(tint)
  const ch = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t)
  return `#${[ch(0), ch(1), ch(2)].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 저장된 변형 값을 믿을 수 있는 것만 남긴다. 모르는 값은 기본(없음)이 된다. */
export function sanitizeVariant(raw: unknown): string | undefined {
  return typeof raw === 'string' && variantById(raw) ? raw : undefined
}
