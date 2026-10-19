import { describe, expect, it } from 'vitest'
import { clearStepSpots } from './stepClear'
import { PLATEAUS, plateauRimAt, RAMP_W } from './tiers'
import { onStepSpot } from './tiers'
import type { Placed } from './placement'

/** 가장 큰 언덕 경사로 가운데의 계단 칸 위 점 */
const summit = PLATEAUS.find((p) => p.id === 'summit') ?? PLATEAUS[0]
const stepPoint = () => {
  const a = summit.ramps[0]
  const r = plateauRimAt(summit, a) + RAMP_W / 2
  return { x: summit.x + Math.cos(a) * r, z: summit.z + Math.sin(a) * r }
}
const FAR = { x: 0, z: 0 }
const item = (id: string, p: { x: number; z: number }): Placed => ({ id, itemId: 'chair', x: p.x, z: p.z, rot: 0 })

describe('계단 자리 정리 — 물건은 주머니로, 길·정원 칸은 그 칸만', () => {
  it('계단 자리 물건만 돌려 주고, 나머지는 그대로 둔다', () => {
    const on = stepPoint()
    expect(onStepSpot(on.x, on.z)).toBe(true)
    const r = clearStepSpots([item('a', on), item('b', FAR)], '', '')
    expect(r.back.map((p) => p.id)).toEqual(['a'])
    expect(r.placed.map((p) => p.id)).toEqual(['b'])
  })

  it('계단 자리 길 칸과 정원 칸만 지우고, 나머지 칸은 그대로 둔다', () => {
    const on = stepPoint()
    const cx = Math.round(on.x)
    const cz = Math.round(on.z)
    expect(onStepSpot(cx, cz)).toBe(true)
    const r = clearStepSpots([], `${cx},${cz}d;0,0d`, `${cx},${cz}g;0,0g`)
    expect(r.pathsRaw).toBe('0,0d')
    expect(r.gardenRaw).toBe('0,0g')
    expect(r.pathsCleared).toBe(1)
    expect(r.gardenCleared).toBe(1)
  })

  it('자리가 없으면 아무것도 바꾸지 않는다', () => {
    const r = clearStepSpots([item('b', FAR)], '0,0d', '0,0g')
    expect(r.back).toEqual([])
    expect(r.pathsRaw).toBe('0,0d')
    expect(r.gardenRaw).toBe('0,0g')
    expect(r.pathsCleared + r.gardenCleared).toBe(0)
  })
})
