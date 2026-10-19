/**
 * 도토리 상점 단계 — 노점 → 가게 → 큰 가게 → 도토리 백화점.
 *
 * 상점은 처음에 노점이고, 도토리를 많이 팔고 퀘스트를 채우면 한 단계씩 올릴 수 있다.
 * 올리면 하루 동안 공사로 문이 닫히고, 그다음 날 새 간판과 더 많은 진열로 다시 연다.
 * 진열 후보는 ITEMS 에 buy 값이 있는 물건만 쓴다(상점 가격의 단일 출처는 items.ts).
 *
 * 숫자 근거(현재 경제):
 * - 팔기 수입은 나무 흔들기 복숭아 20, 물고기 40~400, 벌레 30~220 이라 중반에 하루 600~1500 도토리 정도다.
 *   그래서 1단계 비용 1500 은 이틀 치, 2단계 6000 은 일주일 치 수입이다.
 * - 1단계 조건 "팔기 1000" 은 업적 `earn` 의 첫 단계와 같다. 상점을 조금 써 본 사람만 올릴 수 있다.
 * - 2단계 조건 "구매 1500" 은 화분·의자 두세 개 값이라, 가구를 실제로 들여 본 사람에게 연다.
 */

import { ITEMS } from './items'
import { limitedEntry } from './weeklyLimited'
import { addDays, BAD_DAY, dayDiff, dayIndex, type Result } from './economy'
import { hashString, mulberry32 } from './rng'
import { flashIndex, FLASH_RATE, isFlashDay } from './shopEvents'
import { CANDY_ID, CANDY_PRICE, isCandyWeek } from './pumpkin'

export type ShopTier = 0 | 1 | 2 | 3

/** 상점 건물 모양. 씬이 상자 크기와 지붕·간판만 그리면 된다. */
export interface BuildingLook {
  /** 가로·세로(섬 좌표 단위). 현재 상점 상자는 5×4 다. */
  w: number
  d: number
  /** 지붕 꼭대기까지 높이 */
  h: number
  roof: string
  wall: string
  /** 차양 색. 노점은 천막 차양 대신 null 로 두어 씬이 따로 그린다. */
  awning: string | null
  /** 간판 색 글씨 */
  sign: string
  /** 층수. 2층이면 위층 벽과 창문을 더 올린다. 기본 1층. */
  floors?: 1 | 2
  /** 처마 옆에 거는 작은 나무 간판. 큰 간판이 차양에 가려지는 단계에서 쓴다. */
  hangSign?: boolean
  /** 큰 간판을 차양 앞으로 뺀다. 차양 뒤에 있으면 윗단 글자가 가려지는 단계에서 쓴다. */
  signFront?: boolean
  /** 지붕 앞면의 다락 창. 실루엣으로 단계를 구분한다. */
  dormer?: boolean
  /** 건물 앞 화분 줄. 차양 위 지붕이 잘려 보이는 기본 카메라에서도 단계가 보이게 한다. */
  planters?: boolean
}

/** 단계를 올리는 조건. 0 은 아무 조건 없음. */
export interface ShopUnlock {
  /** 지금까지 상점에 판 도토리 합계 (통계 `earn`) */
  sold: number
  /** 상점에서 산 도토리 합계 (새 통계 `spent`) */
  spent: number
  /** 끝내야 하는 메인 퀘스트 id. 없으면 조건 없음. */
  quest: string | null
  /** 섬 별점 최소(★). 없으면 조건 없음. */
  stars?: number
}

export interface ShopTierDef {
  tier: ShopTier
  name: string
  unlock: ShopUnlock
  /** 이 단계로 올리는 데 드는 도토리(시작 단계는 0) */
  upgradeCost: number
  /** 하루에 진열하는 물건 수. 후보보다 많지 않게 맞춘다. */
  stockSize: number
  /** 진열 후보. 매일 이 안에서 stockSize 개를 고른다. */
  pool: readonly string[]
  look: BuildingLook
}

