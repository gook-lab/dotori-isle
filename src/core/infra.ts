/**
 * 섬 정비: 주민 안내판에서 맡기는 다리와 언덕 계단. 짓는 자리는 여기서만 판정한다(순수 함수).
 * 맡긴 다음 날 아침에 지어지고, 지어진 것만 걸을 수 있다. 다리는 개울 위, 계단은 언덕 절벽 한 자리에 놓는다.
 */
import { dayIndex } from './economy'
import { cliffAt, CLIFF_W, cliffFaceAt, flatRing, PLATEAUS, plateauRimAt, rampWeight, tierHeightAt } from './tiers'
import { byWater, groundAt, isWalkable, islandDist, waterLevelAt } from './island'
import { blockedByProps } from './world'
import { BRIDGES, extraBridges, PONDS, STREAM, STREAM_W, streamDist, type Bridge } from './waters'
import { decodePaths, encodePaths } from './paths'

export const BRIDGE_MAX = 4
export const STAIR_MAX = 4
export const BRIDGE_COST = 180
export const STAIR_COST = 140
/** 철거하면 돌려받는 몫 */
export const REFUND = 0.5

/** 다리 한 개: 놓인 자리와 방향, 지어지는 날 */
export interface BridgePiece {
  id: string
  x: number
  z: number
  rot: number
  /** 맡긴 날(YYYY-MM-DD)의 다음 날부터 지어진다 */
  ordered: string
}

/** 계단 한 개: 언덕 번호와 절벽 가장자리 각도 */
export interface StairPiece {
  id: string
  plateau: number
  ang: number
  ordered: string
}

export interface Infra {
  bridges: BridgePiece[]
  stairs: StairPiece[]
  /** 길 공사 허가를 받았는지 */
  permit: boolean
  /** 깔린 길 칸(encodePaths 문자열) */
  paths: string
}

export const NO_INFRA: Infra = { bridges: [], stairs: [], permit: false, paths: '' }

/** 맡긴 날 다음 날부터 지어진다. day 가 그 날 이상이면 지어진 것이다. */
export function builtBy(ordered: string, day: string): boolean {
  const a = dayIndex(ordered)
  const b = dayIndex(day)
  return a !== null && b !== null && b > a
}

/** 지어진 다리만(걸을 수 있는 것) */
export function builtBridges(infra: Infra, day: string): BridgePiece[] {
  return infra.bridges.filter((b) => builtBy(b.ordered, day))
}

/** 지어진 계단만 */
export function builtStairs(infra: Infra, day: string): StairPiece[] {
  return infra.stairs.filter((s) => builtBy(s.ordered, day))
}

/** 다리 방향 판정에 쓰는 값(개울 방향과 수직) 과 기본 길이·폭 */
const BRIDGE_LEN = 4
const BRIDGE_W = 1.5
const BRIDGE_GAP = 6
const STAIR_GAP = 0.6

/** 다리가 놓이는 방향: 개울 진행 방향에 수직. 기존 다리(waters.ts)와 같은 식을 쓴다. */
export function bridgeRotAt(dx: number, dz: number): number {
  return Math.atan2(dx, dz) + Math.PI / 2
}

/** 개울 가운데 선 위의 점과 그 자리 개울 방향 */
function streamPointAt(k: number): { x: number; z: number; dx: number; dz: number } | null {
  const i = Math.floor(k)
  if (i < 0 || i >= STREAM.length - 1) return null
  const [ax, az] = STREAM[i]
  const [bx, bz] = STREAM[i + 1]
  const t = k - i
  const len = Math.hypot(bx - ax, bz - az)
  return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / len, dz: (bz - az) / len }
}

/** 다리 판정: 개울 위 가운데가 물이고, 양 끝이 걸을 수 있는 뭍이며, 다른 다리와 떨어져 있어야 한다. */
export function bridgeOk(x: number, z: number, rot: number, others: { x: number; z: number }[]): boolean {
  // 다리는 개울 위에만 놓는다: 가운데는 흐르는 물이어야 하고, 연못 안은 안 된다.
  if (streamDist(x, z).d > STREAM_W * 0.5) return false
  if (waterLevelAt(x, z) === null || PONDS.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.6)) return false
  if (others.some((o) => Math.hypot(o.x - x, o.z - z) < BRIDGE_GAP)) return false
  if (BRIDGES.some((b) => Math.hypot(b.x - x, b.z - z) < BRIDGE_GAP)) return false
  const ux = Math.sin(rot)
  const uz = Math.cos(rot)
  for (const sd of [-1, 1]) {
    const ex = x + ux * (BRIDGE_LEN / 2 + 0.35) * sd
    const ez = z + uz * (BRIDGE_LEN / 2 + 0.35) * sd
    if (islandDist(ex, ez) >= 0.95) return false
    if (groundAt(ex, ez) === 'water' || waterLevelAt(ex, ez) !== null || cliffAt(ex, ez)) return false
  }
  return true
}

