/** 섬의 모양과 높이. 모든 좌표는 월드 XZ 평면이고 물 표면이 y=0 이다. */

import { inRoomArea, roomFloorY, roomWalkable } from './interior'
import { bridgeHeight, carve, inWater, onBridge, onPier, PIER_DECK, PIER_HALF, PIER_LAND_LEN, pierFrame, STREAM } from './waters'
import { cliffAt, tierHeightAt } from './tiers'

export const ISLAND_R = 66
export const GRASS_EDGE = 0.8
const CLIFF_END = 0.83
const GRASS_H = 1
const SAND_H = 0.4

export type Ground = 'grass' | 'sand' | 'water'

export function radiusAt(theta: number): number {
  return ISLAND_R * (1 + 0.1 * Math.sin(3 * theta + 0.4) + 0.06 * Math.sin(5 * theta + 1.3))
}

/** 0 이 섬 중심, 1 이 물가. 집 섬 기준이다. */
export function normDist(x: number, z: number): number {
  return Math.hypot(x, z) / radiusAt(Math.atan2(z, x))
}

/**
 * 펠리컨을 타고 가는 여행 섬. 같은 좌표 공간의 먼 바다에 있어서
 * 지형·걷기·낚시·충돌을 집 섬과 같은 함수로 처리한다. 안개 때문에 서로 보이지 않는다.
 */
export const TRIP = { x: 240, z: 0, r: 16 }

export function tripRadiusAt(theta: number): number {
  return TRIP.r + 1.6 * Math.sin(4 * theta + 0.9) + 0.8 * Math.sin(7 * theta)
}

export function tripDist(x: number, z: number): number {
  const dx = x - TRIP.x
  const dz = z - TRIP.z
  return Math.hypot(dx, dz) / tripRadiusAt(Math.atan2(dz, dx))
}

/** 가장 가까운 섬 기준의 정규화 거리 */
export function islandDist(x: number, z: number): number {
  return Math.min(normDist(x, z), tripDist(x, z))
}

