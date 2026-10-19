import { describe, expect, it } from 'vitest'
import { eventsOn, type CalendarCtx } from './calendar'
import { furnitureSources } from './furnitureCatalog'
import {
  cleanFirstSnowWinters,
  FIRST_SNOW_KEEP,
  FIRST_SNOW_REWARD,
  FIRST_SNOW_SNOWMAN,
  firstSnowCompleted,
  firstSnowDay,
  firstSnowHelpers,
  firstSnowLetter,
  firstSnowRewardLetter,
  firstSnowTalkLines,
  isFirstSnowDay,
  isFirstSnowEve,
  winterKey,
  winterKeyOf,
  winterOf,
} from './firstSnow'
import { ITEMS } from './items'
import { VILLAGERS } from './villagers'
import type { Weather } from './weather'

/** 눈이 올 날만 골라 두는 날씨 함수 */
const snowOn = (...days: string[]) => (d: string): Weather => (days.includes(d) ? 'snow' : 'sunny')

describe('겨울 기준', () => {
  it('12월은 그해 겨울, 1~2월은 전년도 겨울이고 3~11월은 겨울이 아니다', () => {
    expect(winterOf('2026-12-01')).toBe(2026)
    expect(winterOf('2027-01-04')).toBe(2026)
    expect(winterOf('2027-02-28')).toBe(2026)
    expect(winterOf('2027-03-01')).toBeNull()
    expect(winterOf('2026-11-30')).toBeNull()
  })

  it('겨울 키는 2026-27처럼 두 해를 잇는다', () => {
    expect(winterKey(2026)).toBe('2026-27')
    expect(winterKey(2099)).toBe('2099-00')
    expect(winterKeyOf('2027-01-04')).toBe('2026-27')
    expect(winterKeyOf('2026-10-19')).toBeNull()
  })
})

describe('첫눈 날 판정', () => {
  it('겨울(12월 1일부터)에 처음 눈이 오는 날을 고른다', () => {
    expect(firstSnowDay(2026, snowOn('2026-12-03', '2026-12-09'))).toBe('2026-12-03')
  })

  it('12월에 눈이 오면 1월의 눈이 아니라 12월의 눈이 첫눈이다', () => {
    const w = snowOn('2026-12-20', '2027-01-04')
    expect(firstSnowDay(2026, w)).toBe('2026-12-20')
    expect(isFirstSnowDay('2027-01-04', w)).toBe(false)
  })

  it('12월에 눈이 없으면 1월의 첫 눈이 그 겨울의 첫눈이다', () => {
    const w = snowOn('2027-01-04', '2027-01-09')
    expect(firstSnowDay(2026, w)).toBe('2027-01-04')
    expect(isFirstSnowDay('2027-01-04', w)).toBe(true)
  })

  it('전년도 겨울의 눈은 이번 겨울 기준으로 세지 않는다', () => {
    // 2026-27 겨울은 12월 1일 이후, 2025-26 겨울의 2월 눈은 제외된다
    expect(firstSnowDay(2026, snowOn('2026-02-10', '2026-12-05'))).toBe('2026-12-05')
  })

  it('눈이 없는 겨울은 null이고, 3월 이후 눈은 그 겨울에 세지 않는다', () => {
    expect(firstSnowDay(2026, snowOn())).toBeNull()
    expect(firstSnowDay(2026, snowOn('2027-03-02'))).toBeNull()
  })

  it('겨울이 아닌 날은 첫눈 날이 될 수 없다', () => {
    expect(isFirstSnowDay('2026-11-30', snowOn('2026-11-30'))).toBe(false)
    expect(isFirstSnowDay('12/03', snowOn('2026-12-03'))).toBe(false)
  })

  it('첫눈 예보는 내일이 첫눈 날인 전날에만 참이다. 12월 1일 이전 11월 30일도 포함된다', () => {
    const w = snowOn('2026-12-01')
    expect(isFirstSnowEve('2026-11-30', w)).toBe(true)
    expect(isFirstSnowEve('2026-11-29', w)).toBe(false)
    expect(isFirstSnowEve('2026-12-01', w)).toBe(false)
  })
})

