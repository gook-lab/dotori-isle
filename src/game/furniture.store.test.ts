import { beforeEach, describe, expect, it } from 'vitest'
import { migrateSave, useGame } from './store'

beforeEach(() => {
  useGame.setState({ inventory: [], placed: [], homeFurniture: [], homeStorage: [], furnitureSeen: [], letters: [] })
})

describe('가구 도감 저장', () => {
  it('an old save starts its catalog from the furniture it already has', () => {
    const s = migrateSave({ inventory: [{ id: 'chair', count: 1 }], placed: [{ id: 'p', itemId: 'table', x: 0, z: 0, rot: 0 }], homeStorage: [{ id: 'lamp', count: 1 }] })
    expect(s.furnitureSeen.sort()).toEqual(['chair', 'lamp', 'table'])
  })

  it('drops unknown ids from a saved catalog and keeps the valid ones', () => {
    const s = migrateSave({ furnitureSeen: ['chair', 'peach', 'chair', 7] })
    expect(s.furnitureSeen).toEqual(['chair'])
  })

  it('remembers a furniture item after it is sold or stowed away', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }] })
    expect(useGame.getState().furnitureSeen).toContain('chair')
    useGame.setState({ inventory: [] })
    expect(useGame.getState().furnitureSeen).toContain('chair')
  })

  it('records a furniture item when only the outside placement list changes', () => {
    useGame.setState({ placed: [{ id: 'p-lamp', itemId: 'lamp', x: 0, z: 0, rot: 0 }] })
    expect(useGame.getState().furnitureSeen).toContain('lamp')
  })

  it('ignores ordinary items', () => {
    useGame.setState({ inventory: [{ id: 'peach', count: 3 }] })
    expect(useGame.getState().furnitureSeen).toEqual([])
  })

  it('marks a furniture gift seen when its letter reaches the mailbox', () => {
    const letter = { id: 'festival-reward-x', from: 'committee', fromName: '위원회', day: '2026-07-15', text: '', gift: 'chair', read: false, claimed: false }
    useGame.setState({ letters: [letter, ...useGame.getState().letters] })
    expect(useGame.getState().furnitureSeen).toContain('chair')
  })

  it('reads letter gifts when loading an older save', () => {
    const s = migrateSave({ letters: [{ gift: 'lamp' }, { gift: 'flower-seed' }] })
    expect(s.furnitureSeen).toEqual(['lamp'])
  })
})