export const SHOP_TIERS: readonly ShopTierDef[] = [
  {
    tier: 0,
    name: '노점',
    unlock: { sold: 0, spent: 0, quest: null },
    upgradeCost: 0,
    // 후보 세 개 중 두 개만 보여, 처음 며칠은 매일 고르는 재미가 있다.
    stockSize: 2,
    pool: ['flower-seed', 'flowerpot', 'chair', 'umbrella-red', 'umbrella-blue', 'umbrella-yellow'],
    look: { w: 3, d: 2.5, h: 2.2, roof: '#c8553d', wall: '#e9d2a6', awning: null, sign: '도토리 상점 · 노점' },
  },
  {
    tier: 1,
    name: '가게',
    unlock: { sold: 1000, spent: 0, quest: 'materials' },
    // 1500 = 중반 이틀 치 수입. 집 짓기 재료(목재·돌)를 모은 뒤 "집 지을 재료" 퀘스트를 깬 시점이 맞다.
    upgradeCost: 1500,
    stockSize: 4,
    // 철광석은 바위에서만 나와 집 재료가 모자랄 때 사는 길이다. 판매가 80 의 3배.
    pool: ['flower-seed', 'flowerpot', 'chair', 'mailbox', 'table', 'lamp', 'iron', 'drawer'],
    look: { w: 5, d: 4, h: 3, roof: '#8c5a3c', wall: '#f4e4c1', awning: '#f2a541', sign: '도토리 상점 · 가게', hangSign: true },
  },
  {
    tier: 2,
    name: '큰 가게',
    unlock: { sold: 10000, spent: 1500, quest: 'newcomer-guriguri' },
    // 6000 = 일주일 치 수입. 2단계는 가구 전체(7종)를 진열해 마지막 목표가 된다.
    upgradeCost: 6000,
    stockSize: 5,
    // 작은 화덕은 큰 가게에서만 판다(요리 창을 여는 집 가구)
    pool: ['flower-seed', 'flowerpot', 'chair', 'mailbox', 'table', 'lamp', 'campfire', 'iron', 'stove', 'drawer', 'wardrobe', 'bookshelf', 'reading-chair', 'floor-lamp', 'globe', 'workbench', 'tool-rack', 'storage-shelf', 'boiler', 'wall-clock', 'wall-shelf'],
    look: { w: 6.5, d: 5, h: 3.8, roof: '#3f6e5a', wall: '#fff6e3', awning: '#e2412f', sign: '도토리 상점 · 큰 가게', dormer: true, planters: true, signFront: true },
  },
  {
    tier: 3,
    name: '도토리 백화점',
    // 누적 판매 3만 = 큰 가게 이후 한 달 남짓 수입. 구매 6000 은 큰 가게 값의 한 번 치. 섬 별점 3★ 은 집과 섬 가꾸기를 어느 정도 했다는 뜻이다.
    unlock: { sold: 30000, spent: 6000, quest: null, stars: 3 },
    // 1만 5천 = 중반 수입으로 며칠 치. 진열 두 배를 대는 값이라 가게를 오래 키운 사람에게 연다.
    upgradeCost: 15000,
    // 큰 가게(5)의 두 배
    stockSize: 10,
    // 큰 가게 진열(서랍장·옷장 포함) 열한 가지에 백화점 가구 네 가지를 더해 열다섯 가지 가운데 열 개를 고른다. 우산은 노점에서만 판다.
    pool: ['flower-seed', 'flowerpot', 'chair', 'mailbox', 'table', 'lamp', 'campfire', 'stove', 'iron', 'drawer', 'wardrobe', 'basket', 'wind-chime', 'lantern-hanging', 'bonsai', 'bookshelf', 'reading-chair', 'floor-lamp', 'globe', 'workbench', 'tool-rack', 'storage-shelf', 'boiler', 'wall-clock', 'wall-shelf'],
    look: { w: 8.5, d: 6, h: 5.4, roof: '#2f5f8a', wall: '#fffaf0', awning: '#2a9d8f', sign: '도토리 상점 · 백화점', floors: 2 },
  },
]

/** 지금 어느 단계인지와 올리는 중인지. 저장 대상. */
export interface ShopState {
  tier: ShopTier
  /** 공사를 맡긴 날과 목표 단계. 없으면 공사 중이 아니다. */
  order: { to: ShopTier; day: string } | null
}

export const NEW_SHOP: ShopState = { tier: 0, order: null }

/** 공사 첫날(맡긴 다음 날)에 문을 닫는다. 그다음 날 새 단계로 연다. */
export const CLOSED_DAYS = 1
/** 오늘의 특가 할인율. 매일 진열 하나를 골라 깎는다. 20% 는 사고 싶게 하면서 한 번에 큰 이익은 안 주는 선. */
export const SALE_OFF = 0.2

