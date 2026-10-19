import { describe, expect, it } from 'vitest'
import { dayGap, pruneRegrown, REGROW_DAYS, treeState } from './trees'
import { blockedByProps, TREES } from './world'

describe('felled trees by day', () => {
  it('a felled tree is a stump until it is dug, then a sapling that regrows after the set days', () => {
    const day = '2026-05-01'
    const felled = { 'tree-1': { state: 'stump' as const, day } }
    expect(treeState('tree-1', felled, day)).toBe('stump')
    const sapling = { 'tree-1': { state: 'sapling' as const, day } }
    expect(treeState('tree-1', sapling, '2026-05-02')).toBe('sapling')
    expect(treeState('tree-1', sapling, '2026-05-03')).toBe('sapling')
    expect(treeState('tree-1', sapling, '2026-05-04')).toBe('tree')
    expect(REGROW_DAYS).toBe(3)
  })

  it('counts days across month ends and leaves untouched trees standing', () => {
    expect(dayGap('2026-01-30', '2026-02-02')).toBe(3)
    expect(treeState('other', {}, '2026-05-01')).toBe('tree')
  })

  it('prunes saplings that have grown back into trees', () => {
    const felled = {
      a: { state: 'sapling' as const, day: '2026-05-01' },
      b: { state: 'sapling' as const, day: '2026-05-03' },
      c: { state: 'stump' as const, day: '2026-04-01' },
    }
    expect(Object.keys(pruneRegrown(felled, '2026-05-04')).sort()).toEqual(['b', 'c'])
  })

  it('a stump blocks walking like a small prop, a sapling does not, and a standing tree blocks as before', () => {
    const t = TREES[0]
    const day = '2026-05-01'
    expect(blockedByProps(t.x, t.z, 0)).toBe(true)
    const stump = { [t.id]: { state: 'stump' as const, day } }
    expect(blockedByProps(t.x, t.z, 0, stump, day)).toBe(true)
    // 줄기 한가운데는 그루터기도 막지만, 가장자리(줄기 반경 밖)는 풀린다.
    expect(blockedByProps(t.x + 0.5, t.z, 0, stump, day)).toBe(false)
    const sapling = { [t.id]: { state: 'sapling' as const, day } }
    expect(blockedByProps(t.x, t.z, 0, sapling, day)).toBe(false)
  })
})
