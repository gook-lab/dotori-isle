/**
 * 섬 곳곳의 자잘한 지형지물: 동그란 덤불, 그루터기, 쓰러진 통나무, 버섯 무리.
 * 덤불·그루터기·통나무는 몸이 걸리고, 버섯은 밟고 지나간다. 덤불은 흔들 수 있다.
 * 주민 집 자리가 정해진 뒤에 뿌려야 마당을 피할 수 있어서 world.ts 와 따로 둔다.
 */

import { byWater, heightAt, ISLAND_R, normDist } from './island'
import { flatRing, inStepBlockAt, STEP_PAD } from './tiers'
import { hashString, mulberry32 } from './rng'
import { reservedByHomes, VILLAGERS } from './villagers'
import { HOME_SITE } from './home'
import { blockedByProps, canStand, ROCKS, SHOP, SHOP_DOOR, SPAWN, TREES } from './world'

export type SceneryKind = 'bush' | 'stump' | 'log' | 'mushroom' | 'wildflowers' | 'pebbles'

export interface ScenerySpot {
  id: string
  kind: SceneryKind
  x: number
  z: number
  rot: number
  scale: number
}

/** 몸이 걸리는 반경. 통나무는 길쭉해서 길이 방향으로 원 세 개를 늘어놓는다. */
const SOLID_R: Record<SceneryKind, number> = { bush: 0.55, stump: 0.4, log: 0.32, mushroom: 0, wildflowers: 0, pebbles: 0 }
const LOG_HALF = 0.8

const COUNTS: [SceneryKind, number][] = [
  ['bush', 10],
  ['stump', 6],
  ['log', 4],
  ['mushroom', 12],
]

/** 사물 사이 빈 땅을 재는 칸 크기. 이 칸마다 적어도 하나는 볼거리가 있게 채운다. */
export const FILL_CELL = 8

/** 자리가 비었는지 볼 때 함께 세는 큰 사물들(나무·바위·집터·상점) */
function occupied(x0: number, z0: number, placed: ScenerySpot[]): boolean {
  const inCell = (x: number, z: number) => x >= x0 && x < x0 + FILL_CELL && z >= z0 && z < z0 + FILL_CELL
  if (TREES.some((t) => inCell(t.x, t.z)) || ROCKS.some((r) => inCell(r.x, r.z))) return true
  if (VILLAGERS.some((v) => inCell(v.house.x, v.house.z) || inCell(v.home.x, v.home.z))) return true
  if (inCell(SHOP.x, SHOP.z)) return true
  return placed.some((s) => inCell(s.x, s.z))
}

/** 플레이어 집 자리와 그 앞마당. 덤불·통나무가 집 몸체에 겹치지 않게 비운다. */
function nearHomeSite(x: number, z: number, pad: number): boolean {
  return HOME_SITE !== null && Math.hypot(x - HOME_SITE.x, z - HOME_SITE.z) < 2.6 + pad
}

function spotOk(x: number, z: number, pad: number, out: ScenerySpot[], gap: number): boolean {
  if (normDist(x, z) > 0.74 || heightAt(x, z) < 0.85 || !flatRing(x, z, 0.6)) return false
  if (blockedByProps(x, z, pad + 0.4) || reservedByHomes(x, z, pad) || nearHomeSite(x, z, pad) || byWater(x, z, pad * 0.6)) return false
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 5 || Math.hypot(x - SHOP_DOOR.x, z - SHOP_DOOR.z) < 4) return false
  return !out.some((o) => Math.hypot(o.x - x, o.z - z) < gap)
}

function generate(): ScenerySpot[] {
  const rng = mulberry32(hashString('scenery-v1'))
  const out: ScenerySpot[] = []
  for (const [kind, n] of COUNTS) {
    let made = 0
    for (let attempt = 0; attempt < 6000 && made < n; attempt++) {
      const x = (rng() * 2 - 1) * ISLAND_R
      const z = (rng() * 2 - 1) * ISLAND_R
      const rot = rng() * Math.PI * 2
      const scale = 0.85 + rng() * 0.35
      // 덤불은 연못가와 섬 가장자리에 모이고, 나머지는 잔디 어디든.
      if (normDist(x, z) > 0.74) continue
      const pad = kind === 'log' ? LOG_HALF + 0.6 : 0.9
      if (blockedByProps(x, z, pad + 0.4) || reservedByHomes(x, z, pad) || nearHomeSite(x, z, pad) || byWater(x, z, pad * 0.6)) continue
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 5 || Math.hypot(x - SHOP_DOOR.x, z - SHOP_DOOR.z) < 4) continue
      if (heightAt(x, z) < 0.85 || !flatRing(x, z, 0.6)) continue
      const gap = kind === 'mushroom' ? 3 : 4.5
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < (o.kind === kind ? gap : 2.4))) continue
      out.push({ id: `${kind}-${made}`, kind, x, z, rot, scale })
      made++
    }
  }
  // 빈 땅 채우기: 아무것도 없는 칸마다 들꽃 무더기·자갈·덤불 중 하나를 둔다.
  // 들꽃과 자갈은 밟고 지나가므로 길을 막지 않는다.
  const fill = mulberry32(hashString('scenery-fill-v1'))
  const count: Partial<Record<SceneryKind, number>> = {}
  const from = Math.floor(-ISLAND_R / FILL_CELL) * FILL_CELL
  for (let cx = from; cx < ISLAND_R; cx += FILL_CELL) {
    for (let cz = from; cz < ISLAND_R; cz += FILL_CELL) {
      if (occupied(cx, cz, out)) continue
      const r = fill()
      // 덤불은 빈 칸의 10% 안팎만 맡는다. 나머지는 들꽃과 자갈이다.
      const first: SceneryKind = r < 0.5 ? 'wildflowers' : r < 0.9 ? 'pebbles' : 'bush'
      // 덤불은 자리를 넓게 차지해서 못 들어가면 자갈·들꽃으로 바꿔 넣는다.
      placing: for (const kind of [first, 'pebbles', 'wildflowers'] as SceneryKind[]) {
        for (let attempt = 0; attempt < 30; attempt++) {
          const x = cx + 1 + fill() * (FILL_CELL - 2)
          const z = cz + 1 + fill() * (FILL_CELL - 2)
          if (!spotOk(x, z, kind === 'bush' ? 0.9 : 0.4, out, 2.4)) continue
          const n = (count[kind] = (count[kind] ?? 0) + 1)
          out.push({ id: `${kind}-fill-${n}`, kind, x, z, rot: fill() * Math.PI * 2, scale: 0.85 + fill() * 0.35 })
          break placing
        }
      }
    }
  }
  return out
}

