import { describe, expect, it } from 'vitest'
import { donorIds, dexProgress } from './dex'
import { dexHint } from './items'

describe('도감 진행도', () => {
  it('counts found species and rounds the share to a whole percent', () => {
    expect(dexProgress(['a', 'b', 'c'], { a: 1, c: 2 })).toEqual({ found: 2, total: 3, pct: 67 })
    expect(dexProgress(['a', 'b'], {})).toEqual({ found: 0, total: 2, pct: 0 })
  })

  it('is zero for an empty tab, without dividing by zero', () => {
    expect(dexProgress([], {})).toEqual({ found: 0, total: 0, pct: 0 })
  })
})

describe('기증 가능 종 고르기', () => {
  const ids = ['sea-bass', 'carp', 'fossil']
  it('keeps only seen, owned, not yet donated species', () => {
    const dex = { 'sea-bass': 1, carp: 1, fossil: 1 }
    expect(donorIds(ids, dex, [], [{ id: 'sea-bass', count: 1 }])).toEqual(['sea-bass'])
    expect(donorIds(ids, dex, ['sea-bass'], [{ id: 'sea-bass', count: 1 }])).toEqual([])
  })

  it('leaves out species not in the dex even when owned', () => {
    expect(donorIds(ids, {}, [], [{ id: 'carp', count: 2 }])).toEqual([])
  })
})

describe('도감 힌트 — 화석', () => {
  it('says where a fossil turns up, so an unseen one is still findable', () => {
    expect(dexHint('ammonite')).toBe('땅을 파면 나와요')
    expect(dexHint('fossil')).toBe('땅을 파면 나와요')
  })
})
