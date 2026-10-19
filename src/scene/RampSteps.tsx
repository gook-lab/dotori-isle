import { useMemo } from 'react'
import * as THREE from 'three'
import { baseHeightAt, heightAt } from '../core/island'
import { PLATEAUS, plateauRimAt, RAMP_STEPS, RAMP_W, stepHalfWidth } from '../core/tiers'
import { Merge, shape, useMerged, vertexToonMaterial, xf } from './batching'
import { withNightTone } from './worldFx'
import type { Season } from '../core/season'

/** 칸 윗면(밝은 돌), 칸 앞면 몸통(짙은 석재), 칸 바깥 모서리 풀색 띠. */
const TREAD = '#b9a57f'
const RISER = '#7d6a4f'
const RIM = '#7fae5a'
/** 겨울에는 칸 윗면과 풀 띠 대신 눈이 덮인다. 지형 눈 덮임(Island.tsx SNOW)과 같은 흰색 계열. */
const TREAD_SNOW = '#dfe6ec'
const RIM_SNOW = '#f3f7fa'

/**
 * 경사로 계단: 절벽 바깥(아래층 땅 위)에 돌 칸을 붙여 세운다. 맨 아래 칸은 땅에서, 맨 위 칸 윗면은 언덕 윗면(절벽 윗선)과 맞는다.
 * 칸마다 아래면은 바로 아래 칸 윗면(첫 칸은 땅 아래)까지 꽉 찬 상자라, 칸 옆면이 곧 계단 벽이다.
 * 지형은 손대지 않는다. 칸 블록이 그 위를 덮는다. 칸 전체를 한 덩어리로 묶어 draw call 은 한두 개만 쓴다.
 */
export function RampSteps({ season }: { season: Season }) {
  const winter = season === 'winter'
  // 밤 톤을 받아야 지형과 같이 어두워진다(기본 재질은 낮 밝기로 남아 분홍빛으로 떠 보였다)
  const lit = useMemo(() => withNightTone(vertexToonMaterial(), 'field'), [])
  const g = useMerged(
    (b) => {
      const depth = RAMP_W / RAMP_STEPS
      for (const p of PLATEAUS) {
        for (const a of p.ramps) {
          const rim = plateauRimAt(p, a)
          // 칸 블록은 절벽 벽이 끊기는 각도(RAMP_HALF_ANGLE)보다 양옆 0.15 넓어, 끊긴 벽 끝과 지형 쐐기를 덮는다
          const LAT = 2 * stepHalfWidth(rim)
          const rot: [number, number, number] = [0, -a, 0]
          // 칸은 바깥(j=0)에서 안쪽으로 한 칸씩 높아진다. 칸 가운데 높이가 walk 높이다.
          let below: number | null = null
          for (let j = 0; j < RAMP_STEPS; j++) {
            const uc = (j + 0.5) / RAMP_STEPS
            const rc = rim + (1 - uc) * RAMP_W
            const xc = p.x + Math.cos(a) * rc
            const zc = p.z + Math.sin(a) * rc
            const top = heightAt(xc, zc)
            const base = below ?? baseHeightAt(xc, zc) - 0.6
            below = top
            const h = top - base
            // 칸 윗면 판(밝은 돌) + 앞면 몸통(짙은 돌). 몸통이 아래 칸까지 닿아 틈이 없다.
            const slab = Math.min(0.06, h / 2)
            b.add(shape(THREE.BoxGeometry, depth, slab, LAT), xf([xc, top - slab / 2, zc], rot), winter ? TREAD_SNOW : TREAD, { outline: 0.03, cast: false })
            b.add(shape(THREE.BoxGeometry, depth, h - slab, LAT), xf([xc, (top - slab + base) / 2, zc], rot), RISER, { outline: 0.03, cast: false })
            // 칸 바깥 모서리 풀색 띠(칸 윗면 바로 위)
            const ro = rim + (1 - j / RAMP_STEPS) * RAMP_W
            const ex = p.x + Math.cos(a) * ro
            const ez = p.z + Math.sin(a) * ro
            b.add(shape(THREE.BoxGeometry, 0.14, 0.06, LAT), xf([ex, top + 0.03, ez], rot), winter ? RIM_SNOW : RIM, { outline: 0, cast: false })
          }
        }
      }
    },
    [winter],
  )
  return <Merge g={g} lit={lit} />
}
