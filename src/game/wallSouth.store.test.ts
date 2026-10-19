import { describe, expect, it } from 'vitest'
import { NEW_HOME } from '../core/home'
import { wallCells } from '../core/wallHang'
import { migrateSave } from './store'

/** 예전 저장: 카메라 쪽(s) 벽에 건 사진 액자가 있던 집 */
const southCell = (stage: typeof NEW_HOME.stage) => wallCells(stage, 0).reduce((a, b) => (b.z > a.z || (b.z === a.z && b.x > a.x) ? b : a))

describe('예전 저장의 카메라 쪽 벽걸이', () => {
  it('s 벽에 걸렸던 액자는 같은 칸의 다른 벽으로 옮긴다', () => {
    const c = southCell(NEW_HOME.stage)
    const save = migrateSave({ homeFurniture: [{ id: 'w1', itemId: 'photo-frame', x: c.x, z: c.z, rot: 0, wall: 's' }] })
    expect(save.homeFurniture).toHaveLength(1)
    expect(save.homeFurniture[0].wall).not.toBe('s')
    expect(['n', 'e', 'w']).toContain(save.homeFurniture[0].wall)
    expect(save.inventory.some((s) => s.id === 'photo-frame')).toBe(false)
  })

  it('옮길 벽이 없으면 가방으로 돌려준다', () => {
    const c = southCell(NEW_HOME.stage)
    const save = migrateSave({
      homeFurniture: [
        // 같은 칸의 n, e, w 벽을 모두 막아 둔다
        { id: 'a', itemId: 'photo-frame', x: c.x, z: c.z, rot: 0, wall: 'n' },
        { id: 'b', itemId: 'photo-frame', x: c.x, z: c.z, rot: 0, wall: 'e' },
        { id: 'c', itemId: 'photo-frame', x: c.x, z: c.z, rot: 0, wall: 'w' },
        { id: 'w1', itemId: 'photo-frame', x: c.x, z: c.z, rot: 0, wall: 's' },
      ],
    })
    expect(save.homeFurniture.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(save.inventory.filter((s) => s.id === 'photo-frame')).toHaveLength(1)
  })

  it('바닥 가구는 그대로 둔다', () => {
    const save = migrateSave({ homeFurniture: [{ id: 'f1', itemId: 'chair', x: 0, z: 0, rot: 0 }] })
    expect(save.homeFurniture).toEqual([expect.objectContaining({ id: 'f1', itemId: 'chair', floor: 0 })])
    expect(save.homeFurniture[0].wall).toBeUndefined()
  })
})
