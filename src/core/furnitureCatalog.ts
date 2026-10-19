/**
 * 가구 도감. 한 번이라도 손에 넣은 가구를 기록하고, 아직 못 본 가구는 어디서 나오는지 알려 준다.
 * 기록은 저장되는 목록(furnitureSeen)에 쌓인다. 팔거나 놓아도 지워지지 않는다.
 */

import { isFence } from './fence'
import { LIMITED_ITEM, STAR_GIFTS } from './homeScore'
import { ATM_PRODUCTS } from './bank'
import { ITEMS } from './items'
import { MARKET_RARE } from './market'
import { RECIPES } from './recipes'
import { FESTIVALS } from './festivals'
import { SHOP_TIERS } from './shopTiers'
import { VILLAGERS } from './villagers'
import { dexProgress } from './dex'
import { TOURNEY_PRIZES } from './tourney'
import { STORY_CHAPTERS } from './story'
import { PUMPKIN_GIFTS } from './pumpkin'
import { HARVEST_FURNITURE } from './harvestFair'
import { FIRST_SNOW_REWARD } from './firstSnow'

/** 게임 안의 모든 가구 종류 */
export const FURNITURE_IDS: readonly string[] = Object.values(ITEMS)
  .filter((d) => d.kind === 'furniture' && !isFence(d.id))
  .map((d) => d.id)

const FESTIVAL_REWARDS = Object.values(FESTIVALS).map((f) => f.reward)

/** 가구를 얻는 길마다 붙는 짧은 이름. 여러 길이면 모두 적는다. */
export function furnitureSources(id: string): string[] {
  const out: string[] = []
  if (SHOP_TIERS.some((t) => t.pool.includes(id))) out.push('상점')
  if (id in MARKET_RARE) out.push('장터에서 가끔')
  if (FESTIVAL_REWARDS.includes(id)) out.push('축제 보상')
  if (RECIPES.some((r) => r.id === id)) out.push('DIY')
  if (VILLAGERS.some((v) => v.gifts.includes(id))) out.push('주민 선물')
  if (TOURNEY_PRIZES.some((p) => p.id === id)) out.push('대회 교환')
  if (id === 'star-lamp') out.push('별자리 열두 개 편지')
  if (id === LIMITED_ITEM) out.push('집 꾸미기 점수 최고 구간')
  const star = Object.entries(STAR_GIFTS).find(([, gift]) => gift === id)
  if (star) out.push(`섬 꾸미기 위원회 별 ${star[0]}`)
  if (id === 'photo-frame') out.push('이사 가는 주민의 작별 편지')
  if (ATM_PRODUCTS.some((p) => p.grant?.itemId === id)) out.push('도토리 ATM 마일 교환')
  if (STORY_CHAPTERS.some((c) => c.gift === id)) out.push('섬 이야기 장 보상')
  if (PUMPKIN_GIFTS.some((g) => g === id)) out.push('호박 등불 밤 답례')
  if (HARVEST_FURNITURE.some((g) => g === id)) out.push('도토리 감사 장날 답례')
  if (id === FIRST_SNOW_REWARD) out.push('첫눈 날 눈사람 완성 편지')
  return out
}

/** 도감 카드에 쓰는 한 줄. 알 수 없으면 "섬 어딘가"로 둔다. */
export function furnitureHint(id: string): string {
  const s = furnitureSources(id)
  return s.length ? s.join(' · ') : '섬 어딘가'
}

/** 지금까지 본 가구 목록에, 주머니·배치·창고에 있는 가구를 더한다. 새로 더한 게 없으면 같은 배열을 돌려준다. */
export function seenFurniture(
  prev: readonly string[],
  inventory: readonly { id: string }[],
  placed: readonly { itemId: string }[],
  homeFurniture: readonly { itemId: string }[],
  homeStorage: readonly { id: string }[],
  /** 편지로 도착한 선물. 편지함에 들어오는 순간 가구를 손에 넣은 것으로 친다. */
  gifts: readonly (string | null)[] = [],
): string[] {
  const isFurniture = (id: string) => ITEMS[id]?.kind === 'furniture'
  const now = [...inventory.map((x) => x.id), ...placed.map((x) => x.itemId), ...homeFurniture.map((x) => x.itemId), ...homeStorage.map((x) => x.id), ...gifts.filter((g): g is string => !!g)]
  const add = now.filter((id, i) => isFurniture(id) && !prev.includes(id) && now.indexOf(id) === i)
  return add.length ? [...prev, ...add] : (prev as string[])
}

/** 저장값을 검증한다: 알려진 가구 id 만 중복 없이 남긴다. */
export function sanitizeSeen(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && ITEMS[x]?.kind === 'furniture'))]
}

/** 가구 도감 완성도 */
export function furnitureProgress(seen: readonly string[]) {
  return dexProgress(FURNITURE_IDS, Object.fromEntries(seen.map((id) => [id, 1])))
}