// 계단 블록 자리(여유 포함)의 통나무·돌은 만든 뒤 뺀다(생성 루프와 남은 id 는 그대로)
export const SCENERY = generate().filter((s) => !inStepBlockAt(s.x, s.z, STEP_PAD))

/** 통나무 몸통을 따라 늘어놓은 충돌 원 중심들 */
function solidCircles(s: ScenerySpot): [number, number][] {
  if (s.kind !== 'log') return [[s.x, s.z]]
  const dx = Math.sin(s.rot) * LOG_HALF * s.scale
  const dz = Math.cos(s.rot) * LOG_HALF * s.scale
  return [
    [s.x - dx, s.z - dz],
    [s.x, s.z],
    [s.x + dx, s.z + dz],
  ]
}

export function blockedByScenery(x: number, z: number, pad = 0): boolean {
  if (Math.abs(x) > ISLAND_R * 1.2 || Math.abs(z) > ISLAND_R * 1.2) return false
  return SCENERY.some((s) => {
    const r = SOLID_R[s.kind] * s.scale
    if (r === 0) return false
    const rr = (r + pad) ** 2
    // 대부분은 멀리 있으니 중심 거리로 먼저 거른다. 통나무만 몸통 길이만큼 넉넉히 본다.
    const reach = r + pad + (s.kind === 'log' ? LOG_HALF * s.scale : 0)
    const d2 = (s.x - x) ** 2 + (s.z - z) ** 2
    if (d2 > reach * reach) return false
    if (s.kind !== 'log') return d2 < rr
    return solidCircles(s).some(([cx, cz]) => (cx - x) ** 2 + (cz - z) ** 2 < rr)
  })
}

/** 사람·주민이 설 수 있는 자리: 지형과 큰 소품에 더해 덤불·그루터기·통나무도 피한다. */
export const canWalk = (x: number, z: number) => canStand(x, z) && !blockedByScenery(x, z, 0.3)

/**
 * 이번 프레임 이동이 막혔을 때 미끄러져 갈 한 걸음을 고른다. 전체 이동 → 한 축만 → 방향을 조금씩 틀어 비껴 가기 순서다.
 * 정면으로 물건에 막히면 축별 이동은 0 이 되어 제자리에 끼니까, 비껴 가는 후보가 있어야 모서리를 돌아간다.
 * 반환은 옮길 (dx, dz) 이고, 어디도 못 가면 null.
 */
export function slideStep(x: number, z: number, dx: number, dz: number, free: (x: number, z: number) => boolean): [number, number] | null {
  const cands: [number, number][] = [
    [dx, dz],
    [dx, 0],
    [0, dz],
  ]
  // 90도는 앞뒤 이동이 0 이 되어 물건 옆면을 따라 곧장 비껴 간다(구멍 정면에 막혔을 때 필요).
  for (const deg of [25, -25, 50, -50, 75, -75, 90, -90]) {
    const a = (deg * Math.PI) / 180
    cands.push([dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)])
  }
  for (const [mx, mz] of cands) {
    if (mx === 0 && mz === 0) continue
    if (free(x + mx, z + mz)) return [mx, mz]
  }
  return null
}

export const BUSHES = SCENERY.filter((s) => s.kind === 'bush')

/**
 * 덤불을 흔들었을 때 떨어지는 것. 덤불마다 하루 한 번, 날짜로 정해진다.
 * 꽃씨가 가장 흔하고, 가끔 도토리 꾸러미가 숨어 있다.
 */
export function bushFind(bushId: string, day: string): string | null {
  const r = mulberry32(hashString(`bush:${bushId}:${day}`))()
  if (r < 0.1) return 'acorn-pouch'
  if (r < 0.45) return 'flower-seed'
  // 요리 재료: 버섯과 꽃잎은 덤불 속에 가끔 있다
  if (r < 0.53) return 'mushroom'
  if (r < 0.6) return 'petal'
  return null
}
