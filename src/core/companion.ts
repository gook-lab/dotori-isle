import { BUG_TABLE, FISH_TABLE, speciesFor } from './items'
import { pickWeighted, type Rng } from './rng'

/** 같이 하는 활동: 낚시(물가에서 찌) 또는 벌레잡기(잠자리채) */
export type CompanionMode = 'fish' | 'bug'

/** 같이 낚시하는 시간(게임 시간 분). 게임 시계는 실제 시간과 같이 흐른다. */
export const COMPANION_MINUTES = 30
export const COMPANION_MS = COMPANION_MINUTES * 60_000
/** 우정 단계가 이 점수 이상인 주민만 같이 낚시하자고 한다(친구 단계 이상) */
export const COMPANION_MIN_POINTS = 8
/** 같이 낚시를 끝내면 올라가는 우정 점수 */
export const COMPANION_FRIENDSHIP = 3
/** 따라다닐 때 플레이어 뒤쪽으로 띄우는 거리 */
const FOLLOW_BACK = 1.6
const FOLLOW_SIDE = 1.1
/** 낚시할 때 플레이어 옆으로 서는 거리 */
const STAND_SIDE = 2

export interface Walker {
  x: number
  z: number
  facing: number
}

/** 플레이어 옆 뒤쪽, 오른쪽으로 조금 비킨 따라가기 목표점. 플레이어 시선 방향(facing) 기준이다. */
export function followGoal(p: Walker): { x: number; z: number } {
  // 캐릭터 앞 방향은 (sin, cos), 오른쪽은 (cos, -sin)
  const fx = Math.sin(p.facing)
  const fz = Math.cos(p.facing)
  const rx = Math.cos(p.facing)
  const rz = -Math.sin(p.facing)
  return {
    x: p.x - fx * FOLLOW_BACK + rx * FOLLOW_SIDE,
    z: p.z - fz * FOLLOW_BACK + rz * FOLLOW_SIDE,
  }
}

/** 목표점을 향해 한 걸음 옮긴다. 많이 뒤처지면 빨리 쫓아간다. */
export function stepToward(from: { x: number; z: number }, to: { x: number; z: number }, speed: number, dt: number): { x: number; z: number; moving: boolean } {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const d = Math.hypot(dx, dz)
  if (d < 0.05) return { x: from.x, z: from.z, moving: false }
  const step = Math.min(d, speed * dt * (d > 5 ? 2.5 : 1))
  return { x: from.x + (dx / d) * step, z: from.z + (dz / d) * step, moving: true }
}

/**
 * 낚시하는 주민이 설 자리: 플레이어 좌우 2칸, 물가(땅)여야 한다. 해안선이 나란하면 옆이 모두 물이니
 * 조금씩 뒤로 물러난 자리까지 본다. 오른쪽을 먼저 본다. 땅이 없으면 null.
 */
export function sideStand(p: Walker, isWater: (x: number, z: number) => boolean): { x: number; z: number } | null {
  const fx = Math.sin(p.facing)
  const fz = Math.cos(p.facing)
  const rx = Math.cos(p.facing)
  const rz = -Math.sin(p.facing)
  for (const back of [0, -1, -2]) {
    for (const side of [1, -1]) {
      const x = p.x + rx * side * STAND_SIDE + fx * back
      const z = p.z + rz * side * STAND_SIDE + fz * back
      if (!isWater(x, z)) return { x, z }
    }
  }
  return null
}

/** 주민이 서 있는 자리에서 바다 쪽으로 던지는 찌 자리. 앞쪽을 먼저 보고, 물이 없으면 null. */
export function fishingSpot(p: Walker, isWater: (x: number, z: number) => boolean): { x: number; z: number } | null {
  // 앞, 앞 좌우 30도, 앞 좌우 60도, 옆 순으로 가까운 것부터 본다.
  const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]
  const radii = [2.5, 3.2, 4]
  for (const a of angles) {
    for (const r of radii) {
      const dir = p.facing + a
      const x = p.x + Math.sin(dir) * r
      const z = p.z + Math.cos(dir) * r
      if (isWater(x, z)) return { x, z }
    }
  }
  return null
}

/** 다음 입질까지 걸리는 시간(초). 25~60초 사이에서 고른다. */
export function biteDelaySeconds(rng: Rng): number {
  return 25 + rng() * 35
}

/** 주민이 낚는 물고기 한 마리. 낚시 확률표와 시간대를 그대로 쓴다. */
export function companionCatch(night: boolean, rng: Rng): string {
  return pickWeighted(speciesFor(FISH_TABLE, night, false), rng).id
}

/** 같이 다니는 남은 시간(ms). 끝났으면 0. */
export function companionRemaining(until: number, now: number): number {
  return Math.max(0, until - now)
}

/** 벌레잡기 동행이 잡는 벌레 한 마리. 벌레 표에서 시간대에 맞게 고른다. */
export function companionBug(night: boolean, rng: Rng): string {
  return pickWeighted(speciesFor(BUG_TABLE, night), rng).id
}

/** 끝났을 때 선물로 주는 물고기: 주민이 마지막으로 잡은 것 하나. 한 마리도 못 잡았으면 없다. */
export function companionGift(catches: readonly string[]): string | null {
  return catches.length > 0 ? catches[catches.length - 1] : null
}
