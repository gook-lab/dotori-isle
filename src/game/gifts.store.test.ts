import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { birthdayOf } from '../core/birthdays'
import { countOf } from '../core/inventory'
import { NEW_SHOP } from '../core/shopTiers'
import { giftBlockReason, migrateSave, useGame } from './store'
import { VILLAGERS } from '../core/villagers'

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const bd = birthdayOf('mocha')
const birthdayKey = key(2026, bd.month, bd.day)

beforeEach(() => {
  useGame.setState({
    panel: 'talk',
    money: 0,
    inventory: [{ id: 'peach', count: 3 }, { id: 'empty-can', count: 1 }],
    pocket: 20,
    letters: [],
    houses: ['mocha'],
    friendship: {},
    giftDay: {},
    birthdayThanks: [],
    day: key(2026, 1, 2),
    dialog: { villagerId: 'mocha', name: '모카', lines: ['안녕!'], index: 0, offer: null, ask: null, choice: null },
    shop: NEW_SHOP,
    stats: {},
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('giving a gift', () => {
  it('uses one item, raises friendship, and shows the reaction in the dialog', () => {
    useGame.getState().giveGift('peach')
    const s = useGame.getState()
    expect(countOf(s.inventory, 'peach')).toBe(2)
    expect(s.giftDay.mocha).toBe(s.day)
    expect(s.friendship.mocha ?? 0).toBeGreaterThan(0)
    expect(s.dialog?.lines.length).toBeGreaterThan(0)
    expect(s.dialog?.lines.join(' ')).toContain('복숭아')
  })

  it('allows only one gift per villager per day', () => {
    useGame.getState().giveGift('peach')
    useGame.getState().giveGift('peach')
    expect(countOf(useGame.getState().inventory, 'peach')).toBe(2)
    expect(giftBlockReason('mocha')).toContain('오늘은 이미')
  })

  it('a birthday gift queues a thank-you letter for the next morning', () => {
    useGame.setState({ day: birthdayKey })
    useGame.getState().giveGift('peach')
    const s = useGame.getState()
    expect(s.birthdayThanks).toEqual([{ villagerId: 'mocha', giftDay: birthdayKey, present: expect.any(String) }])
    expect(s.dialog?.lines[0]).toContain('생일')
  })

  it('the next morning delivers the thank-you letter with the present', () => {
    vi.useFakeTimers()
    useGame.setState({ day: birthdayKey })
    useGame.getState().giveGift('peach')
    const present = useGame.getState().birthdayThanks[0].present
    // 생일 다음 날 아침
    vi.setSystemTime(new Date(2026, bd.month - 1, bd.day + 1, 9))
    useGame.getState().syncClock()
    const s = useGame.getState()
    const thanks = s.letters.find((l) => l.id.startsWith('birthday-thanks-'))
    expect(thanks?.gift).toBe(present)
    expect(s.birthdayThanks).toEqual([])
  })

  it('on the birthday morning the villager sends an invite letter once', () => {
    vi.useFakeTimers()
    useGame.setState({ day: key(2026, 1, 1), letters: [] })
    vi.setSystemTime(new Date(2026, bd.month - 1, bd.day, 9))
    useGame.getState().syncClock()
    useGame.setState({ day: key(2026, 1, 1) })
    useGame.getState().syncClock()
    const invites = useGame.getState().letters.filter((l) => l.id === `birthday-${birthdayKey}-mocha`)
    expect(invites).toHaveLength(1)
    expect(invites[0].text).toContain('생일')
  })
})

describe('other villagers talk about a birthday', () => {
  it('a friend mentions a neighbour birthday on the first talk of the day', () => {
    useGame.setState({ day: birthdayKey, dialog: null, talked: [], houses: ['mocha', 'bomi'] })
    useGame.getState().talkTo(VILLAGERS.find((v) => v.id === 'bomi')!)
    const lines = useGame.getState().dialog?.lines ?? []
    expect(lines.some((l) => l.includes('모카') && l.includes('생일'))).toBe(true)
  })

  it('the birthday villager greets with the birthday line', () => {
    useGame.setState({ day: birthdayKey, dialog: null, talked: [], houses: ['mocha'] })
    useGame.getState().talkTo(VILLAGERS.find((v) => v.id === 'mocha')!)
    const lines = useGame.getState().dialog?.lines ?? []
    expect(lines.some((l) => l.includes('오늘 내 생일'))).toBe(true)
  })
})

describe('gift save migration', () => {
  it('fills the gift day map and the birthday thank-you queue for older saves', () => {
    const m = migrateSave({ money: 1, day: birthdayKey })
    expect(m.giftDay).toEqual({})
    expect(m.birthdayThanks).toEqual([])
  })

  it('keeps valid queue entries and drops broken ones', () => {
    const m = migrateSave({ money: 1, day: birthdayKey, birthdayThanks: [{ villagerId: 'bomi', giftDay: birthdayKey, present: null }, { bad: true }] })
    expect(m.birthdayThanks).toEqual([{ villagerId: 'bomi', giftDay: birthdayKey, present: null }])
  })
})
