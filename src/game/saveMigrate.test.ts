import { describe, expect, it } from 'vitest'
import { DEFAULT_PAINT } from '../core/homePaint'
import { parseSaveFile } from './saveFile'
import { migrateSave, saveOf, useGame, type SaveData } from './store'

/** 기본값이 없어도 되는 선택 필드(없음 = 해당 없음으로 읽힌다) */
const OPTIONAL_KEYS = ['gardenPermit', 'gardenTiles', 'songiBuy']

/** 지금 저장 형태를 JSON 으로 옮긴 것(실제 저장 키에 쓰는 글과 같다) */
function currentJson(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(saveOf(useGame.getState())))
}

/** 예전 버전 저장을 흉내 낸다: 그 버전 뒤에 생긴 필드를 빼고, 깨진 값을 몇 개 섞는다 */
function oldSave(version: 20 | 24 | 26 | 28): Record<string, unknown> {
  const s = currentJson()
  // 27 rainbowSeen, 28 setsDone, 29 homePaint 가 추가된 순서대로 뺀다
  const added: Record<number, string[]> = { 20: ['rainbowSeen', 'setsDone', 'homePaint', 'festival', 'bank', 'rating', 'cave', 'museum', 'requests', 'album', 'wallPhoto'], 24: ['rainbowSeen', 'setsDone', 'homePaint'], 26: ['setsDone', 'homePaint'], 28: ['homePaint'] }
  for (const k of added[version]) delete s[k]
  // 깨진 값 섞기: 숫자 자리에 글, 배열 자리에 객체, 날짜 자리에 이상한 글
  s.day = version === 24 ? '2026-13-45' : s.day
  s.inventory = version === 26 ? [null, 3, { id: 'x' }] : s.inventory
  s.placed = version === 20 ? 'oops' : s.placed
  return s
}

/** 쓸 수 있는 저장인지 확인한다: 필드 종류가 맞고 깨진 값은 기본값으로 바뀌어야 한다 */
function expectSane(s: SaveData) {
  expect(typeof s.money).toBe('number')
  expect(s.money).toBeGreaterThanOrEqual(0)
  expect(Array.isArray(s.inventory)).toBe(true)
  expect(s.inventory.every((x) => x && typeof x === 'object')).toBe(true)
  expect(Array.isArray(s.placed)).toBe(true)
  expect(typeof s.day).toBe('string')
  expect(Number.isNaN(Date.parse(s.day))).toBe(false)
  expect(typeof s.rainbowSeen).toBe('boolean')
  expect(Array.isArray(s.setsDone)).toBe(true)
  expect(typeof s.homePaint).toBe('object')
  expect(s.shop).toBeDefined()
  expect(s.home).toBeDefined()
  expect(s.bank).toBeDefined()
  expect(s.festival).toBeDefined()
}

describe('예전 저장 옮기기(migrateSave)', () => {
  it('빈 저장은 지금 기본값으로 채워진다', () => {
    const s = migrateSave({})
    expectSane(s)
  })

  it('기본값 키는 저장 내보내기(saveOf)에 빠짐없이 들어간다', () => {
    const defaults = Object.keys(migrateSave({})).filter((k) => !OPTIONAL_KEYS.includes(k))
    const saved = Object.keys(saveOf(useGame.getState()))
    expect(defaults.filter((k) => !saved.includes(k))).toEqual([])
  })

  it('저장 내보내기의 키는 모두 migrateSave 를 거쳐도 남는다', () => {
    const saved = currentJson()
    const migrated = migrateSave(saved) as unknown as Record<string, unknown>
    const lost = Object.keys(saved).filter((k) => !(k in migrated))
    expect(lost).toEqual([])
  })

  it.each([20, 24, 26, 28] as const)('버전 %i 모양(필드 일부 없음·깨진 값 섞임)도 정상 상태로 온다', (v) => {
    const s = migrateSave(oldSave(v))
    expectSane(s)
    // 깨진 money 는 0 이 아니라 글이 그대로 남으면 안 된다
    expect(typeof s.money).toBe('number')
    // 없던 27~29 필드는 기본값으로 채운다
    expect(s.rainbowSeen).toBe(false)
    expect(s.homePaint).toEqual(DEFAULT_PAINT)
  })

  it('버전 28 저장은 setsDone 이 없으면 지금 가진 가구로 세트 목록을 채운다', () => {
    const s = migrateSave(oldSave(28))
    expect(Array.isArray(s.setsDone)).toBe(true)
  })

  it('망가진 값이 섞여도 던지지 않고 기본값으로 바꾼다', () => {
    const broken = {
      money: NaN,
      inventory: 'x',
      placed: [null, 1, 'a'],
      homeStorage: {},
      day: 'not-a-day',
      shop: { tier: 99 },
      home: { stage: 'huge' },
      bank: { savings: -5, day: 'x' },
      festival: { day: 3, n: 'many' },
      homePaint: { roof: 'red' },
      rainbowSeen: 'yes',
      setsDone: [1, null, 'ok'],
      designs: [null, { id: 'd' }],
      introduced: 'all',
    }
    const s = migrateSave(broken)
    expectSane(s)
    expect(s.setsDone).toEqual(['ok'])
    expect(s.rainbowSeen).toBe(false)
  })

  it('옮긴 상태는 JSON 으로 다시 써도 같은 값으로 읽힌다', () => {
    const once = migrateSave(oldSave(24))
    const twice = migrateSave(JSON.parse(JSON.stringify(once)))
    expect(twice.homePaint).toEqual(once.homePaint)
    expect(twice.setsDone).toEqual(once.setsDone)
    expect(twice.rainbowSeen).toBe(once.rainbowSeen)
  })
})

describe('설정 가져오기로 예전 저장 파일 넣기(parseSaveFile)', () => {
  it.each([20, 24, 26, 28] as const)('버전 %i 래퍼 파일은 거절하지 않고 옮긴다', (v) => {
    const r = parseSaveFile(JSON.stringify({ state: oldSave(v), version: v }))
    expect(r.ok).toBe(true)
    if (r.ok) expectSane(r.state)
  })

  it('버전 20 맨 상태 파일도 같은 방식으로 받는다', () => {
    const r = parseSaveFile(JSON.stringify(oldSave(20)))
    expect(r.ok).toBe(true)
  })
})

describe('정원 허가 옮기기(gardenPermit)', () => {
  it('true 만 허가로 치고, 깨진 값은 허가 없음으로 본다', () => {
    expect(migrateSave({ gardenPermit: true }).gardenPermit).toBe(true)
    expect(migrateSave({}).gardenPermit).toBe(false)
    expect(migrateSave({ gardenPermit: 'yes' }).gardenPermit).toBe(false)
    expect(migrateSave({ gardenPermit: 1 }).gardenPermit).toBe(false)
  })
})
