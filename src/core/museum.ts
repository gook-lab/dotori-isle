/**
 * 도토리 자연사 전시관. 도감에 열 종이 오르면 광장 근처에 건물이 서고, 학예사 올롱에게 도감의 물고기·벌레·화석을 기증한다.
 *
 * 기증은 종마다 한 번이고 주머니에서 한 개를 낸다. 한 건마다 마일을 주고, 구역(물고기·벌레·화석)을 다 채우면 보너스를 준다.
 * 전시품은 기증한 것만 방에 놓는다. 순수 로직이라 React·Three 에 의존하지 않는다.
 */

import { FOSSIL_SPECIES, ITEMS, TIDE_TABLE } from './items'
import { isWalkable, byWater, normDist } from './island'
import { flatWithin } from './tiers'
import { canWalk } from './scenery'
import { blockedByProps, SPAWN } from './world'
import { reservedByHomes } from './villagers'
import { HOME_SITE } from './home'
import { MARKET_SITE, pickMarketSite } from './market'
import type { Result } from './economy'
import { MUSEUM_ROOM } from './interior'

export { MUSEUM_ROOM }

/** 전시관이 서는 도감 종 수 */
export const MUSEUM_DEX = 10
/** 기증 한 건의 마일리지 */
export const DONATION_MILES = 20
/** 구역을 다 채운 보너스 마일리지 */
export const ZONE_MILES = 200

export type ZoneKind = 'fish' | 'bug' | 'tide' | 'fossil'
export const ZONE_NAME: Record<ZoneKind, string> = { fish: '물고기', bug: '벌레', tide: '바닷가', fossil: '화석' }

/**
 * 기증할 수 있는 물건: 물고기·벌레 종, 바닷가 생물(물웅덩이), 화석 종.
 * 바닷가 생물은 벌레 종 목록에서 떼어 따로 묶는다(벌레 테라리움 칸은 섬 벌레 3마리 단위라 섞이지 않게).
 */
const TIDE_IDS = new Set(TIDE_TABLE.map((t) => t.id))
export const DONATABLE: readonly string[] = [
  ...Object.values(ITEMS)
    .filter((d) => (d.kind === 'fish' || d.kind === 'bug') && !TIDE_IDS.has(d.id))
    .map((d) => d.id),
  ...TIDE_TABLE.map((t) => t.id),
  ...FOSSIL_SPECIES,
]

export function donationKind(id: string): ZoneKind | null {
  const d = ITEMS[id]
  if (!d) return null
  if (TIDE_IDS.has(id)) return 'tide'
  if (d.kind === 'fish') return 'fish'
  if (d.kind === 'bug') return 'bug'
  if (FOSSIL_SPECIES.includes(id)) return 'fossil'
  return null
}

const zoneIds = (kind: ZoneKind): string[] => DONATABLE.filter((id) => donationKind(id) === kind)

/** 도감에 열 종이 올랐으면 전시관이 선다. */
export const museumOpen = (dex: Record<string, number>): boolean => Object.keys(dex).length >= MUSEUM_DEX

/** 저장된 기증 목록을 믿을 수 있는 것만 남긴다. 알 수 없는 id 와 중복은 버린다. */
export function sanitizeDonated(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const id of raw) if (typeof id === 'string' && DONATABLE.includes(id) && !out.includes(id)) out.push(id)
  return out
}

/** 기증할 수 있는지. 도감에 올라 있고, 아직 안 냈고, 주머니에 한 개 이상 있어야 한다. */
export function canDonate(id: string, dex: Record<string, number>, donated: readonly string[], owned: number): Result<object> {
  if (!DONATABLE.includes(id)) return { ok: false, reason: '전시관에는 물고기·벌레·바닷가 생물·화석만 기증할 수 있어요' }
  if (donated.includes(id)) return { ok: false, reason: '이미 전시관에 있어요' }
  if (!dex[id]) return { ok: false, reason: '도감에 올라야 기증할 수 있어요' }
  if (owned < 1) return { ok: false, reason: '주머니에 없어요' }
  return { ok: true }
}

export interface DonationResult {
  donated: string[]
  miles: number
  /** 이번 기증으로 방금 다 채운 구역. 아니면 null. */
  zone: ZoneKind | null
}

