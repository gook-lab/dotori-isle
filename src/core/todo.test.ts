import { describe, expect, it } from 'vitest'
import { VILLAGERS } from './villagers'
import { birthdayOf } from './birthdays'
import { isMeteorNight } from './skyEvents'
import { NEW_TODO, rewardTodos, sanitizeTodo, TODO_DAY_CAP, TODO_REWARD, todayTodos, type TodoCtx, type TodoItem } from './todo'

const MON = '2026-03-16'
const SAT = '2026-03-14'
const SUN = '2026-03-15'

const base = (over: Partial<TodoCtx> = {}): TodoCtx => ({
  day: MON,
  hour: 12,
  weather: 'cloudy',
  villagerIds: [],
  nameOf: (id) => id,
  giftDay: {},
  talked: [],
  marketBought: [],
  tourneyLastDay: null,
  wishNight: null,
  plantCount: 0,
  plantsDry: 0,
  digIds: [],
  dug: [],
  fishToday: 0,
  bugToday: 0,
  letters: [],
  outLetters: [],
  ...over,
})

const ids = (items: TodoItem[]) => items.map((i) => i.id)

describe('오늘의 할 일 목록', () => {
  it('늘 있는 항목은 물고기·벌레 잡기, 주민 대화, 편지 보내기다', () => {
    expect(ids(todayTodos(base()))).toEqual(['fish', 'bug', 'talk', 'letter-send'])
  })

  it('장날에는 장터 항목이 붙고, 물건을 사면 끝난다', () => {
    expect(todayTodos(base({ day: SAT })).find((i) => i.id === 'market')?.done).toBe(false)
    const bought = todayTodos(base({ day: SAT, marketBought: [`${SAT}:seed-bundle`] }))
    expect(bought.find((i) => i.id === 'market')?.done).toBe(true)
  })

  it('일요일에는 대회 항목이 붙고, 오늘 나갔으면 끝난다', () => {
    expect(ids(todayTodos(base({ day: SUN }))).includes('tourney')).toBe(true)
    expect(todayTodos(base({ day: SUN, tourneyLastDay: SUN })).find((i) => i.id === 'tourney')?.done).toBe(true)
    expect(ids(todayTodos(base({ day: MON, tourneyLastDay: null }))).includes('tourney')).toBe(false)
  })

  it('생일 주민이 있으면 선물 항목이 붙고, 모두 받았을 때만 끝난다', () => {
    const v = VILLAGERS[0]
    const { month, day } = birthdayOf(v.id)
    const bday = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const open = todayTodos(base({ day: bday, villagerIds: [v.id], nameOf: () => v.name }))
    expect(open.find((i) => i.id === 'birthday')?.done).toBe(false)
    expect(open.find((i) => i.id === 'birthday')?.title).toContain(v.name)
    const given = todayTodos(base({ day: bday, villagerIds: [v.id], giftDay: { [v.id]: bday } }))
    expect(given.find((i) => i.id === 'birthday')?.done).toBe(true)
  })

  it('물을 줄 꽃이 있으면 물 주기 항목이 붙고, 마른 꽃이 없으면 끝난다', () => {
    expect(todayTodos(base({ plantCount: 3, plantsDry: 2 })).find((i) => i.id === 'water')?.done).toBe(false)
    expect(todayTodos(base({ plantCount: 3, plantsDry: 0 })).find((i) => i.id === 'water')?.done).toBe(true)
    expect(ids(todayTodos(base({ plantCount: 0 }))).includes('water')).toBe(false)
  })

  it('묻힌 보물을 모두 파면 화석 항목이 끝난다', () => {
    const digIds = ['a', 'b']
    expect(todayTodos(base({ digIds, dug: ['a'] })).find((i) => i.id === 'dig')?.done).toBe(false)
    expect(todayTodos(base({ digIds, dug: ['a', 'b'] })).find((i) => i.id === 'dig')?.done).toBe(true)
  })

  it('오늘 온 편지를 모두 읽으면 편지 항목이 끝난다', () => {
    const letters = [{ day: MON, read: false }]
    expect(todayTodos(base({ letters })).find((i) => i.id === 'letter-read')?.done).toBe(false)
    expect(todayTodos(base({ letters: [{ day: MON, read: true }] })).find((i) => i.id === 'letter-read')?.done).toBe(true)
  })

  it('최대 7개까지만 보여 준다', () => {
    const many = base({
      day: SAT,
      villagerIds: VILLAGERS.map((v) => v.id),
      plantCount: 2,
      plantsDry: 1,
      digIds: ['a'],
      letters: [{ day: SAT, read: false }],
    })
    expect(todayTodos(many).length).toBeLessThanOrEqual(7)
  })
})

