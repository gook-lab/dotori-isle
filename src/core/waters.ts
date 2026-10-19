/**
 * 섬 안의 물: 연못 둘과, 큰 연못에서 바다로 흘러가는 개울 하나. 개울은 잔디 끝 절벽에서 작은 폭포가 된다.
 * 높이는 원래 지형에서 파내는 식으로 계산하고(island.ts), 이 파일은 모양만 정한다. 다른 모듈을 import 하지 않는다.
 */

export interface Pond {
  x: number
  z: number
  r: number
  /** 물 높이. 없으면 잔디 연못 높이(POND_LEVEL). 언덕 윗면 연못은 따로 준다. */
  level?: number
  /** 못 바닥 높이. 없으면 잔디 연못 바닥(0.3). */
  floor?: number
}

/** 언덕 윗면 물 높이(윗면 2.6 보다 살짝 낮다). 연못과 물길이 같은 높이로 흐른다. */
export const SPOUT_LEVEL = 2.45

export const PONDS: Pond[] = [
  { x: 16, z: 16, r: 5 },
  { x: -26, z: -22, r: 3.8 },
  // 서쪽 언덕 윗면 연못(윗면 2.6 에서 파낸다). 봉우리와 경사로에서 떨어진 자리다.
  { x: -23.5, z: 18.5, r: 2, level: SPOUT_LEVEL, floor: 1.5 },
]

/** 연못 물 높이(잔디 1.0 보다 낮다) */
export const POND_LEVEL = 0.72

/**
 * 서쪽 언덕 연못에서 윗면 가장자리까지 짧은 물길. 끝에서 벽을 타고 떨어지는 작은 폭포가 된다.
 * a 는 연못 가장자리, b 는 벽이 시작하는 윗면 안쪽 가장자리다. 개울과는 이어지지 않는다(개울은 섬 북동쪽 바다로 간다).
 */
export const SPOUT = { a: [-22.1, 19.9] as [number, number], b: [-20.96, 21.04] as [number, number], w: 0.4 }

/** 물길 가운데 선에서 점까지 거리 */
export function spoutDist(x: number, z: number): number {
  const [ax, az] = SPOUT.a
  const [bx, bz] = SPOUT.b
  const vx = bx - ax
  const vz = bz - az
  const k = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
  return Math.hypot(x - (ax + vx * k), z - (az + vz * k))
}

/** 연못의 물 높이 */
export const pondLevel = (p: Pond) => p.level ?? POND_LEVEL

/** 개울 가운데 선. 큰 연못 가장자리에서 시작해 북동쪽 바다로 굽이쳐 나간다. */
export const STREAM: [number, number][] = [
  [19, 19.5],
  [22, 23],
  [25.5, 24.6],
  [28.2, 28.4],
  [31, 31.2],
  [34.5, 34],
  [40, 40.5],
  [47, 47],
  [52, 52],
]
/** 개울 반폭 */
export const STREAM_W = 1.15

export interface Bridge {
  x: number
  z: number
  /** 다리가 놓인 방향(개울을 가로지르는 쪽) */
  rot: number
  len: number
  w: number
}

/** 개울을 건너는 나무다리. 개울 진행 방향에 수직으로 놓는다. */
export const BRIDGES: Bridge[] = (() => {
  const [ax, az] = STREAM[2]
  const [bx, bz] = STREAM[3]
  const along = Math.atan2(bx - ax, bz - az)
  return [{ x: (ax + bx) / 2, z: (az + bz) / 2, rot: along + Math.PI / 2, len: 4, w: 1.5 }]
})()

/** 섬 정비로 새로 놓은 다리(infra.ts). 길은 BRIDGES 와 같이 걸을 수 있고 높이도 같이 잰다. */
export const extraBridges: Bridge[] = []

/** 점에서 개울 가운데 선까지 거리와, 개울을 따라 몇 번째 마디쯤인지(0~마디 수) */
export function streamDist(x: number, z: number): { d: number; t: number } {
  let best = { d: Infinity, t: 0 }
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i]
    const [bx, bz] = STREAM[i + 1]
    const vx = bx - ax
    const vz = bz - az
    const k = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
    const d = Math.hypot(x - (ax + vx * k), z - (az + vz * k))
    if (d < best.d) best = { d, t: i + k }
  }
  return best
}

/** 다리 위인지. 다리 길이 방향으로 반 길이, 폭 방향으로 반 폭 안이면 위다. */
export function onBridge(x: number, z: number, pad = 0): Bridge | null {
  for (const b of [...BRIDGES, ...extraBridges]) {
    const dx = x - b.x
    const dz = z - b.z
    const along = dx * Math.sin(b.rot) + dz * Math.cos(b.rot)
    const across = dx * Math.cos(b.rot) - dz * Math.sin(b.rot)
    if (Math.abs(along) < b.len / 2 + pad && Math.abs(across) < b.w / 2 + pad) return b
  }
  return null
}

/** 다리 바닥 높이. 가운데가 살짝 솟은 아치형이라 걸어 건너면 올라갔다 내려온다. */
export const BRIDGE_DECK = 1.08
export const BRIDGE_ARCH = 0.12