/** 기증 한 건의 결과: 목록에 더하고, 마일리지는 건당 보상에 구역 완성 보너스를 더한다. */
export function donate(donated: readonly string[], id: string): DonationResult {
  const next = [...donated, id]
  const kind = donationKind(id)
  let zone: ZoneKind | null = null
  if (kind) {
    const ids = zoneIds(kind)
    const before = ids.every((z) => donated.includes(z))
    const after = ids.every((z) => next.includes(z))
    if (after && !before) zone = kind
  }
  return { donated: next, miles: DONATION_MILES + (zone ? ZONE_MILES : 0), zone }
}

/** 방 안 전시품 자리. 물고기는 수조, 벌레는 테라리움, 화석은 받침대에 놓는다(방 가운데 기준). 자리는 기증과 상관없이 늘 있다. */
const TANK_COLS = [-3.6, -1.2, 1.2, 3.6]
const TANK_ROW_Z = -3.2
const TANK_FISH = 4
export const TANK_R = 0.9
const TERRARIUM_X = 3.9
const TERRARIUM_Z = [-1.8, -0.2, 1.4]
const TERRARIUM_BUGS = 3
export const TERRARIUM_R = 0.6
const PLINTH_X = [-3, -1.8, -0.6, 0.6, 1.8, 3]
const PLINTH_Z = 2.2
export const PLINTH_R = 0.5
/** 얕은 물웅덩이 자리(방 가운데 왼쪽 뒤). 벤치·화분·받침대와 겹치지 않는다. */
export const TIDE_POOL_X = -1.4
export const TIDE_POOL_Z = -0.6
export const TIDE_POOL_R = 0.9

export interface TankSpot {
  x: number
  z: number
  /** 칸마다 기증한 물건 id. 비어 있으면 null 이다(빈 칸은 물음표로 보인다). */
  items: (string | null)[]
}
export interface ExhibitLayout {
  tanks: TankSpot[]
  terrariums: TankSpot[]
  /** 바닷가 얕은 물웅덩이 한 칸. 칸마다 바닷가 생물 한 종이 든다. */
  tidePool: TankSpot
  plinths: { x: number; z: number; itemId: string | null }[]
}

