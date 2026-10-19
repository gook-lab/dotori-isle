import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { bottleDay, GLINT_RADIUS, isMapLetter, LETTERS, letterFor, letterId, mapId, nearTreasure, parcelContents, parcelCount, PARCEL_TABLE, parseMapId, pickTreasure, registerMapItem, TREASURE_MONEY, treasureCandidates, treasureReward } from './bottle'

describe('유리병과 편지', () => {
  it('병은 매일 한 개 떠밀려 온다', () => {
    const days = Array.from({ length: 9 }, (_, i) => `2026-10-${String(10 + i).padStart(2, '0')}`)
    expect(days.every(bottleDay)).toBe(true)
    expect(bottleDay('not-a-day')).toBe(false)
  })

  it('편지는 서른 종이고, 그중 열(3분의 1)이 지도 조각이다', () => {
    expect(LETTERS.length).toBeGreaterThanOrEqual(30)
    expect(LETTERS.filter((_, i) => isMapLetter(i)).length).toBe(LETTERS.length / 3)
    expect(LETTERS.every((t) => t.length > 0)).toBe(true)
  })

  it('표류 소포는 하루 0~2개이고, 열면 목록 가운데 하나가 든다', () => {
    const counts = Array.from({ length: 60 }, (_, i) => parcelCount(`2026-10-${String((i % 28) + 1).padStart(2, '0')}-${i}`))
    expect(counts.every((n) => n >= 0 && n <= 2)).toBe(true)
    expect(new Set(counts).size).toBeGreaterThan(1)
    const got = parcelContents('2026-10-12-0-parcel')
    expect(PARCEL_TABLE.map(([id]) => id)).toContain(got.itemId)
    expect(parcelContents('same')).toEqual(parcelContents('same'))
  })

  it('같은 병은 같은 편지를 준다', () => {
    expect(letterFor('bottle-a')).toEqual(letterFor('bottle-a'))
    expect(letterFor('bottle-a').text).toBe(LETTERS[letterFor('bottle-a').index])
  })

  it('편지 아이템은 등록되어 있다', () => {
    expect(ITEMS[letterId(0)]).toBeDefined()
    expect(ITEMS[letterId(11)].kind).toBe('junk')
  })
})

describe('보물 지도', () => {
  it('지도 id 에 목표 칸을 담고 다시 꺼낸다', () => {
    expect(parseMapId(mapId(-12, 7))).toEqual({ x: -12, z: 7 })
    expect(parseMapId('wood')).toBeNull()
  })

  it('목표 칸은 잔디 후보 가운데에서 고르고, 같은 씨앗이면 같다', () => {
    const cands = treasureCandidates()
    expect(cands.length).toBeGreaterThan(10)
    const a = pickTreasure('bottle-x', cands)
    expect(a).not.toBeNull()
    expect(pickTreasure('bottle-x', cands)).toEqual(a)
    expect(pickTreasure('bottle-x', [])).toBeNull()
  })

  it('목표 근처 판정: 파기 반경과 반짝임 반경', () => {
    const t = { x: 5, z: 5 }
    expect(nearTreasure(5.5, 5, t, 1.4)).toBe(true)
    expect(nearTreasure(7, 5, t, 1.4)).toBe(false)
    expect(nearTreasure(7, 5, t, GLINT_RADIUS)).toBe(true)
  })

  it('보물 상자는 도토리 천 개 또는 희귀 가구 하나', () => {
    const r = treasureReward('chest-1', ['gold-acorn', 'iron-lamp'])
    if ('money' in r) expect(r.money).toBe(TREASURE_MONEY)
    else expect(['gold-acorn', 'iron-lamp']).toContain(r.item)
    expect(treasureReward('chest-1', [])).toEqual({ money: TREASURE_MONEY })
  })

  it('지도 아이템을 등록하면 이름과 아이콘이 생긴다', () => {
    registerMapItem(mapId(3, 4))
    expect(ITEMS[mapId(3, 4)].name).toBe('보물 지도')
  })
})
