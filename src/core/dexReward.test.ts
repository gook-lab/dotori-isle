import { describe, expect, it } from 'vitest'
import { BUG_TABLE, FISH_TABLE, ITEMS } from './items'
import { FURNITURE_IDS } from './furnitureCatalog'
import { doneDexKinds, dexKindDone, newDexRewards, sanitizeDexRewards } from './dexReward'

const fishIds = FISH_TABLE.filter((f) => ITEMS[f.id].kind === 'fish').map((f) => f.id)
const bugIds = BUG_TABLE.map((b) => b.id)
const all = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, 1]))

describe('도감 완성 판정', () => {
  it('물고기는 모든 종이 도감에 올라야 다 채운 것이다', () => {
    const dex = all(fishIds)
    expect(dexKindDone('fish', dex, [])).toBe(true)
    const missing = { ...dex }
    delete missing[fishIds[0]]
    expect(dexKindDone('fish', missing, [])).toBe(false)
  })

  it('벌레도 같은 방식으로 본다', () => {
    expect(dexKindDone('bug', all(bugIds), [])).toBe(true)
    expect(dexKindDone('bug', {}, [])).toBe(false)
  })

  it('가구는 본 목록에 전부 있어야 한다. 도감 칸 수와는 상관없다', () => {
    expect(dexKindDone('furniture', {}, FURNITURE_IDS)).toBe(true)
    expect(dexKindDone('furniture', {}, FURNITURE_IDS.slice(1))).toBe(false)
  })
})

describe('도감 보상 지급 판정', () => {
  it('이미 받은 분류는 다시 주지 않는다', () => {
    const dex = all(fishIds)
    expect(newDexRewards([], dex, [])).toEqual(['fish'])
    expect(newDexRewards(['fish'], dex, [])).toEqual([])
  })

  it('한꺼번에 여러 분류가 채워지면 각각 한 번씩 준다', () => {
    const dex = { ...all(fishIds), ...all(bugIds) }
    expect(newDexRewards([], dex, FURNITURE_IDS)).toEqual(['fish', 'bug', 'furniture'])
  })

  it('예전 저장을 옮길 때는 지금 채워진 분류를 보상 없이 받은 것으로 둔다', () => {
    expect(doneDexKinds({ ...all(fishIds), ...all(bugIds) }, [])).toEqual(['fish', 'bug'])
  })
})

describe('도감 보상 저장 칸', () => {
  it('분류 이름만 남기고, 깨진 값과 중복은 버린다', () => {
    expect(sanitizeDexRewards(['fish', 'fish', 'nope', 3, 'furniture'])).toEqual(['fish', 'furniture'])
    expect(sanitizeDexRewards('fish')).toEqual([])
    expect(sanitizeDexRewards(undefined)).toEqual([])
  })
})
