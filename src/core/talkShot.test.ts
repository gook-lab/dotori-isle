import { describe, expect, it } from 'vitest'
import { TALK_EYE_HEIGHT, terrainBlocksSight, type SightPoint } from './talkShot'

const flat = () => 0
/** x 가 wallX 를 넘는 자리는 높이 wallH 인 절벽(또는 둑) */
const cliffAt = (wallX: number, wallH: number) => (x: number) => (x > wallX ? wallH : 0)

/** 발 높이 0 인 두 얼굴 */
const faces = (ax: number, bx: number): SightPoint[] => [
  { x: ax, z: 0, y: TALK_EYE_HEIGHT },
  { x: bx, z: 0, y: TALK_EYE_HEIGHT },
]

describe('terrainBlocksSight', () => {
  it('평지에서는 카메라가 어느 자리에 있어도 가리지 않는다', () => {
    expect(terrainBlocksSight({ x: 4, z: 0, y: 1.75 }, faces(0, 1), flat)).toBe(false)
    expect(terrainBlocksSight({ x: -3, z: 2, y: 1.2 }, faces(0, 1), flat)).toBe(false)
  })

  it('두 얼굴 사이를 막는 절벽 앞 후보는 버려진다', () => {
    // 카메라가 x=4 에 있고 얼굴은 x=0,1. 그 사이 x=2.5 에 머리보다 높은 둑이 있다
    expect(terrainBlocksSight({ x: 4, z: 0, y: 1.75 }, faces(0, 1), cliffAt(2.5, 3))).toBe(true)
  })

  it('카메라를 충분히 높이면 낮은 둑 너머로 내려다볼 수 있다', () => {
    const bank = cliffAt(2.5, 1.9)
    expect(terrainBlocksSight({ x: 4, z: 0, y: 1.75 }, faces(0, 1), bank)).toBe(true)
    expect(terrainBlocksSight({ x: 4, z: 0, y: 8 }, faces(0, 1), bank)).toBe(false)
  })

  it('카메라가 절벽 옆 지형 속에 있으면 가린 것으로 본다', () => {
    expect(terrainBlocksSight({ x: 4, z: 0, y: 1.2 }, faces(0, 1), cliffAt(3.5, 2))).toBe(true)
  })
})
