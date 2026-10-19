import { describe, expect, it } from 'vitest'
import { pickStowTarget, STOW_JUST_MS, STOW_JUST_NEAR, STOW_NEAR } from './homeStow'

const tbl = { id: 'a', x: 0, z: 1 }
const lamp = { id: 'b', x: 3, z: 3 }

describe('방 가구 넣기 대상', () => {
  it('가까운 가구 하나를 고르고, 닿지 않으면 null 이다', () => {
    expect(pickStowTarget([tbl, lamp], 0, 0.5, 0, null, 0)?.id).toBe('a')
    expect(pickStowTarget([tbl, lamp], -3, -3, 0, null, 0)).toBeNull()
  })

  it('방금 놓은 가구는 STOW_NEAR 밖이라도 한 칸 더 넓은 거리 안이면 먼저 잡는다', () => {
    const far = { id: 'a', x: 0, z: 1 }
    const lx = 0
    const lz = 1 + STOW_NEAR + 0.2
    expect(STOW_NEAR + 0.2).toBeLessThan(STOW_JUST_NEAR)
    expect(pickStowTarget([far], lx, lz, 0, null, 0)).toBeNull()
    expect(pickStowTarget([far], lx, lz, 0, { id: 'a', at: 1000 }, 1000 + 500)?.id).toBe('a')
  })

  it('3초가 지나면 방금 놓은 우선은 없어진다', () => {
    const lz = 1 + STOW_NEAR + 0.2
    expect(pickStowTarget([tbl], 0, lz, 0, { id: 'a', at: 0 }, STOW_JUST_MS)).toBeNull()
  })

  it('방금 놓은 가구보다 더 가까운 다른 가구가 있으면 그것을 고른다', () => {
    const near = { id: 'b', x: 0, z: 0.4 }
    const just = { id: 'a', x: 0, z: 2 }
    expect(pickStowTarget([just, near], 0, 0.5, 0, { id: 'a', at: 0 }, 100)?.id).toBe('a')
    expect(pickStowTarget([just, near], 0, 0.5, 0, null, 100)?.id).toBe('b')
  })

  it('다른 층의 가구는 고르지 않는다', () => {
    const up = { id: 'c', x: 0, z: 0, floor: 1 }
    expect(pickStowTarget([up], 0, 0, 0, null, 0)).toBeNull()
    expect(pickStowTarget([up], 0, 0, 1, null, 0)?.id).toBe('c')
  })
})
