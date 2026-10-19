import { describe, expect, it } from 'vitest'
import { heightAt } from './island'
import { canPlace, placeBlocker } from './placement'
import { onRamp } from './placement'
import { PLATEAUS } from './tiers'

/** 섬 둘레 안쪽을 격자로 훑는다. 바깥 바다와 먼 곳은 빼고, 절벽 띠 둘레 1.5 안을 중심으로 본다. */
function cliffRingPoints(step = 0.5) {
  const out: { x: number; z: number }[] = []
  for (const p of PLATEAUS) {
    for (let x = p.x - p.r * 1.6; x <= p.x + p.r * 1.6; x += step) {
      for (let z = p.z - p.r * 1.6; z <= p.z + p.r * 1.6; z += step) {
        const d = Math.hypot(x - p.x, z - p.z)
        if (d > p.r - 1 && d < p.r + 2) out.push({ x, z })
      }
    }
  }
  return out
}

describe('야외 가구 놓기 자리', () => {
  it('계단·경사로 칸에는 놓을 수 없다', () => {
    const points = cliffRingPoints().filter((q) => onRamp(q.x, q.z))
    // 계단 띠가 실제로 있어야 이 테스트가 의미가 있다
    expect(points.length).toBeGreaterThan(0)
    for (const q of points) expect(canPlace(q.x, q.z, []), `${q.x},${q.z}`).toBe(false)
  })

  it('놓을 수 있는 자리는 주변 높이가 평평하다(절벽 끝·턱 위에 뜨지 않는다)', () => {
    // 가구 발자국(반지름 0.5 안)에서 높이가 뛰는 곳이면 놓을 수 없다
    const bad: string[] = []
    for (const q of cliffRingPoints(0.5)) {
      if (!canPlace(q.x, q.z, [])) continue
      const h = heightAt(q.x, q.z)
      for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
        if (Math.abs(heightAt(q.x + dx, q.z + dz) - h) > 0.12) bad.push(`${q.x},${q.z}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('물가·다리·물 위에는 막힌 이유를 알려 준다', () => {
    // 물 위 한 점(섬 밖 먼 바다)
    expect(placeBlocker(200, 200, [])).not.toBeNull()
  })
})
