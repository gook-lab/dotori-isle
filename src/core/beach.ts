/**
 * 바닷가 장식: 떠밀려 온 나무토막과 해초 무더기 자리. 섬 둘레의 모래 띠에만 놓고, 같은 자리가 늘 나오게 씨앗으로 뽑는다.
 */
import { heightAt, islandDist, radiusAt } from './island'
import { hashString, mulberry32 } from './rng'
import { blockedByProps } from './world'
import { onPier } from './waters'

export type BeachKind = 'log' | 'weed'
export interface BeachSpot {
  x: number
  z: number
  rot: number
  kind: BeachKind
  scale: number
}

/** 모래 띠(물가 가까이)의 장식 자리 목록 */
export function beachDecor(): BeachSpot[] {
  const rng = mulberry32(hashString('beach-decor'))
  const out: BeachSpot[] = []
  let logs = 0
  for (let i = 0; i < 4000 && out.length < 36; i++) {
    const th = rng() * Math.PI * 2
    const r = radiusAt(th) * (0.97 + rng() * 0.03)
    const x = Math.cos(th) * r
    const z = Math.sin(th) * r
    const d = islandDist(x, z)
    if (d < 0.9 || d >= 1) continue
    if (heightAt(x, z) > 0.3 || onPier(x, z, 0.5) || blockedByProps(x, z, 0.4)) continue
    if (out.some((s) => Math.hypot(s.x - x, s.z - z) < 1.4)) continue
    const kind: BeachKind = logs < 10 && rng() < 0.35 ? 'log' : 'weed'
    if (kind === 'log') logs++
    out.push({ x, z, rot: rng() * Math.PI * 2, kind, scale: 0.8 + rng() * 0.4 })
  }
  return out
}