const chunks = <T,>(list: readonly T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

/** 기증 목록으로 전시 배치를 정한다. 칸 수는 종 수로 정해져 있어서 기증 전에도 빈 칸이 보인다. */
export function museumLayout(donated: readonly string[]): ExhibitLayout {
  const fill = (ids: readonly string[]) => ids.map((id) => (donated.includes(id) ? id : null))
  const fish = DONATABLE.filter((id) => donationKind(id) === 'fish')
  const bugs = DONATABLE.filter((id) => donationKind(id) === 'bug')
  const tanks = chunks(fish, TANK_FISH).map((ids, i) => ({ x: TANK_COLS[i % TANK_COLS.length], z: TANK_ROW_Z, items: fill(ids) }))
  const terrariums = chunks(bugs, TERRARIUM_BUGS).map((ids, i) => ({ x: TERRARIUM_X, z: TERRARIUM_Z[i] ?? TERRARIUM_Z[TERRARIUM_Z.length - 1], items: fill(ids) }))
  const tide = zoneIds('tide')
  const tidePool: TankSpot = { x: TIDE_POOL_X, z: TIDE_POOL_Z, items: fill(tide) }
  const fossils = zoneIds('fossil')
  const plinths = fossils.map((id, i) => ({ x: PLINTH_X[i], z: PLINTH_Z, itemId: donated.includes(id) ? id : null }))
  return { tanks, terrariums, tidePool, plinths }
}

/** 수조 안에서 k 번째 물고기가 놓이는 칸(수조 가운데 기준) */
export const slotOffset = (k: number): { x: number; z: number } => ({ x: k % 2 ? 0.35 : -0.35, z: k < 2 ? -0.2 : 0.2 })

/** 장식 가구: 긴 의자와 화분. 걸을 수 없게 막는다(전시와 상관없이 늘 있다). */
export const BENCHES = [
  { x: -4.2, z: -0.8 },
  { x: -4.2, z: 1.2 },
] as const
export const BENCH_R = 0.55
export const POTS = [
  { x: 4.3, z: 3 },
  { x: -4.3, z: 3 },
  { x: 4.3, z: -3.4 },
  { x: -4.3, z: -3.4 },
] as const
export const POT_R = 0.4

/** 전시대와 장식이 걸을 수 없게 막는 원. 빈 칸도 자리를 차지한다. */
export function museumSolids(l: ExhibitLayout): { x: number; z: number; r: number }[] {
  return [
    ...BENCHES.map((b) => ({ x: b.x, z: b.z, r: BENCH_R })),
    ...POTS.map((p) => ({ x: p.x, z: p.z, r: POT_R })),
    ...l.tanks.map((t) => ({ x: t.x, z: t.z, r: TANK_R })),
    ...l.terrariums.map((t) => ({ x: t.x, z: t.z, r: TERRARIUM_R })),
    { x: l.tidePool.x, z: l.tidePool.z, r: TIDE_POOL_R },
    ...l.plinths.map((p) => ({ x: p.x, z: p.z, r: PLINTH_R })),
  ]
}

/** 학예사 이름과 줄. 기증 수와 구역 완성 여부에 따라 바뀐다. */
export const CURATOR_NAME = '올롱'
export function curatorLine(count: number, total: number): string {
  if (count === 0) return '어서 오세요! 여기는 도토리 자연사 전시관이에요. 도감에 오른 물고기나 벌레, 화석을 한 개씩 기증해 주세요.'
  if (count >= total) return '전시관이 가득 찼어요! 이렇게 많이 모아 주셔서 정말 감사해요.'
  return `지금까지 ${count}점을 받았어요. 다음 것도 기다릴게요!`
}

/** 구역별 진행. 화면의 구역 표시에 쓴다. */
export function zoneProgress(donated: readonly string[], kind: ZoneKind): { done: number; total: number } {
  const ids = zoneIds(kind)
  return { done: ids.filter((id) => donated.includes(id)).length, total: ids.length }
}

/**
 * 건물 발자국 반지름(계단 포함). 중심에서 이 거리 안은 건물이 차지한다고 본다.
 * 이웃(집터·가판대)과의 간격은 발자국 바깥 가장자리에서 재야 하므로 간격에 이 값을 더한다.
 */
export const MUSEUM_R = 2.7
/** 건물 가장자리와 이웃 울타리·집터 사이에 두는 걸을 수 있는 간격 */
export const MUSEUM_GAP = 3
/** 가판대 울타리 반지름(대략) */
const MARKET_R = 2
/** 건물 자리. 광장(시작 자리) 둘레 14~20 거리의 평평한 땅에서, 가판대와 집터에서 떨어진 첫 칸을 고른다. */
const far = (p: { x: number; z: number } | null | undefined, d: number, x: number, z: number) => !p || Math.hypot(x - p.x, z - p.z) > d
export const pickMuseumPlot = (): { x: number; z: number } | null =>
  pickMarketSite(
    (x, z) =>
      flatWithin(x, z, 2.6) &&
      isWalkable(x, z) &&
      canWalk(x, z) &&
      normDist(x, z) < 0.6 &&
      !blockedByProps(x, z, 2.6) &&
      !byWater(x, z, 3) &&
      // 집터(주민 집·산책 반경)는 발자국과 간격만큼 떨어뜨린다
      !reservedByHomes(x, z, MUSEUM_R + MUSEUM_GAP) &&
      far(MARKET_SITE, MARKET_R + MUSEUM_GAP + MUSEUM_R, x, z) &&
      far(HOME_SITE, 9, x, z),
    SPAWN,
    [14, 15, 16, 17, 18, 19, 20],
  )

export interface MuseumSite {
  x: number
  z: number
  /** 정면(문)이 보는 방향. 0 이면 남쪽(+z)을 본다. */
  rot: number
  door: { x: number; z: number }
  curator: { x: number; z: number }
}

/** 건물 자리에서 문과 학예사 자리를 정한다. 학예사는 문 오른쪽에 선다. */
export function museumSite(plot: { x: number; z: number }): MuseumSite {
  // 정면은 남쪽(+z)을 본다. 기본 카메라가 남쪽에서 비추므로 정면과 기둥이 화면에 바로 보인다.
  const rot = 0
  // 건물 정면은 중심에서 약 1.6 떨어져 있어 문은 그보다 0.5 앞에 선다
  const door = { x: plot.x, z: plot.z + 2.1 }
  return { x: plot.x, z: plot.z, rot, door, curator: { x: door.x + 1.7, z: door.z } }
}

/** 섬에서 정한 전시관 자리. 한 번만 고른다. 자리가 없으면 null(건물이 서지 않는다). */
export const MUSEUM_SITE: MuseumSite | null = (() => {
  const plot = pickMuseumPlot()
  return plot ? museumSite(plot) : null
})()
