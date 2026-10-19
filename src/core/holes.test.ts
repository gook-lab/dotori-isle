import { describe, expect, it } from 'vitest'
import { blockedByHoles, canDigAt, HOLE_R, MAX_HOLES, type DigWorld } from './holes'
import { SPAWN, TREES } from './world'
import { groundAt } from './island'

const empty: DigWorld = { placed: [], plants: [], houses: [], holes: [], felled: {}, day: '2026-05-01', villagers: [] }

/** 막힌 곳 없이 땅을 팔 수 있는 자리를 섬 안에서 찾는다. */
const openSpot = () => {
  for (let x = -20; x <= 20; x += 0.5)
    for (let z = -20; z <= 20; z += 0.5)
      if (groundAt(x, z) === 'grass' && canDigAt(x, z, empty)) return { x, z }
  throw new Error('no open spot')
}

describe('hole placement', () => {
  it('digs on open grass and refuses water, trees and spots beside other holes', () => {
    const o = openSpot()
    expect(canDigAt(o.x, o.z, empty)).toBe(true)
    const t = TREES.find((tr) => tr.kind === 'fruit')!
    expect(canDigAt(t.x, t.z, empty)).toBe(false)
    expect(canDigAt(o.x, o.z, { ...empty, holes: [{ id: 'h', x: o.x + 0.5, z: o.z }] })).toBe(false)
  })

  it('refuses a stump or sapling spot so digging never lands on the tree base', () => {
    const t = TREES.find((tr) => tr.kind === 'fruit')!
    const w = { ...empty, felled: { [t.id]: { state: 'sapling' as const, day: '2026-05-01' } }, day: '2026-05-01' }
    expect(canDigAt(t.x + 0.3, t.z, w)).toBe(false)
  })

  it('refuses a hole that would close off every way out of the player', () => {
    const o = openSpot()
    const ring = (r: number) => Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return { x: o.x + Math.sin(a) * r, z: o.z + Math.cos(a) * r }
    })
    const player = { x: o.x, z: o.z }
    // 일곱 방향을 이미 구멍으로 막아 두면, 여덟 번째 방향만 열려 있다.
    const holes = ring(1.2).slice(1).map((p, i) => ({ id: `h${i}`, ...p }))
    const last = ring(1.2)[0]
    const world = { ...empty, holes }
    // 열린 방향이 하나 남은 자리에서 그 방향을 막으면 갇히므로 거부한다.
    expect(canDigAt(last.x * 0.75 + player.x * 0.25, last.z * 0.75 + player.z * 0.25, world, player)).toBe(false)
    // 구멍이 하나도 없던 자리는 그대로 판다.
    expect(canDigAt(last.x * 0.75 + player.x * 0.25, last.z * 0.75 + player.z * 0.25, empty, player)).toBe(true)
  })

  it('caps the number of holes', () => {
    expect(MAX_HOLES).toBe(60)
  })
})

describe('hole blocking', () => {
  it('blocks the hole and the body margin around it', () => {
    const holes = [{ id: 'h', x: 0, z: 0 }]
    expect(blockedByHoles(0, 0, holes)).toBe(true)
    expect(blockedByHoles(HOLE_R + 0.1, 0, holes)).toBe(false)
    expect(blockedByHoles(HOLE_R + 0.1, 0, holes, 0.3)).toBe(true)
  })

  it('a hole in front does not block the open ground beside it', () => {
    const holes = [{ id: 'h', x: 1, z: 0 }]
    expect(blockedByHoles(0, 1, holes, 0.3)).toBe(false)
    expect(SPAWN).toBeDefined()
  })
})
