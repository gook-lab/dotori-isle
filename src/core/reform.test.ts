import { describe, expect, it } from 'vitest'
import { addItem } from './inventory'
import { ADVANCED_MIN_ACORNS, ADVANCED_REFORM_TIER, advancedAcorns, canReform, FINISHES, isFinish, mixHex, REFORM_TIER, reformAcorns, REFORM_MIN_ACORNS, sanitizeVariant, VARIANTS, variantById } from './reform'

describe('가구 리폼 색 변형', () => {
  it('변형은 네 종이고 id 가 겹치지 않는다', () => {
    expect(VARIANTS).toHaveLength(4)
    expect(new Set(VARIANTS.map((v) => v.id)).size).toBe(4)
    for (const v of VARIANTS) expect(v.color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('도토리 비용은 가구 값의 40%, 최소 20 이다', () => {
    expect(reformAcorns('wooden-box')).toBe(36) // 가격 90
    expect(reformAcorns('tourney-trophy')).toBe(REFORM_MIN_ACORNS) // 가격 0
    expect(reformAcorns('wood')).toBeNull() // 가구가 아니면 리폼 비용이 없다
    expect(reformAcorns('no-such-item')).toBeNull()
  })

  it('가구가 아니거나 없는 색이면 리폼할 수 없다', () => {
    expect(canReform('wood', 'mint', 999, 9)).toEqual({ ok: false, reason: '가구만 리폼할 수 있어요' })
    expect(canReform('wooden-box', 'no-color', 999, 9)).toEqual({ ok: false, reason: '없는 색이에요' })
  })

  it('목재가 없으면 리폼할 수 없다', () => {
    expect(canReform('wooden-box', 'mint', 999, 0)).toEqual({ ok: false, reason: '목재가 부족해요' })
  })

  it('도토리가 모자라면 모자란 만큼 알려 준다', () => {
    expect(canReform('wooden-box', 'mint', 30, 1)).toEqual({ ok: false, reason: '도토리가 6 모자라요' })
  })

  it('조건이 다 맞으면 도토리 비용을 돌려준다', () => {
    expect(canReform('wooden-box', 'mint', 36, 1)).toEqual({ ok: true, acorns: 36 })
  })

  it('mixHex 는 t=0 이면 원래 색, t=1 이면 변형 색이고 가운데는 섞은 색이다', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#c77a5c', '#9fdcc4', 0.6)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('저장된 변형 값은 아는 것만 남긴다', () => {
    expect(sanitizeVariant('mint')).toBe('mint')
    expect(sanitizeVariant('neon')).toBeUndefined()
    expect(sanitizeVariant(3)).toBeUndefined()
    expect(variantById(null)).toBeNull()
  })
})

describe('변형이 다른 가구는 한 칸에 합치지 않는다', () => {
  it('같은 가구라도 변형이 다르면 새 칸을 연다', () => {
    const r = addItem([{ id: 'wooden-box', count: 1, variant: 'mint' }], 'wooden-box', 1, 20, undefined)
    expect(r.inv).toHaveLength(2)
    expect(r.inv[1]).toEqual({ id: 'wooden-box', count: 1 })
  })

  it('변형을 적어 넣으면 그 칸에 변형이 남는다', () => {
    const r = addItem([], 'tourney-fish', 1, 20, 'rose')
    expect(r.inv).toEqual([{ id: 'tourney-fish', count: 1, variant: 'rose' }])
  })
})

describe('고급 마감(도토리 백화점 이후)', () => {
  it('마감은 색 변형과 id 가 겹치지 않고, 색 변형 목록에는 들어가지 않는다', () => {
    expect(FINISHES.map((f) => f.id)).toEqual(['gold', 'glitter'])
    expect(VARIANTS.some((v) => isFinish(v.id))).toBe(false)
    expect(variantById('gold')?.name).toBe('금박 마감')
  })

  it('마감 도토리는 가구 값의 3배를 1,500~3,000 사이로 자른다', () => {
    expect(advancedAcorns('chair')).toBe(ADVANCED_MIN_ACORNS) // 가격 50 → 150 → 최소 1,500
    expect(advancedAcorns('wooden-box')).toBe(ADVANCED_MIN_ACORNS) // 가격 90 → 270 → 1,500
    expect(advancedAcorns('tourney-trophy')).toBe(ADVANCED_MIN_ACORNS) // 가격 0 → 최소 1,500
    expect(advancedAcorns('wood')).toBeNull()
  })

  it('백화점 전에는 마감을 고를 수 없고, 그 이후에는 마감 도토리로 고를 수 있다', () => {
    expect(canReform('chair', 'gold', 99999, 1, REFORM_TIER)).toEqual({ ok: false, reason: '도토리 백화점이 열리면 고급 마감을 할 수 있어요' })
    expect(canReform('chair', 'gold', 1499, 1, ADVANCED_REFORM_TIER)).toEqual({ ok: false, reason: '도토리가 1 모자라요' })
    expect(canReform('chair', 'gold', 1500, 1, ADVANCED_REFORM_TIER)).toEqual({ ok: true, acorns: 1500 })
  })

  it('색 변형은 백화점 전에도 그대로 고를 수 있다', () => {
    expect(canReform('wooden-box', 'mint', 36, 1, REFORM_TIER)).toEqual({ ok: true, acorns: 36 })
  })

  it('마감을 저장값으로 돌려받아도 모르는 값이 아니다', () => {
    expect(sanitizeVariant('glitter')).toBe('glitter')
  })
})