describe('눈사람 완성 보상', () => {
  const w = snowOn('2026-12-03')

  it('첫눈 날 눈사람 인형을 놓으면 완성이고, 같은 겨울에는 한 번만 준다', () => {
    expect(firstSnowCompleted('2026-12-03', FIRST_SNOW_SNOWMAN, [], w)).toBe(true)
    expect(firstSnowCompleted('2026-12-03', FIRST_SNOW_SNOWMAN, ['2026-27'], w)).toBe(false)
  })

  it('첫눈 날이 아니거나 다른 물건이면 완성이 아니다', () => {
    expect(firstSnowCompleted('2026-12-04', FIRST_SNOW_SNOWMAN, [], w)).toBe(false)
    expect(firstSnowCompleted('2026-12-03', 'pumpkin-lantern', [], w)).toBe(false)
  })

  it('보상 가구는 이 게임만의 기념 가구로 상점에는 없다', () => {
    expect(ITEMS[FIRST_SNOW_REWARD]).toBeDefined()
    expect(ITEMS[FIRST_SNOW_REWARD].kind).toBe('furniture')
    expect(ITEMS[FIRST_SNOW_REWARD].price).toBe(0)
  })

  it('보상 편지는 위원회가 보내고 그 가구를 담으며, 겨울 키로 아이디를 만든다', () => {
    const l = firstSnowRewardLetter('2027-01-04')
    expect(l.from).toBe('committee')
    expect(l.gift).toBe(FIRST_SNOW_REWARD)
    expect(l.id).toBe('first-snow-reward-2026-27')
  })

  it('아침 편지는 눈사람 인형을 동봉하고, 섬에 놓으라고 적는다', () => {
    const l = firstSnowLetter('2026-12-01')
    expect(l.gift).toBe(FIRST_SNOW_SNOWMAN)
    expect(l.text).toContain('동봉한 눈사람 인형을 섬에 놓아 주세요')
  })

  it('눈사람 인형은 얻는 길이 코드에 있다(장터·주민 선물·부탁 보상 중 하나)', () => {
    const src = furnitureSources(FIRST_SNOW_SNOWMAN)
    expect(src.length).toBeGreaterThan(0)
    expect(src).not.toContain('상점')
  })

  it('저장된 겨울 목록은 겨울 키만 남기고 중복을 없앤다', () => {
    expect(cleanFirstSnowWinters(['2026-27', '2026-27', 'x', '2026', '2027-28'])).toEqual(['2026-27', '2027-28'])
    expect(cleanFirstSnowWinters(undefined)).toEqual([])
  })

  it('예전 연도 값은 전년도 겨울로 옮긴다(1~2월 눈이 첫눈이었으니)', () => {
    expect(cleanFirstSnowWinters([2026, 2027])).toEqual(['2025-26', '2026-27'])
  })

  it('저장된 겨울은 최근 것만 남긴다', () => {
    const many = Array.from({ length: FIRST_SNOW_KEEP + 3 }, (_, i) => winterKey(2000 + i))
    expect(cleanFirstSnowWinters(many)).toEqual(many.slice(-FIRST_SNOW_KEEP))
  })
})

describe('첫눈 날 연출', () => {
  it('도우미는 눈사람을 빚는 주민을 빼고 같은 날이면 같은 둘을 고른다', () => {
    const ids = VILLAGERS.map((v) => v.id)
    const a = firstSnowHelpers('2026-12-03', ids, 'mocha')
    expect(a).toHaveLength(2)
    expect(a).not.toContain('mocha')
    expect(firstSnowHelpers('2026-12-03', ids, 'mocha')).toEqual(a)
  })

  it('성격마다 두 줄씩 말한다', () => {
    for (const p of ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy'] as const) {
      expect(firstSnowTalkLines(p)).toHaveLength(2)
    }
  })
})

describe('달력의 첫눈 예보', () => {
  const ctx = (weatherOn: (d: string) => Weather): CalendarCtx => ({
    today: '2026-11-30',
    weatherOn,
    villagers: [],
    moveTalk: null,
    arrivals: [],
    outLetters: [],
  })

  it('전날에는 첫눈 예보로, 당일에는 첫눈 오는 날로 보인다', () => {
    const c = ctx(snowOn('2026-12-03'))
    expect(eventsOn('2026-12-02', c).map((e) => e.label)).toContain('첫눈 예보')
    expect(eventsOn('2026-12-03', c).map((e) => e.label)).toContain('첫눈 오는 날')
  })

  it('이틀 전이나 다음 날에는 보이지 않는다', () => {
    const c = ctx(snowOn('2026-12-03'))
    expect(eventsOn('2026-12-01', c).some((e) => e.kind === 'firstsnow')).toBe(false)
    expect(eventsOn('2026-12-04', c).some((e) => e.kind === 'firstsnow')).toBe(false)
  })
})
