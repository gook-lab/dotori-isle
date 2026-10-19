import { beforeEach, describe, expect, it } from 'vitest'
import { countOf } from '../core/inventory'
import { marketStock, visitKey } from '../core/market'
import { migrateSave, useGame } from './store'
import { VILLAGERS } from '../core/villagers'

const SAT = '2026-10-17'
const SUN = '2026-10-18'

beforeEach(() => {
  useGame.setState({ money: 1000, inventory: [], pocket: 20, marketBought: [], day: SAT, stats: {} })
})

describe('market stall purchases', () => {
  it('sells nothing on a day that is not market day', () => {
    useGame.setState({ day: SUN })
    useGame.getState().buyMarket('seed')
    expect(useGame.getState().money).toBe(1000)
    expect(useGame.getState().marketBought).toEqual([])
  })

  it('a seed bundle costs its price, gives five seeds, and is bought once per visit', () => {
    useGame.getState().buyMarket('seed')
    let s = useGame.getState()
    expect(s.money).toBe(1000 - marketStock(SAT).seed.price)
    expect(countOf(s.inventory, 'flower-seed')).toBe(marketStock(SAT).seed.count)
    expect(s.marketBought).toEqual([visitKey(SAT, 'seed')])
    useGame.getState().buyMarket('seed')
    s = useGame.getState()
    expect(countOf(s.inventory, 'flower-seed')).toBe(marketStock(SAT).seed.count)
  })

  it('a rare piece from the stall goes into the pocket for its price', () => {
    const rare = marketStock(SAT).rare[0]
    useGame.getState().buyMarket(rare.itemId)
    const s = useGame.getState()
    expect(countOf(s.inventory, rare.itemId)).toBe(1)
    expect(s.money).toBe(1000 - rare.price)
  })

  it('an item that is not on today\'s stall is refused', () => {
    const notHere = ['snowman', 'telescope', 'stone-lantern', 'log-bench', 'iron-lamp', 'gold-acorn'].find((id) => !marketStock(SAT).rare.some((r) => r.itemId === id))!
    useGame.getState().buyMarket(notHere)
    expect(useGame.getState().money).toBe(1000)
  })

  it('the mystery bag costs its price and gives something from the pool', () => {
    useGame.getState().buyMarket('mystery')
    const s = useGame.getState()
    expect(s.money).toBe(1000 - marketStock(SAT).mystery.price)
    expect(s.inventory.length).toBeGreaterThan(0)
    expect(s.marketBought).toEqual([visitKey(SAT, 'mystery')])
  })

  it('refuses when the money is short', () => {
    useGame.setState({ money: 10 })
    useGame.getState().buyMarket('seed')
    expect(useGame.getState().inventory).toEqual([])
    expect(useGame.getState().money).toBe(10)
  })

  it('the saved visit list defaults to empty for older saves', () => {
    expect(migrateSave({ money: 1, day: SAT }).marketBought).toEqual([])
    expect(migrateSave({ money: 1, day: SAT, marketBought: ['ok', 3] }).marketBought).toEqual(['ok'])
  })
})

describe('villagers warn about tomorrow', () => {
  it('the day before market day, a villager mentions it on the first talk', () => {
    useGame.setState({ day: '2026-10-16', dialog: null, talked: [], houses: [] })
    useGame.getState().talkTo(VILLAGERS.find((v) => v.id === 'mocha')!)
    expect(useGame.getState().dialog?.lines.some((l) => l.includes('장날'))).toBe(true)
  })
})
