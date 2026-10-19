import { FISH_TABLE, speciesFor } from './items'
import { pickWeighted, type Rng } from './rng'

/**
 * 낚시 상태 기계. 던지기 → 기다리기 → 입질 → 감기 순서로 진행한다.
 * 입질 창 안에서 누르면 낚이고, 너무 일찍 누르거나 창을 놓치면 도망간다.
 */

export const CAST_TIME = 0.45
export const BITE_WINDOW = 0.75
export const REEL_TIME = 0.9

interface Line {
  t: number
  x: number
  z: number
  /** 빈 문자열이면 근처에 물고기가 없어 아무것도 물지 않는다. */
  fishId: string
  /** 다가오는 그림자. from 에서 출발해 approach 초 만에 찌에 닿는다. */
  lure?: { id: string; fx: number; fz: number; approach: number }
}

export type FishingState =
  | { phase: 'idle' }
  | (Line & { phase: 'cast' | 'wait'; biteAt: number })
  | (Line & { phase: 'bite' })
  | (Line & { phase: 'reel'; result: 'caught' | 'escaped' })

export type FishingEvent = { type: 'caught'; fishId: string } | { type: 'escaped'; early: boolean; lureId?: string } | { type: 'nothing' }

type Step = [FishingState, FishingEvent | null]

export function startCast(x: number, z: number, rng: Rng, night: boolean, rain = false): FishingState {
  const fish = pickWeighted(speciesFor(FISH_TABLE, night, rain), rng)
  return { phase: 'cast', t: 0, x, z, fishId: fish.id, biteAt: 1.6 + rng() * 3.4 }
}

/** 그림자를 노리고 던졌다. 그림자가 헤엄쳐 오는 시간과 톡톡 건드리는 시간이 지나야 문다. */
export function castAtShadow(x: number, z: number, rng: Rng, shadow: { id: string; fishId: string; x: number; z: number }): FishingState {
  const approach = Math.min(3, 0.8 + Math.hypot(shadow.x - x, shadow.z - z) / 1.4)
  const nibble = 0.8 + rng() * 2.2
  return {
    phase: 'cast',
    t: 0,
    x,
    z,
    fishId: shadow.fishId,
    biteAt: approach + nibble,
    lure: { id: shadow.id, fx: shadow.x, fz: shadow.z, approach },
  }
}

/** 근처에 그림자가 없다. 한참 기다려도 아무것도 안 문다. */
export function castEmpty(x: number, z: number): FishingState {
  return { phase: 'cast', t: 0, x, z, fishId: '', biteAt: 4 }
}

export function tickFishing(s: FishingState, dt: number): Step {
  if (s.phase === 'idle') return [s, null]
  const t = s.t + dt
  switch (s.phase) {
    case 'cast':
      return [t >= CAST_TIME ? { ...s, phase: 'wait', t: 0 } : { ...s, t }, null]
    case 'wait':
      if (t < s.biteAt) return [{ ...s, t }, null]
      if (!s.fishId) return [{ phase: 'reel', t: 0, x: s.x, z: s.z, fishId: '', result: 'escaped' }, { type: 'nothing' }]
      return [{ phase: 'bite', t: 0, x: s.x, z: s.z, fishId: s.fishId, lure: s.lure }, null]
    case 'bite':
      if (t >= BITE_WINDOW) return [{ ...s, phase: 'reel', t: 0, result: 'escaped' }, { type: 'escaped', early: false, lureId: s.lure?.id }]
      return [{ ...s, t }, null]
    case 'reel':
      return [t >= REEL_TIME ? { phase: 'idle' } : { ...s, t }, null]
  }
}

export function pressFishing(s: FishingState): Step {
  if (s.phase === 'wait') {
    const { x, z, fishId, lure } = s
    // 물고기가 아직 다가오는 중이면 놀라 달아난다. 빈 바다면 그냥 거둬들인다.
    if (!fishId) return [{ phase: 'reel', t: 0, x, z, fishId, result: 'escaped' }, null]
    return [{ phase: 'reel', t: 0, x, z, fishId, lure, result: 'escaped' }, { type: 'escaped', early: true, lureId: lure?.id }]
  }
  if (s.phase === 'bite') {
    return [{ ...s, phase: 'reel', t: 0, result: 'caught' }, { type: 'caught', fishId: s.fishId }]
  }
  return [s, null]
}