describe('할 일 보상', () => {
  const done = (id: TodoItem['id']): TodoItem => ({ id, title: id, done: true })
  const open = (id: TodoItem['id']): TodoItem => ({ id, title: id, done: false })

  it('해낸 항목마다 마일리지를 주고, 이미 정산한 항목은 다시 주지 않는다', () => {
    const r = rewardTodos([done('talk'), done('dig'), open('water')], [], 0)
    expect(r.settle).toEqual(['talk', 'dig'])
    expect(r.miles).toBe(2 * TODO_REWARD)
    expect(rewardTodos([done('talk'), done('dig')], ['talk', 'dig'], 2 * TODO_REWARD)).toEqual({ settle: [], miles: 0 })
  })

  it('하루 상한을 넘기지 않는다', () => {
    const many = (['talk', 'letter-send', 'dig', 'water', 'meteor', 'letter-read', 'market'] as const).map(done)
    const r = rewardTodos(many, [], 0)
    expect(r.miles).toBeLessThanOrEqual(TODO_DAY_CAP)
    expect(r.miles).toBe(TODO_DAY_CAP)
    expect(rewardTodos(many, [], TODO_DAY_CAP)).toEqual({ settle: r.settle, miles: 0 })
  })
})

describe('할 일 저장 값 정리', () => {
  it('없거나 이상한 값은 새 기록으로 바꾼다', () => {
    expect(sanitizeTodo(undefined)).toEqual(NEW_TODO)
    expect(sanitizeTodo({ day: 'nope', settled: ['talk', 'bogus'], miles: 999 })).toEqual({ day: null, settled: ['talk'], miles: TODO_DAY_CAP, fish: 0, bug: 0 })
  })

  it('정상 값은 그대로 둔다', () => {
    expect(sanitizeTodo({ day: MON, settled: ['dig'], miles: 10, fish: 2, bug: 1 })).toEqual({ day: MON, settled: ['dig'], miles: 10, fish: 2, bug: 1 })
  })
})

describe('잡기 항목', () => {
  it('물고기와 벌레를 한 마리씩 잡으면 끝난다', () => {
    expect(todayTodos(base()).find((i) => i.id === 'fish')?.done).toBe(false)
    expect(todayTodos(base({ fishToday: 1 })).find((i) => i.id === 'fish')?.done).toBe(true)
    expect(todayTodos(base({ bugToday: 1 })).find((i) => i.id === 'bug')?.done).toBe(true)
  })
})

describe('별똥별 소원 항목', () => {
  it('20시 전에는 흐리게 보여 주고 완료로 치지 않는다', () => {
    // 맑은 밤으로 정해진 날을 찾는다
    const day = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].find((d) => isMeteorNight(d, 'sunny'))
    if (!day) return
    const early = todayTodos(base({ day, hour: 12, weather: 'sunny' })).find((i) => i.id === 'meteor')
    expect(early).toMatchObject({ later: true, done: false, title: '오늘 밤 소원 빌기 (20시부터)' })
    const night = todayTodos(base({ day, hour: 21, weather: 'sunny' })).find((i) => i.id === 'meteor')
    expect(night?.later).toBe(false)
  })
})
