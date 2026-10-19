/**
 * 계절 지형 순수 계산: 가을 낙엽더미, 겨울 얼음 연못과 눈, 봄 꽃잎. 씨앗과 날짜로 정하므로 새로고침해도 같다.
 */
import { hashString, mulberry32 } from './rng'
import { byWater, groundAt, isWalkable, islandDist } from './island'
import { blockedByProps } from './world'

/** 위치 한 점. 꽃잎처럼 매 프레임 쓰는 자리는 out 인자로 같은 객체를 넘긴다. */
type Vec3 = { x: number; y: number; z: number }
import { PONDS, type Pond } from './waters'
import { seasonFor } from './season'
import { blockedByScenery } from './scenery'

/** 깊은 겨울(1~2월): 작은 연못이 통째로 언다 */
export function isDeepWinter(day: string): boolean {
  const m = Number(day.slice(5, 7))
  return m === 1 || m === 2
}

/** 작은 연못(반지름 4 미만)은 깊은 겨울에 통째로 언다. 큰 연못은 가장자리에만 얼음이 얇게 낀다. */
export function pondFrozen(p: Pond, day: string): boolean {
  return isDeepWinter(day) && p.r < 4 && seasonFor(day) === 'winter'
}

/** (x,z) 가 완전히 언 연못 위인지(가장자리 0.2 는 뺀다) */
export function frozenAt(x: number, z: number, day: string): boolean {
  return PONDS.some((p) => pondFrozen(p, day) && Math.hypot(x - p.x, z - p.z) < p.r - 0.2)
}

/** 가을 낙엽더미 자리: 풀밭 평지에 흩어 놓는다. 같은 씨앗이면 같다. */
export function leafPileSpots(count = 12): { id: string; x: number; z: number }[] {
  const rng = mulberry32(hashString('leaf-piles'))
  const out: { id: string; x: number; z: number }[] = []
  for (let i = 0; i < 4000 && out.length < count; i++) {
    const x = (rng() * 2 - 1) * 26
    const z = (rng() * 2 - 1) * 26
    const d = islandDist(x, z)
    if (d < 0.2 || d > 0.7) continue
    if (groundAt(x, z) !== 'grass' || !isWalkable(x, z)) continue
    if (blockedByProps(x, z, 1) || blockedByScenery(x, z, 0.8) || byWater(x, z, 1)) continue
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue
    out.push({ id: `leaf-${out.length}`, x, z })
  }
  return out
}

let leafCache: { id: string; x: number; z: number }[] | null = null
/** 가을 낙엽더미 자리(한 번만 구한다). 장면과 행동이 같은 자리를 쓴다. */
export function leafPiles() {
  return (leafCache ??= leafPileSpots())
}

/** 가을 땅에 떨어진 낙엽 조각 자리: 나무 밑동 둘레 0.9~2.2 거리에 나무마다 perTree 장. 같은 나무는 늘 같은 자리다. */
export function groundLeafSpots(trees: readonly { x: number; z: number }[], perTree = 6): { x: number; z: number; rot: number; tone: number }[] {
  const out: { x: number; z: number; rot: number; tone: number }[] = []
  trees.forEach((t, i) => {
    const rng = mulberry32(hashString(`ground-leaf:${i}`))
    for (let j = 0; j < perTree; j++) {
      const a = rng() * Math.PI * 2
      const r = 0.9 + rng() * 1.3
      out.push({ x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r, rot: rng() * Math.PI * 2, tone: Math.floor(rng() * 4) })
    }
  })
  return out
}

/** 낙엽더미를 찼을 때 도토리가 나오는지. 더미와 날짜마다 정해져 있어서 같은 날 같은 더미는 늘 같다. */
export function kickAcorn(pileId: string, day: string): boolean {
  return mulberry32(hashString(`kick:${pileId}:${day}`))() < 1 / 3
}

/** 꽃잎 한 장의 위치: 나무 둘레에서 천천히 흩날리며 떨어진다. t 는 초. */
export function petalAt(origin: { x: number; y: number; z: number }, seed: number, t: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const fall = ((t * 0.22 + seed) % 1) * 3
  out.x = origin.x + Math.sin(t * 0.5 + seed * 6.3) * 1.6 + Math.cos(t * 0.23 + seed) * 0.4
  out.y = origin.y + 3 - fall
  out.z = origin.z + Math.cos(t * 0.4 + seed * 3.1) * 1.6
  return out
}

/** 봄 꽃잎이 날리는 나무: 열매 나무만 쓴다 */
export function blossomSpotsOf<T extends { kind: string }>(trees: readonly T[]): T[] {
  return trees.filter((t) => t.kind === 'fruit')
}

