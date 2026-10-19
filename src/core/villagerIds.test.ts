import { describe, expect, it } from 'vitest'
import { migrateVillagerIds } from './villagerIds'

describe('예전 주민 id 옮기기', () => {
  it('renames ids in values, keys and mixed strings', () => {
    const save = {
      houses: ['chiikawa', 'mocha'],
      friendship: { usagi: 3, bomi: 1 },
      houseExpand: { villagerId: 'rakko', fund: 1000, ready: null },
      letters: [{ id: 'birthday-kurimanju-2026', from: 'momonga' }],
      note: 'hachiware',
    }
    expect(migrateVillagerIds(save)).toEqual({
      houses: ['somi', 'mocha'],
      friendship: { yuja: 3, bomi: 1 },
      houseExpand: { villagerId: 'coco', fund: 1000, ready: null },
      letters: [{ id: 'birthday-maro-2026', from: 'bori' }],
      note: 'soda',
    })
  })

  it('leaves other values and new saves unchanged', () => {
    const save = { money: 10, ok: true, none: null, ids: ['somi', 'usagiman'], text: '토끼 아님' }
    expect(migrateVillagerIds(save)).toEqual(save)
  })
})
