export type Rng = () => number

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickWeighted<T extends { weight: number }>(list: readonly T[], rng: Rng): T {
  const total = list.reduce((sum, e) => sum + e.weight, 0)
  let roll = rng() * total
  for (const e of list) {
    roll -= e.weight
    if (roll < 0) return e
  }
  return list[list.length - 1]
}

/** 로컬 시간 기준 YYYY-MM-DD. 하루 단위 리스폰의 키로 쓴다. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
