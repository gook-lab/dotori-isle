/**
 * 물뿌리개 범위 — 레벨별 물줄기가 덮는 정사각형.
 *
 * 범위는 플레이어가 서 있는 칸에서 바라보는 쪽(상하좌우 한 방향)으로 펼친 정사각형 칸이다.
 * 1 칸은 기존처럼 가장 가까운 꽃 하나를 노리고, 2×2·3×3 은 그 칸들 안의 꽃을 한 번에 적신다.
 * 판정과 바닥 표시와 물줄기 연출이 모두 이 파일의 `canCells` 를 본다.
 */

import type { Result } from './economy'
import type { ShopTier } from './shopTiers'

export type CanLevel = 1 | 2 | 3

/** 레벨별 이름. 도구 칸·상점·안내 문구가 같이 쓴다. */
export const CAN_NAMES: Record<CanLevel, string> = { 1: '물뿌리개', 2: '넓은 물뿌리개', 3: '큰 물뿌리개' }

export const isCanLevel = (n: unknown): n is CanLevel => n === 1 || n === 2 || n === 3

/** 범위의 한 변(칸 수). 1 칸은 기존 물뿌리개처럼 가장 가까운 꽃 하나를 노린다. */
export const CAN_SIDE: Record<CanLevel, number> = { 1: 1, 2: 2, 3: 3 }

/**
 * 범위가 바라보는 쪽 칸 기준으로 덮는 칸. [앞으로 t 칸, 옆으로 s 칸].
 * 2×2 는 바로 앞에서 두 칸 앞까지, 3×3 은 한 칸 앞이 가운데다(뒤쪽 한 칸도 덮는다).
 */
const CAN_OFFSETS: Record<CanLevel, [number, number][]> = {
  1: [[1, 0]],
  2: [[1, 0], [1, 1], [2, 0], [2, 1]],
  3: [[0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1], [2, -1], [2, 0], [2, 1]],
}

/** 상점에서 올려 사는 물뿌리개. 앞 단계를 가지고 있어야 하고, 가게 단계 조건도 맞아야 한다. */
export interface CanUpgrade {
  level: 2 | 3
  price: number
  /** 이 단계의 상점(도토리 상점 단계)이 열려 있어야 살 수 있다 */
  tier: ShopTier
}

/** 가격 근거: 물뿌리개 150, 삽 200, 도끼 250 과 맞춘다. 큰 물뿌리개는 가게 2단계 뒤에 연다. */
export const CAN_UPGRADES: readonly CanUpgrade[] = [
  { level: 2, price: 350, tier: 1 },
  { level: 3, price: 900, tier: 2 },
]

/** 다음 레벨 업그레이드. 이미 가장 크면 null. */
export function upgradeFor(level: CanLevel): CanUpgrade | null {
  return CAN_UPGRADES.find((u) => u.level === level + 1) ?? null
}

/**
 * 업그레이드를 살 수 있는지 본다. 물뿌리개를 가지고 있고, 바로 앞 레벨이고, 상점 단계와 도토리가 맞아야 한다.
 * 도토리는 여기서 빼지 않는다. 호출하는 쪽이 price 만큼 뺀다.
 */
export function canBuyUpgrade(owned: boolean, level: CanLevel, shopTier: ShopTier, money: number, to: 2 | 3): Result<{ price: number }> {
  const up = CAN_UPGRADES.find((u) => u.level === to)
  if (!up) return { ok: false, reason: '없는 물뿌리개예요' }
  if (!owned) return { ok: false, reason: '물뿌리개를 먼저 사요' }
  if (level >= to) return { ok: false, reason: '이미 가지고 있어요' }
  if (level !== to - 1) return { ok: false, reason: `${CAN_NAMES[(to - 1) as CanLevel]}부터 사야 해요` }
  if (shopTier < up.tier) return { ok: false, reason: '상점이 조금 더 커야 살 수 있어요' }
  if (money < up.price) return { ok: false, reason: '도토리가 모자라요' }
  return { ok: true, price: up.price }
}

/**
 * 바라보는 쪽을 가장 가까운 상하좌우 한 칸 방향으로 맞춘다. 꽃은 정수 칸에 심기므로 범위도 칸 단위다.
 * 대각선을 보면 더 가까운 축을 고른다.
 */
export function canDir(facing: number): { x: number; z: number } {
  const sx = Math.sin(facing)
  const sz = Math.cos(facing)
  return Math.abs(sx) > Math.abs(sz) ? { x: Math.sign(sx), z: 0 } : { x: 0, z: Math.sign(sz) }
}

/** 범위가 덮는 칸들의 중심(정수 좌표). 플레이어가 서 있는 칸을 기준으로 바라보는 쪽으로 펼친다. */
export function canCells(px: number, pz: number, facing: number, level: CanLevel): { x: number; z: number }[] {
  const bx = Math.round(px)
  const bz = Math.round(pz)
  const d = canDir(facing)
  // 옆 방향은 바라보는 쪽에서 오른쪽으로 90도 돈 방향이다.
  const lat = { x: d.z, z: -d.x }
  return CAN_OFFSETS[level].map(([t, s]) => ({ x: bx + t * d.x + s * lat.x, z: bz + t * d.z + s * lat.z }))
}

/** 꽃이 이 레벨의 범위 칸 안에 있는지. 꽃은 정수 칸에 심는다. */
export function inCan(px: number, pz: number, facing: number, level: CanLevel, x: number, z: number): boolean {
  const cx = Math.round(x)
  const cz = Math.round(z)
  return canCells(px, pz, facing, level).some((c) => c.x === cx && c.z === cz)
}

/** 범위 안의 꽃들. 마른 꽃을 먼저 주고, 다 젖어 있으면 젖은 꽃들을 돌려준다(안내 문구용). */
export function canTargets<T extends { x: number; z: number; watered: boolean }>(plants: readonly T[], px: number, pz: number, facing: number, level: CanLevel): T[] {
  const inside = plants.filter((p) => inCan(px, pz, facing, level, p.x, p.z))
  const dry = inside.filter((p) => !p.watered)
  return dry.length ? dry : inside
}

/** "물 주기 (2×2)" 같은 안내에 붙일 범위 표시. 1 칸은 붙이지 않는다. */
export function canAreaLabel(level: CanLevel): string {
  return level === 1 ? '' : ` (${CAN_SIDE[level]}×${CAN_SIDE[level]})`
}