/** 개울 위에 놓을 수 있는 다리 자리 목록(0.5 간격). 이미 놓은 것과 가까운 자리는 뺀다. */
export function bridgeSpots(infra: Infra): { x: number; z: number; rot: number }[] {
  const out: { x: number; z: number; rot: number }[] = []
  const others = [...infra.bridges, ...extraBridges]
  for (let k = 0; k < STREAM.length - 1; k += 0.1) {
    const p = streamPointAt(k)
    if (!p) continue
    const rot = bridgeRotAt(p.dx, p.dz)
    if (bridgeOk(p.x, p.z, rot, others)) out.push({ x: p.x, z: p.z, rot })
  }
  return out
}

/** 계단 판정: 절벽 띠 가장자리에서 바깥은 뭍(걸을 수 있음), 안쪽은 언덕 윗면, 가운데는 절벽 면이어야 한다. 기존 경사로와 떨어져 있어야 한다. */
export function stairOk(plateau: number, ang: number, others: { plateau: number; ang: number }[]): boolean {
  const p = PLATEAUS[plateau]
  if (!p) return false
  if (rampWeight(p, ang) > 0.02) return false
  if (p.ramps.some((a) => Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a))) < 0.5)) return false
  if (others.some((o) => o.plateau === plateau && Math.abs(Math.atan2(Math.sin(ang - o.ang), Math.cos(ang - o.ang))) < STAIR_GAP)) return false
  const rim = plateauRimAt(p, ang)
  const cx = Math.cos(ang)
  const cz = Math.sin(ang)
  const at = (r: number) => [p.x + cx * r, p.z + cz * r] as const
  const [ox, oz] = at(rim + 0.9)
  const [ix, iz] = at(rim - CLIFF_W - 1.4)
  const [mx, mz] = at(rim - CLIFF_W * 0.5)
  if (groundAt(ox, oz) === 'water' || waterLevelAt(ox, oz) !== null || cliffAt(ox, oz)) return false
  if (cliffAt(ix, iz) || tierHeightAt(ix, iz) < p.top - 0.05) return false
  return cliffFaceAt(mx, mz)
}

/** 계단을 놓을 수 있는 절벽 가장자리 각도 목록(0.1 rad 간격) */
export function stairSpots(infra: Infra): { plateau: number; ang: number }[] {
  const out: { plateau: number; ang: number }[] = []
  const others = [...infra.stairs]
  PLATEAUS.forEach((_, plateau) => {
    for (let k = 0; k < Math.PI * 2; k += 0.1) if (stairOk(plateau, k, others)) out.push({ plateau, ang: k })
  })
  return out
}

/** 계단이 더하는 경사로 각도: 언덕별로 모아 extraRamps 에 넣는다. */
export function stairRamps(stairs: StairPiece[]): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const s of stairs) {
    const id = PLATEAUS[s.plateau]?.id
    if (!id) continue
    ;(out[id] ??= []).push(s.ang)
  }
  return out
}

/** 다리 목록을 waters 의 Bridge 모양으로 바꾼다(길이·폭은 고정). */
export function bridgeShapes(bridges: BridgePiece[]): Bridge[] {
  return bridges.map((b) => ({ x: b.x, z: b.z, rot: b.rot, len: BRIDGE_LEN, w: BRIDGE_W }))
}

/** 저장된 정비 기록을 검증한다. 망가진 항목은 버린다. */
export function sanitizeInfra(raw: unknown): Infra {
  const r = (raw ?? {}) as Partial<Infra>
  const okDay = (d: unknown): d is string => typeof d === 'string' && dayIndex(d) !== null
  const bridges = Array.isArray(r.bridges)
    ? r.bridges
        .filter((b): b is BridgePiece => !!b && typeof b.id === 'string' && Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(b.rot) && okDay(b.ordered))
        .slice(0, BRIDGE_MAX)
    : []
  const stairs = Array.isArray(r.stairs)
    ? r.stairs
        .filter((s): s is StairPiece => !!s && typeof s.id === 'string' && Number.isInteger(s.plateau) && s.plateau >= 0 && s.plateau < PLATEAUS.length && Number.isFinite(s.ang) && okDay(s.ordered))
        .slice(0, STAIR_MAX)
    : []
  return { bridges, stairs, permit: r.permit === true, paths: encodePaths(decodePaths(r.paths)) }
}

/** 철거 환불액. 지어진 것도 맡긴 것도 같은 몫을 돌려준다. */
export function refundOf(cost: number): number {
  return Math.floor(cost * REFUND)
}

/** 섬 정비 안내판 자리: 여러 곳에서 같이 쓰므로 한 번만 고른다 */
export const INFRA_BOARD = boardSpot()

/** 자리 고르기에서 보여 주는 맡길 수 있는 자리 한 곳 */
export type InfraSpot = { kind: 'bridge'; x: number; z: number; rot: number } | { kind: 'stair'; x: number; z: number; plateau: number; ang: number }

/** 섬 정비 안내판이 서는 자리: 광장 근처에서 평지이고 걸을 수 있는 가장 가까운 곳 */
export function boardSpot(near = { x: 6, z: -10 }): { x: number; z: number } {
  for (let r = 0; r < 12; r += 0.5) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const x = near.x + Math.cos(a) * r
      const z = near.z + Math.sin(a) * r
      if (flatRing(x, z, 0.8) && isWalkable(x, z) && !byWater(x, z, 1) && !blockedByProps(x, z, 1.2)) return { x, z }
    }
  }
  return near
}