export function bridgeHeight(b: Bridge, x: number, z: number): number {
  const along = (x - b.x) * Math.sin(b.rot) + (z - b.z) * Math.cos(b.rot)
  const k = Math.max(0, Math.min(1, along / b.len + 0.5))
  return BRIDGE_DECK + Math.sin(k * Math.PI) * BRIDGE_ARCH
}

const smooth = (e0: number, e1: number, v: number) => {
  const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)))
  return k * k * (3 - 2 * k)
}

/**
 * 원래 지형 높이 base 에서 물길만큼 파낸 높이와, 그 자리 물 높이(물이 없으면 null).
 * 연못은 가장자리에서 완만하게 깊어지고, 개울은 양옆 둑을 두고 바닥을 판다.
 */
export function carve(x: number, z: number, base: number): { h: number; water: number | null } {
  for (const p of PONDS) {
    const dd = Math.hypot(x - p.x, z - p.z) / p.r
    if (dd < 1.15) {
      const k = smooth(0, 0.4, 1 - dd / 1.15)
      const h = base + ((p.floor ?? 0.3) - base) * k
      return { h, water: dd < 1 ? pondLevel(p) : null }
    }
  }
  const sp = spoutDist(x, z)
  if (sp < SPOUT.w * 1.9) {
    // 윗면 물길: 양옆 둑을 두고 바닥을 조금 판다. 물은 연못과 같은 높이로 평평하게 흐른다.
    const k = smooth(0, 0.69, 1 - sp / (SPOUT.w * 1.9))
    return { h: base - 0.4 * k, water: sp < SPOUT.w && base > SPOUT_LEVEL ? SPOUT_LEVEL : null }
  }
  const s = streamDist(x, z)
  if (s.d < STREAM_W * 1.9) {
    // 물 높이는 둑 높이를 따라 내려간다: 잔디에선 연못과 같고, 절벽에서 뚝 떨어지고(폭포), 모래에선 바다로 이어진다.
    const water = Math.max(0.02, Math.min(POND_LEVEL, base - 0.28))
    // 둑을 넓게 눕혀야 지형 격자가 톱니처럼 드러나지 않는다(물가 높이는 예전과 같게 맞췄다).
    const k = smooth(0, 0.69, 1 - s.d / (STREAM_W * 1.9))
    const h = base + (water - 0.38 - base) * k
    return { h, water: s.d < STREAM_W ? water : null }
  }
  return { h: base, water: null }
}

/** 물이 있는 자리(연못·개울). 둑과 다리 위는 아니다. */
export function inWater(x: number, z: number, base: number): boolean {
  if (onBridge(x, z)) return false
  const c = carve(x, z, base)
  return c.water !== null && c.h < c.water - 0.04
}

/** 부두 판자 길: 부두에서 바다 쪽으로 뻗는다. world.ts 가 부두마다 한 줄씩 넣는다(걷기·높이 판정용). */
export interface PierLane {
  x: number
  z: number
  /** 섬 중심에서 바다 쪽을 향한 방향(부두 각도와 같다) */
  angle: number
  /** 부두에서 판자 끝까지의 길이 */
  len: number
}
/** 판자 길 반폭(판자 폭 1.5 의 절반) */
export const PIER_HALF = 0.75
/** 판자 윗면 높이: 바다 수면(0)보다 높다 */
export const PIER_DECK = 0.42
/** 원래 부두 판자 길이(뭍 위). 이 뒤쪽은 뭍에 그대로 둔다. */
export const PIER_LAND_LEN = 4.4
/** 바다 쪽으로 더 나가는 길이 */
export const PIER_REACH = 6
/** 판자 길 길이: 뭍 판자에 바다 쪽 연장을 더한다 */
export const PIER_LEN = PIER_LAND_LEN + PIER_REACH
export const piers: PierLane[] = []

/** 판자 기준 좌표: f 는 부두에서 바다 쪽 거리, s 는 판자 옆 거리. 판자 근처가 아니면 null. */
export function pierFrame(x: number, z: number, pad = 0.6): { f: number; s: number } | null {
  for (const p of piers) {
    const dx = x - p.x
    const dz = z - p.z
    const f = dx * Math.cos(p.angle) + dz * Math.sin(p.angle)
    const s = dx * Math.sin(p.angle) - dz * Math.cos(p.angle)
    if (f >= -pad && f <= p.len + pad && Math.abs(s) <= PIER_HALF + pad) return { f, s }
  }
  return null
}

/** 판자 위인지. 부두 바로 안쪽 땅은 제외(0.6 부터). */
export function onPier(x: number, z: number, pad = 0): PierLane | null {
  for (const p of piers) {
    const dx = x - p.x
    const dz = z - p.z
    const f = dx * Math.cos(p.angle) + dz * Math.sin(p.angle)
    const s = dx * Math.sin(p.angle) - dz * Math.cos(p.angle)
    if (f >= 0.6 - pad && f <= p.len + pad && Math.abs(s) <= PIER_HALF + pad) return p
  }
  return null
}
