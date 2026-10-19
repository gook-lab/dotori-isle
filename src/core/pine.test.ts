import { describe, expect, it } from 'vitest'
import { PINE_BRANCH_CHANCE, PINE_BUG_CHANCE, PINE_BUG_ID, pineShake } from './pine'
import { ITEMS } from './items'

describe('소나무 흔들기', () => {
  it('drops a branch in the first fifth of rolls', () => {
    expect(pineShake(0)).toEqual({ kind: 'branch' })
    expect(pineShake(PINE_BRANCH_CHANCE - 0.001)).toEqual({ kind: 'branch' })
  })

  it('drops a bug in the next slice, and only that', () => {
    expect(pineShake(PINE_BRANCH_CHANCE)).toEqual({ kind: 'bug', id: PINE_BUG_ID })
    expect(pineShake(PINE_BRANCH_CHANCE + PINE_BUG_CHANCE - 0.001)).toEqual({ kind: 'bug', id: PINE_BUG_ID })
  })

  it('otherwise only the needles rustle', () => {
    expect(pineShake(PINE_BRANCH_CHANCE + PINE_BUG_CHANCE)).toEqual({ kind: 'none' })
    expect(pineShake(0.99)).toEqual({ kind: 'none' })
  })

  it('the bug it drops is a real bug item, and the branch is the wood item', () => {
    expect(ITEMS[PINE_BUG_ID].kind).toBe('bug')
    expect(ITEMS.wood.kind).toBe('material')
  })
})
