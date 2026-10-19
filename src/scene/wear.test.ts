import { describe, expect, it } from 'vitest'
import { CHOPS_PER_TREE, HITS_PER_ROCK } from '../game/store'
import { chipSpots, crackSpots, notchAngles, PEBBLE_SPOTS } from './wear'

describe('나무 자국 — 자국 수가 횟수를 따라간다', () => {
  it('횟수만큼 자국이 생기고, 0이면 나뭇조각도 없다', () => {
    expect(notchAngles(0)).toHaveLength(0)
    for (let n = 1; n <= CHOPS_PER_TREE; n++) expect(notchAngles(n)).toHaveLength(n)
    expect(chipSpots(0)).toHaveLength(0)
    expect(chipSpots(1).length).toBeGreaterThan(0)
    expect(chipSpots(CHOPS_PER_TREE).length).toBeGreaterThan(chipSpots(1).length)
  })
})

describe('바위 금 — 맞을수록 늘고 다 쓰면 돌 조각이 생긴다', () => {
  it('맞은 만큼 금이 생기고 넘치지 않는다', () => {
    expect(crackSpots(0)).toHaveLength(0)
    for (let h = 1; h <= HITS_PER_ROCK; h++) expect(crackSpots(h)).toHaveLength(h)
    expect(crackSpots(HITS_PER_ROCK + 3)).toHaveLength(HITS_PER_ROCK)
  })
  it('돌 조각은 다 쓴 바위에 여러 개 있다', () => {
    expect(PEBBLE_SPOTS.length).toBeGreaterThan(1)
  })
})