export interface ShopStats {
  sold: number
  spent: number
  questsDone: readonly string[]
  /** 이번 주 섬 별점(★). 없으면 0 으로 본다. */
  stars?: number
}

export interface UnlockCheck {
  label: string
  have: number
  need: number
  done: boolean
}

export function isShopTier(n: unknown): n is ShopTier {
  return n === 0 || n === 1 || n === 2 || n === 3
}

export function tierDef(tier: ShopTier): ShopTierDef {
  return SHOP_TIERS[tier]
}

/** 단계별 조건을 하나씩 나눠 보여 준다. 수첩이나 상점 안내판에 그대로 쓴다. */
export function unlockChecks(tier: ShopTier, stats: ShopStats): UnlockCheck[] {
  const u = tierDef(tier).unlock
  const checks: UnlockCheck[] = [
    { label: `도토리 ${u.sold.toLocaleString()}개 팔기`, have: Math.min(stats.sold, u.sold), need: u.sold, done: stats.sold >= u.sold },
    { label: `도토리 ${u.spent.toLocaleString()}개 쓰기`, have: Math.min(stats.spent, u.spent), need: u.spent, done: stats.spent >= u.spent },
  ]
  if (u.quest) {
    const done = stats.questsDone.includes(u.quest)
    checks.push({ label: '메인 퀘스트 끝내기', have: done ? 1 : 0, need: 1, done })
  }
  if (u.stars) {
    const have = Math.min(stats.stars ?? 0, u.stars)
    checks.push({ label: `섬 별점 ${u.stars}★ 이상`, have, need: u.stars, done: have >= u.stars })
  }
  // 조건 0 인 칸(노점)은 표시할 게 없으니 걸러 준다.
  return checks.filter((c) => c.need > 0)
}

export function unlockedFor(tier: ShopTier, stats: ShopStats): boolean {
  return unlockChecks(tier, stats).every((c) => c.done)
}

/** 조건을 채운 가장 높은 단계. 공사 중인지와는 상관없이 "올릴 자격"만 본다. */
export function shopTierFor(stats: ShopStats): ShopTier {
  for (const t of [3, 2, 1, 0] as const) if (unlockedFor(t, stats)) return t
  return 0
}

export interface StockEntry {
  itemId: string
  name: string
  icon: string
  /** 상점 가격(할인 적용). 10 단위로 맞춘다. */
  price: number
  /** 정가 */
  basePrice: number
  sale: boolean
  /** 금요일 반짝 할인 칸(정가의 절반) */
  flash: boolean
  /** 주간 한정 칸(월요일에 올라와 한 주에 한 번만 살 수 있다). 없으면 일반 칸이다. */
  weekly?: boolean
  /** 미리 입힌 마감(variant). 한정 칸만 가진다. 주머니에 마감이 붙은 채 들어간다. */
  variant?: string
}

/**
 * 그날의 진열. 날짜 키와 단계로 시드를 정해 같은 날이면 늘 같다(새로고침해도 안 바뀐다).
 * 후보를 섞어 stockSize 개를 고르고, 그중 하나를 특가로 둔다.
 * 잘못된 단계나 날짜면 빈 배열이다.
 */
/** 호박 등불 행사 주간에는 사탕을 진열에 한 칸 더 올린다(도토리 상점). 문이 열린 날만 판다. */
export function dailyStock(tier: number, day: string): StockEntry[] {
  const base = baseStock(tier, day)
  if (!isShopTier(tier) || dayIndex(day) === null || !isCandyWeek(day)) return base
  const item = ITEMS[CANDY_ID]
  return [...base, { itemId: CANDY_ID, name: item.name, icon: item.icon, price: CANDY_PRICE, basePrice: CANDY_PRICE, sale: false, flash: false }]
}

/** 손님이 보는 진열대: 그날 진열에 주간 한정 칸을 맨 끝에 붙인다. 한정 칸은 월요일부터 다음 월요일 전까지 있다. */
export function shopStock(tier: number, day: string): StockEntry[] {
  const base = dailyStock(tier, day)
  const lim = isShopTier(tier) ? limitedEntry(tier, day) : null
  return lim ? [...base, lim] : base
}

