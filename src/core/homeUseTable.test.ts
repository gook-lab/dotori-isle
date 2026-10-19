import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { HOME_USE, homeUse, homeUseLabel, homeUseLine, ITEM_USE_LINE, type HomeUse } from './furnitureActions'
import { SEAT_DEFAULT, SEAT_HEIGHT, seatHeightOf } from './placement'

const FURNITURE = Object.values(ITEMS).filter((d) => d.kind === 'furniture')
const ctx = { weather: 'sunny' as const, season: 'spring' as const, night: false }

/** 말 줄 없이 자세·불빛·패널로 바로 넘어가는 쓰임 */
const NO_LINE: HomeUse[] = ['sit', 'light', 'mail', 'cook']

/**
 * 쓰임별 공통 줄을 쓰는 가구 목록. 여기 없는 가구가 공통 줄을 쓰면 다른 가구 얘기가 나올 수 있으니
 * 가구별 줄(ITEM_USE_LINE)을 새로 적는다.
 */
const GENERIC_OK: Partial<Record<HomeUse, string[]>> = {
  pet: ['flowerpot'],
  tea: ['table'],
  open: ['wooden-box', 'drawer', 'wardrobe'],
  poke: ['snowman'],
  polish: ['gold-acorn'],
  wave: ['harvest-scarecrow'],
  chill: ['ice-sculpture'],
  scope: ['telescope'],
  read: ['bookshelf'],
  spin: ['globe'],
  stock: ['storage-shelf'],
  warm: ['boiler'],
}

describe('방 가구 쓰임 표', () => {
  it('앉는 쓰임(sit)인 가구는 모두 앉는 높이 표에 있다', () => {
    const sit = Object.entries(HOME_USE).filter(([, use]) => use === 'sit').map(([id]) => id)
    expect(sit.length).toBeGreaterThan(0)
    for (const id of sit) expect(SEAT_HEIGHT[id], id).toBeGreaterThan(0)
  })

  it('표에 없는 가구도 앉으면 기본 높이로 앉는다(NaN 이 되지 않는다)', () => {
    expect(seatHeightOf('no-such-chair')).toBe(SEAT_DEFAULT)
    expect(Number.isFinite(seatHeightOf('no-such-chair'))).toBe(true)
  })

  it('쓰임이 있는 가구는 안내 글에 자기 이름을 넣는다', () => {
    for (const d of FURNITURE) {
      const use = homeUse(d.id)
      if (!use) continue
      const label = homeUseLabel(use, d.name)
      expect(label, d.id).toContain(d.name)
    }
  })

  it('말 줄이 있는 쓰임은 가구마다 줄이 있다', () => {
    for (const d of FURNITURE) {
      const use = homeUse(d.id)
      if (!use || NO_LINE.includes(use)) continue
      expect(homeUseLine(use, d.name, ctx, d.id), d.id).toEqual(expect.any(String))
    }
  })

  it('쓰임별 공통 줄은 허용된 가구만 쓴다', () => {
    for (const d of FURNITURE) {
      const use = homeUse(d.id)
      if (!use || NO_LINE.includes(use) || ITEM_USE_LINE[d.id]) continue
      expect(GENERIC_OK[use] ?? [], `${d.id} 는 ${use} 공통 줄 대신 ITEM_USE_LINE 에 줄을 적는다`).toContain(d.id)
    }
  })

  it('가구별 줄은 서로 다르고, 가구 이름이 다른 가구를 가리키지 않는다', () => {
    const lines = Object.values(ITEM_USE_LINE)
    expect(new Set(lines).size).toBe(lines.length)
    for (const id of Object.keys(ITEM_USE_LINE)) expect(homeUse(id), id).not.toBeNull()
  })

  it('작업대와 공구 벽걸이의 손보기 줄은 서로 다르다', () => {
    expect(ITEM_USE_LINE.workbench).not.toBe(ITEM_USE_LINE['tool-rack'])
    expect(homeUseLine('work', '작업대', ctx, 'workbench')).toContain('사포')
    expect(homeUseLine('work', '공구 벽걸이', ctx, 'tool-rack')).toContain('망치')
  })
})
