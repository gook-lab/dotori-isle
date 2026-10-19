import { describe, expect, it } from 'vitest'
import { decodePaths, encodePaths, nearPath, paintTiles, pathCount, pathKeys, PATH_MAX, tileOutline } from './paths'

describe('길 칸 저장 — 문자열 왕복', () => {
  it('종류와 좌표를 그대로 되살린다', () => {
    const tiles = [
      { x: 1, z: -2, kind: 'dirt' as const },
      { x: 0, z: 0, kind: 'stone' as const },
      { x: -3, z: 4, kind: 'brick' as const },
    ]
    expect(decodePaths(encodePaths(tiles))).toEqual(tiles)
  })

  it('깨진 조각과 겹친 칸은 버린다', () => {
    expect(decodePaths('1,2d;x;1,2s;3,4q;5,6b')).toEqual([
      { x: 1, z: 2, kind: 'dirt' },
      { x: 5, z: 6, kind: 'brick' },
    ])
  })

  it('칸 수는 PATH_MAX 에서 멈춘다', () => {
    const raw = Array.from({ length: PATH_MAX + 20 }, (_, i) => `${i},0d`).join(';')
    expect(decodePaths(raw)).toHaveLength(PATH_MAX)
  })

  it('없거나 문자열이 아니면 빈 목록이다', () => {
    expect(decodePaths(undefined)).toEqual([])
    expect(decodePaths('')).toEqual([])
    expect(decodePaths(42)).toEqual([])
  })
})

describe('길 칸 놓기와 걷기', () => {
  it('같은 칸을 다시 누르면 걷어낸다', () => {
    const a = paintTiles([], 2, 3, 'stone')
    expect(a.done).toBe('added')
    const b = paintTiles(a.tiles, 2, 3, 'dirt')
    expect(b.done).toBe('removed')
    expect(b.tiles).toEqual([])
  })

  it('PATH_MAX 칸이 차면 더 놓지 않는다', () => {
    const full = decodePaths(Array.from({ length: PATH_MAX }, (_, i) => `${i},0d`).join(';'))
    expect(paintTiles(full, 999, 999, 'brick').done).toBe('full')
  })

  it('정돈 점수가 세는 칸 수는 저장된 칸 수와 같다', () => {
    expect(pathCount(encodePaths([{ x: 0, z: 0, kind: 'dirt' }, { x: 1, z: 0, kind: 'dirt' }]))).toBe(2)
  })
})

describe('길 모서리 — 이웃에 따라 둥글린다', () => {
  it('이웃이 없는 칸은 네 모서리를 모두 둥글린다(모서리마다 다섯 점)', () => {
    expect(tileOutline(0, false, false, false, false)).toHaveLength(20)
  })

  it('네 이웃이 다 있으면 사각형 네 점이다', () => {
    expect(tileOutline(0, true, true, true, true)).toEqual([
      [0.5, 0.5],
      [-0.5, 0.5],
      [-0.5, -0.5],
      [0.5, -0.5],
    ])
  })

  it('동쪽만 이웃이 있으면 막힌 두 모서리만 둥글린다', () => {
    expect(tileOutline(0, true, false, false, false)).toHaveLength(12)
  })

  it('바깥선은 칸 안쪽에 머물고, 안쪽선과 점 개수가 같다', () => {
    for (let m = 0; m < 16; m++) {
      const n = [!!(m & 1), !!(m & 2), !!(m & 4), !!(m & 8)] as const
      const outer = tileOutline(0, ...n)
      const inner = tileOutline(1, ...n)
      expect(inner).toHaveLength(outer.length)
      expect(outer.every(([x, z]) => Math.abs(x) <= 0.5 && Math.abs(z) <= 0.5)).toBe(true)
    }
  })
})

describe('길 주변 장식 거르기', () => {
  it('길 칸 위와 가장자리 근처만 걸리고, 멀면 안 걸린다', () => {
    const keys = pathKeys([{ x: 3, z: 3, kind: 'dirt' }])
    expect(nearPath(3, 3, keys)).toBe(true)
    expect(nearPath(3.6, 3.2, keys)).toBe(true)
    expect(nearPath(4.4, 3, keys)).toBe(false)
    expect(nearPath(-3, -3, keys)).toBe(false)
  })
})
