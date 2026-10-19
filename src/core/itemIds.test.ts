import { describe, expect, it } from 'vitest'
import { ITEM_LIST, ITEMS } from './items'
import { migrateItemIds } from './itemIds'
import { SHOP_TIERS } from './shopTiers'
import { migrateSave } from '../game/store'

describe('물건 id', () => {
  it('같은 id 를 두 번 정의하지 않는다', () => {
    const ids = ITEM_LIST.map((d) => d.id)
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dup).toEqual([])
  })

  it('백화점 진열은 가구이고, 우산과 재료는 들어 있지 않다', () => {
    const pool = SHOP_TIERS[3].pool
    expect(pool.some((id) => id.startsWith('umbrella-'))).toBe(false)
    for (const id of ['basket', 'wind-chime', 'lantern-hanging', 'bonsai']) {
      expect(pool).toContain(id)
      expect(ITEMS[id].kind).toBe('furniture')
      expect(ITEMS[id].buy).toBeGreaterThan(0)
    }
  })
})

describe('예전 종이 등불 칸 옮기기', () => {
  it('여러 개 묶인 칸은 등롱으로, 한 개짜리 칸은 축제 가구로 둔다', () => {
    const out = migrateItemIds([
      { id: 'paper-lantern', count: 5 },
      { id: 'paper-lantern', count: 1 },
      { id: 'wood', count: 3 },
    ])
    expect(out.map((s) => s.id)).toEqual(['lantern-hanging', 'paper-lantern', 'wood'])
    expect(out[0].count).toBe(5)
  })

  it('저장을 읽을 때 인벤토리와 보관함에도 적용된다', () => {
    const s = migrateSave({ inventory: [{ id: 'paper-lantern', count: 4 }], homeStorage: [{ id: 'paper-lantern', count: 2 }] })
    expect(s.inventory.map((x) => x.id)).toEqual(['lantern-hanging'])
    expect(s.homeStorage.map((x) => x.id)).toEqual(['lantern-hanging'])
  })
})