export const onTrip = (x: number) => x > TRIP.x / 2

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** e0 에서 e1 사이를 0~1 로 부드럽게 잇는다 */
const smooth01 = (e0: number, e1: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** 연못·개울을 파기 전의 원래 지형 높이. 언덕 평지가 있으면 그 높이와 최댓값이다. */
export function baseHeightAt(x: number, z: number): number {
  const ground = groundHeightAt(x, z)
  const tier = tierHeightAt(x, z)
  // 언덕 밖(0)은 바다 밑까지 깊어야 하므로 평지 높이가 있을 때만 올려 준다.
  return tier > 0 ? Math.max(ground, tier) : ground
}

function groundHeightAt(x: number, z: number): number {
  const d = islandDist(x, z)
  if (d < GRASS_EDGE) {
    // 가장자리로 갈수록 기복을 줄여 언덕 턱과 이음매가 생기지 않게 한다.
    const fade = Math.min(1, (GRASS_EDGE - d) / 0.05)
    return GRASS_H + 0.12 * Math.sin(x * 0.35) * Math.cos(z * 0.29) * fade
  }
  if (d < CLIFF_END) return lerp(GRASS_H, SAND_H, (d - GRASS_EDGE) / (CLIFF_END - GRASS_EDGE))
  if (d < 1) return lerp(SAND_H, 0.05, (d - CLIFF_END) / (1 - CLIFF_END))
  return Math.max(-2.5, 0.05 - (d - 1) * 14)
}

/** 섬 안 물길(연못·개울)은 집 섬에만 있다. 멀리서는 계산을 건너뛴다. */
export const nearWaters = (x: number, z: number) => Math.abs(x) < 60 && Math.abs(z) < 60

export function heightAt(x: number, z: number): number {
  // 집 안은 평평한 마루. 다락에 올라가 있으면 다락 바닥 높이다.
  if (inRoomArea(x)) return roomFloorY(x, z)
  // 부두 판자 위는 판자 높이(바다 위까지 이어진다)
  if (onPier(x, z)) return PIER_DECK
  const base = baseHeightAt(x, z)
  // 바다 쪽 연장 판자 밑의 물가 모래는 물속으로 내린다. 뭍 쪽은 그대로 두고, 경계는 부드럽게 이어 틈이 안 생기게 한다.
  // 판자 폭 밖 1.5 까지 파므로 판 범위를 그만큼 넓혀 본다(기본 pad 는 0.6 이라 바깥 띠가 파지지 않았다)
  const pf = pierFrame(x, z, 2)
  if (pf && base < 0.6) {
    // 격자 한 칸(약 0.3~0.6)보다 넓게 파서 삼각형이 물 위로 부풀지 않게 한다. 뭍 쪽 끝은 원래 해안까지 부드럽게 이어진다.
    const along = smooth01(PIER_LAND_LEN - 1.4, PIER_LAND_LEN + 0.6, pf.f)
    const across = 1 - smooth01(PIER_HALF, PIER_HALF + 1.5, Math.abs(pf.s))
    const w = along * across
    return base + (Math.min(base, -0.6) - base) * w
  }
  if (!nearWaters(x, z)) return base
  // 다리 위는 잔디 높이로 걷는다.
  const bridge = onBridge(x, z)
  if (bridge) return bridgeHeight(bridge, x, z)
  return carve(x, z, base).h
}

/** 그 자리 물 높이. 연못·개울이면 수면, 바다면 0, 뭍이면 null */
export function waterLevelAt(x: number, z: number): number | null {
  if (nearWaters(x, z)) {
    const c = carve(x, z, baseHeightAt(x, z))
    if (c.water !== null && !onBridge(x, z)) return c.water
  }
  return islandDist(x, z) >= 1 ? 0 : null
}

export function groundAt(x: number, z: number): Ground {
  if (nearWaters(x, z) && inWater(x, z, baseHeightAt(x, z))) return 'water'
  const d = islandDist(x, z)
  if (d < GRASS_EDGE + 0.015) return 'grass'
  if (d < 1) return 'sand'
  return 'water'
}

export function isWalkable(x: number, z: number): boolean {
  if (inRoomArea(x)) return roomWalkable(x, z, 0)
  // 부두 판자 길은 바다 위라도 걸어간다
  if (onPier(x, z)) return true
  // 절벽 띠는 걸을 수 없다. 경사로는 완만해서 그대로 걸어 오르내린다.
  if (cliffAt(x, z)) return false
  if (nearWaters(x, z)) {
    if (onBridge(x, z)) return true
    // 물가 둑까지는 걸을 수 있고 물에는 못 들어간다. 모래사장을 지나는 개울 끝은 얕아서 걸어 건넌다.
    // 판정은 '원래 땅에서 얼마나 파였나' 로 한다. 절대 높이로 보면 절벽 아래 모래 경사까지 막힌다.
    const base = baseHeightAt(x, z)
    const c = carve(x, z, base)
    if (islandDist(x, z) < 0.83 && (c.water !== null || base - c.h > 0.3)) return false
  }
  return islandDist(x, z) < 0.98
}

/** 연못·개울이나 그 둑 위인지. 나무·꽃·물건을 놓지 않는 자리다. */
export function byWater(x: number, z: number, pad = 0): boolean {
  if (!nearWaters(x, z)) return false
  if (onBridge(x, z, pad)) return true
  return carve(x, z, baseHeightAt(x, z)).h < baseHeightAt(x, z) - 0.05 || (pad > 0 && [0, Math.PI / 2, Math.PI, -Math.PI / 2].some((a) => carve(x + Math.sin(a) * pad, z + Math.cos(a) * pad, baseHeightAt(x, z)).h < baseHeightAt(x, z) - 0.05))
}

/** 개울 물 높이가 가장 크게 떨어지는 곳(잔디 끝 절벽의 폭포). 소리와 물보라가 여기서 난다. */
export const FALLS_AT: { x: number; z: number } = (() => {
  let best = { x: STREAM[0][0], z: STREAM[0][1], drop: -1 }
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i]
    const [bx, bz] = STREAM[i + 1]
    for (let k = 0; k < 1; k += 0.05) {
      const x0 = ax + (bx - ax) * k
      const z0 = az + (bz - az) * k
      const x1 = ax + (bx - ax) * (k + 0.05)
      const z1 = az + (bz - az) * (k + 0.05)
      // 다리 밑은 물이 없다고 답하므로 건너뛴다.
      const w0 = waterLevelAt(x0, z0)
      const w1 = waterLevelAt(x1, z1)
      if (w0 === null || w1 === null) continue
      const drop = w0 - w1
      if (drop > best.drop) best = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, drop }
    }
  }
  return { x: best.x, z: best.z }
})()

/**
 * 카메라 시선이 땅에 막히는 지점. from 에서 to 까지 가면서 땅 아래로 들어가는 첫 자리의 비율(0~1)을 돌려준다.
 * 막히지 않으면 1. 절벽 뒤로 카메라가 숨어드는 것을 막는 데 쓴다.
 */
export function sightClearance(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, steps = 14): number {
  const at = (k: number) => {
    const x = from.x + (to.x - from.x) * k
    const y = from.y + (to.y - from.y) * k
    const z = from.z + (to.z - from.z) * k
    return heightAt(x, z) + 0.15 > y
  }
  for (let i = 1; i <= steps; i++) {
    if (!at(i / steps)) continue
    // 처음 막힌 칸 사이를 이분법으로 좁힌다. 칸 단위로만 끊으면 카메라가 한 칸씩 뛴다.
    let lo = (i - 1) / steps
    let hi = i / steps
    for (let n = 0; n < 6; n++) {
      const mid = (lo + hi) / 2
      if (at(mid)) hi = mid
      else lo = mid
    }
    return lo
  }
  return 1
}