function baseStock(tier: number, day: string): StockEntry[] {
  if (!isShopTier(tier) || dayIndex(day) === null) return []
  const def = tierDef(tier)
  const rng = mulberry32(hashString(`shop:${tier}:${day}`))
  // Fisher-Yates 로 섞는다. 같은 시드면 같은 순서가 나온다.
  const pool = [...def.pool]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const picked = pool.slice(0, def.stockSize)
  const saleIndex = Math.floor(rng() * picked.length)
  // 금요일엔 반짝 할인이 진열 하나를 절반으로 깎고, 그날의 보통 특가는 쉰다.
  const flash = isFlashDay(day) ? flashIndex(day, picked.length) : -1
  return picked.flatMap((id, i) => {
    const item = ITEMS[id]
    if (!item || item.buy === undefined) return []
    const onFlash = i === flash
    const sale = onFlash || (flash < 0 && i === saleIndex)
    // 특가는 10 단위로 반올림해 "32 도토리" 같은 어색한 값을 피한다.
    const price = onFlash ? Math.round((item.buy * FLASH_RATE) / 10) * 10 : sale ? Math.round((item.buy * (1 - SALE_OFF)) / 10) * 10 : item.buy
    return [{ itemId: id, name: item.name, icon: item.icon, price, basePrice: item.buy, sale, flash: onFlash }]
  })
}

/** 공사 상태를 날짜에 맞춰 풀어 본다. 저장은 하지 않는다. */
export type ShopStatus =
  | { status: 'open'; tier: ShopTier }
  | { status: 'closed'; tier: ShopTier; to: ShopTier; reopenDay: string }

export function upgradeState(state: ShopState, day: string): ShopStatus {
  const diff = state.order ? dayDiff(state.order.day, day) : null
  if (!state.order || diff === null || diff < 0 || diff === 0) return { status: 'open', tier: state.tier }
  if (diff <= CLOSED_DAYS) {
    return { status: 'closed', tier: state.tier, to: state.order.to, reopenDay: addDays(state.order.day, CLOSED_DAYS + 1) ?? day }
  }
  return { status: 'open', tier: state.order.to }
}

/** 공사가 끝난 날이면 새 단계로 바꾸고 공사 기록을 지운다. 끝나지 않았으면 그대로. */
export function settleUpgrade(state: ShopState, day: string): ShopState {
  const s = upgradeState(state, day)
  if (!state.order || s.status !== 'open' || s.tier === state.tier) return state
  return { tier: s.tier, order: null }
}

/**
 * 한 단계 올리기. 다음 단계의 조건을 다 채우고, 공사 중이 아니고, 도토리가 있어야 한다.
 * 도토리는 여기서 빼지 않는다. 호출하는 쪽이 cost 만큼 money 에서 뺀다.
 */
export function startUpgrade(
  state: ShopState,
  stats: ShopStats,
  money: number,
  day: string,
): Result<{ to: ShopTier; cost: number; state: ShopState }> {
  if (dayIndex(day) === null) return { ok: false, reason: BAD_DAY }
  const cur = settleUpgrade(state, day)
  if (cur.order) return { ok: false, reason: '이미 공사 중이에요. 다음 날 다시 와요' }
  if (cur.tier === 3) return { ok: false, reason: '이미 가장 큰 백화점이에요' }
  const to = (cur.tier + 1) as ShopTier
  const unmet = unlockChecks(to, stats).filter((c) => !c.done)
  if (unmet.length) return { ok: false, reason: `아직 조건이 안 돼요: ${unmet.map((c) => c.label).join(', ')}` }
  const cost = tierDef(to).upgradeCost
  if (money < cost) return { ok: false, reason: '도토리가 모자라요' }
  return { ok: true, to, cost, state: { tier: cur.tier, order: { to, day } } }
}

/** 새 단계 문을 열 때 주는 마일리지. 가게 1단계 100, 큰 가게 200. 노점은 0. */
export function shopMilesReward(tier: ShopTier): number {
  return tier * 100
}

/** 이 단계에서 처음 진열하는 물건 이름. 이전 단계 진열에 없던 것만 센다. 노점은 기준이 없어 빈 목록이다. */
export function newItemsAt(tier: ShopTier): string[] {
  if (tier === 0) return []
  const before = SHOP_TIERS[tier - 1].pool
  return SHOP_TIERS[tier].pool.filter((id) => !before.includes(id) && ITEMS[id]).map((id) => ITEMS[id].name)
}

/** 지금 단계의 건물 모양. */
export function lookFor(tier: ShopTier): BuildingLook {
  return tierDef(tier).look
}
