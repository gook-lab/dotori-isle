import { describe, expect, it } from 'vitest'
import { BRIDGES } from './waters'
import { groundAt, heightAt, isWalkable } from './island'
import { flatAt, groundCell, placeBlocker, canPlace, tapCell, type PlaceLive } from './placement'
import { onStepSpot, PLATEAUS, plateauRimAt, RAMP_W } from './tiers'
import { SPAWN, SHOP_DOOR } from './world'

/** 섬 위의 격자 칸들. 조건에 맞는 첫 칸을 찾는 데 쓴다. */
function cellsWhere(test: (x: number, z: number) => boolean, limit = 1): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let x = -40; x <= 40 && out.length < limit; x++) {
    for (let z = -40; z <= 40 && out.length < limit; z++) {
      if (test(x, z)) out.push({ x, z })
    }
  }
  return out
}

/** 빈 땅의 평지 풀밭 칸 하나(놓기 가능한 기준점) */
function freeGrass(live: PlaceLive = {}) {
  const c = cellsWhere((x, z) => placeBlocker(x, z, [], [], live) === null && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 6 && Math.hypot(x - SHOP_DOOR.x, z - SHOP_DOOR.z) > 6)
  expect(c.length).toBe(1)
  return c[0]
}

describe('가구 놓기 판정 — 이유', () => {
  it('평지 풀밭에는 놓을 수 있다', () => {
    const c = freeGrass()
    expect(placeBlocker(c.x, c.z, [], [])).toBeNull()
    expect(canPlace(c.x, c.z, [], [])).toBe(true)
  })

  it('물 위에는 이유와 함께 막는다', () => {
    const w = cellsWhere((x, z) => groundAt(x, z) === 'water')
    expect(w.length).toBe(1)
    expect(placeBlocker(w[0].x, w[0].z, [], [])).toBe('물 위에는 놓을 수 없어요')
  })

  it('모래밭에는 놓을 수 없다', () => {
    const s = cellsWhere((x, z) => groundAt(x, z) === 'sand')
    expect(s.length).toBe(1)
    expect(placeBlocker(s[0].x, s[0].z, [], [])).toBe('모래밭에는 놓을 수 없어요')
  })

  it('다리 위에는 물가 문구 대신 다리 문구를 준다', () => {
    const b = BRIDGES[0]
    expect(placeBlocker(Math.round(b.x), Math.round(b.z), [], [])).toBe('다리 위에는 놓을 수 없어요')
  })

  it('경사진 칸은 놓을 수 없다', () => {
    const slope = cellsWhere((x, z) => groundAt(x, z) === 'grass' && isWalkable(x, z) && !flatAt(x, z))
    expect(slope.length).toBe(1)
    expect(placeBlocker(slope[0].x, slope[0].z, [], [])).toBe('경사진 곳이라 놓을 수 없어요')
  })

  it('경사로 자리에는 놓을 수 없다', () => {
    // 첫 언덕의 첫 경사로 방향, 절벽 바깥 계단 칸 한가운데
    const p = PLATEAUS[0]
    const a = p.ramps[0]
    const r = plateauRimAt(p, a) + RAMP_W / 2
    const x = Math.round(p.x + Math.cos(a) * r)
    const z = Math.round(p.z + Math.sin(a) * r)
    expect(onStepSpot(x, z)).toBe(true)
    expect(placeBlocker(x, z, [], [])).toBe('계단 자리라 놓을 수 없어요')
  })

  it('길 위에는 놓을 수 없지만 길 밖에는 놓을 수 있다', () => {
    const c = freeGrass()
    const paths = new Set([`${c.x},${c.z}`])
    expect(placeBlocker(c.x, c.z, [], [], { paths })).toBe('길 위에는 놓을 수 없어요')
    expect(placeBlocker(c.x + 1, c.z, [], [], { paths })).not.toBe('길 위에는 놓을 수 없어요')
  })

  it('이미 가구가 있는 칸과 꽃이 심긴 칸은 막는다', () => {
    const c = freeGrass()
    const placed = [{ id: 'a', itemId: 'chair', x: c.x, z: c.z, rot: 0 }]
    expect(placeBlocker(c.x, c.z, placed, [])).toBe('이미 가구가 놓인 자리예요')
    expect(placeBlocker(c.x, c.z, [], [{ x: c.x, z: c.z }])).toBe('꽃이 심긴 자리예요')
  })

  it('상점 문 앞과 처음 서는 자리는 비워 둔다', () => {
    expect(placeBlocker(Math.round(SPAWN.x), Math.round(SPAWN.z), [], [])).not.toBeNull()
    expect(placeBlocker(Math.round(SHOP_DOOR.x), Math.round(SHOP_DOOR.z), [], [])).not.toBeNull()
  })

  it('구멍이 난 칸은 막는다', () => {
    const c = freeGrass()
    const holes = [{ x: c.x, z: c.z, day: '2026-10-19' }] as unknown as PlaceLive['holes']
    expect(placeBlocker(c.x, c.z, [], [], { holes })).toBe('구멍이 있어 놓을 수 없어요')
  })

  it('canPlace 는 이유가 없을 때만 참이다', () => {
    const w = cellsWhere((x, z) => groundAt(x, z) === 'water')[0]
    expect(canPlace(w.x, w.z, [], [])).toBe(false)
  })
})

describe('가구 높이 — 언덕 단 위', () => {
  it('단 위의 평지 풀밭에도 놓을 수 있고, 그때 높이는 그 칸의 바닥 높이다', () => {
    const top = cellsWhere((x, z) => placeBlocker(x, z, [], []) === null && heightAt(x, z) > 1)
    expect(top.length).toBe(1)
    const { x, z } = top[0]
    expect(flatAt(x, z)).toBe(true)
    // 가구는 칸 중심의 바닥 높이에 선다(Furniture.tsx 와 같은 기준)
    expect(heightAt(x, z)).toBeGreaterThan(1)
  })
})

describe('손가락으로 찍은 칸', () => {
  it('찍은 방 바닥 점은 가장 가까운 격자 칸이 된다', () => {
    expect(tapCell(1.2, -0.4)).toEqual({ x: 1, z: 0 })
    expect(tapCell(-2.6, 3.4)).toEqual({ x: -3, z: 3 })
    expect(tapCell(0, 0)).toEqual({ x: 0, z: 0 })
  })
})

describe('지면과 만나는 탭 광선', () => {
  it('평평한 땅이면 광선이 땅을 만나는 칸이 된다', () => {
    // 원점 (4, 10, 0) 에서 (-1, -1, 0) 방향: 높이 2 땅과 만나는 곳은 x = -4
    expect(groundCell(4, 10, 0, -1, -1, 0, () => 2)).toEqual({ x: -4, z: 0 })
  })

  it('경사진 땅이면 높이를 되풀이해 맞춘 칸을 쓴다', () => {
    // 땅 높이 0.2x + 1 과 광선 y = 10 - t, x = 4 - t 는 t = 10.25 에서 만나 x = -6.25 → -6
    expect(groundCell(4, 10, 0, -1, -1, 0, (x) => 0.2 * x + 1)).toEqual({ x: -6, z: 0 })
  })

  it('광선이 위를 향하거나 수평이면 지면을 못 만난다', () => {
    expect(groundCell(0, 5, 0, 0, 1, 0, () => 0)).toBeNull()
    expect(groundCell(0, 5, 0, 1, 0, 0, () => 0)).toBeNull()
  })

  it('음수 칸은 -0 이 되지 않는다', () => {
    expect(groundCell(0, 5, 0, 0, -1, 0, () => 0)).toEqual({ x: 0, z: 0 })
  })
})
