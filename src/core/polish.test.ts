import { describe, expect, it } from 'vitest'
import { FALLS_AT, GRASS_EDGE, islandDist } from './island'
import { GUESTS } from './guests'
import { morningLetter } from './letters'
import { MILESTONES } from './miles'

describe('물소리 · 손님 편지 · 새 마일리지', () => {
  it('폭포 소리 자리는 잔디 끝 절벽 근처다', () => {
    expect(Math.abs(islandDist(FALLS_AT.x, FALLS_AT.z) - GRASS_EDGE)).toBeLessThan(0.05)
  })

  it('이사 오기 전 손님은 오렌지 섬이나 이사 준비 이야기를 편지에 쓴다', () => {
    const g = GUESTS[0]
    const friendship = { [g.id]: 1 }
    const met = morningLetter('2026-10-18', friendship)!
    expect(met.from).toBe(g.id)
    expect(met.text).toMatch(/오렌지 섬/)
    const waiting = morningLetter('2026-10-18', friendship, { houses: [], recruits: [g.id] })!
    expect(waiting.text).toMatch(/이사|집/)
    const moved = morningLetter('2026-10-18', friendship, { houses: [g.id], recruits: [g.id] })!
    expect(moved.text).not.toMatch(/오렌지 섬에서 만나서/)
  })

  it('손님 초대 · 민물 낚시 · 덤불 뒤적이기도 마일리지가 된다', () => {
    const ids = MILESTONES.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['recruit', 'fish-fresh', 'rustle']))
  })
})
