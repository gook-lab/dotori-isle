import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays } from '../core/economy'
import { createBank, SAVINGS_BASE_CAP } from '../core/bank'
import { NEW_HOME } from '../core/home'
import { dailyStock, NEW_SHOP } from '../core/shopTiers'
import { countOf } from '../core/inventory'
import { migrateSave, useGame, saveOf } from './store'

const fresh = useGame.getState()
const D0 = '2026-03-10'

/** 날짜를 옮기고 시계를 한 번 맞춘다. 실제 앱이 30초마다 하는 일과 같다. */
function goTo(day: string) {
  vi.setSystemTime(new Date(`${day}T12:00:00`))
  useGame.getState().syncClock()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${D0}T12:00:00`))
  useGame.setState({
    ...fresh,
    day: D0,
    money: 0,
    inventory: [],
    tools: [],
    stats: {},
    questsDone: [],
    quests: [],
    dailyBase: {},
    dailyClaimed: [],
    miles: 0,
    pocket: 20,
    panel: null,
    inHome: false,
    placing: null,
    homePlacing: null,
    shop: NEW_SHOP,
    home: NEW_HOME,
    homeFurniture: [],
    homeStorage: [],
    bank: createBank(D0),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('shop stock and stats', () => {
  it('buys only from today stock, at the sale price, and counts the spend', () => {
    const [first] = dailyStock(0, D0)
    useGame.setState({ money: 1000 })
    useGame.getState().buyItem(first.itemId)
    expect(useGame.getState().money).toBe(1000 - first.price)
    expect(countOf(useGame.getState().inventory, first.itemId)).toBe(1)
    expect(useGame.getState().stats.spent).toBe(first.price)
  })

  it('refuses an item that is not on today stock', () => {
    const off = (['flower-seed', 'flowerpot', 'chair'] as const).find((id) => !dailyStock(0, D0).some((e) => e.itemId === id))
    // 노점 진열에 없는 물건은 살 수 없다(진열 후보 밖의 물건으로 확인)
    useGame.setState({ money: 5000 })
    useGame.getState().buyItem(off ?? 'campfire')
    expect(useGame.getState().money).toBe(5000)
    expect(useGame.getState().stats.spent).toBeUndefined()
  })
})

describe('shop upgrade across a day change', () => {
  it('needs the unlock checks and the money, then closes for a day and reopens bigger', () => {
    useGame.setState({ money: 5000 })
    useGame.getState().upgradeShop()
    expect(useGame.getState().shop.order).toBeNull()
    expect(useGame.getState().money).toBe(5000)

    useGame.setState({ stats: { earn: 1000, spent: 1500 }, questsDone: ['materials'] })
    useGame.getState().upgradeShop()
    expect(useGame.getState().shop.order).toEqual({ to: 1, day: D0 })
    expect(useGame.getState().money).toBe(5000 - 1500)

    // 공사 첫날: 문을 닫고, 살 수 없다. 단계는 아직 노점이다.
    goTo(addDays(D0, 1) as string)
    const money = useGame.getState().money
    useGame.getState().buyItem(dailyStock(0, addDays(D0, 1) as string)[0].itemId)
    expect(useGame.getState().money).toBe(money)
    expect(useGame.getState().shop.tier).toBe(0)

    // 그다음 날 새 가게. 마일리지 보너스가 붙는다.
    goTo(addDays(D0, 2) as string)
    expect(useGame.getState().shop).toEqual({ tier: 1, order: null })
    expect(useGame.getState().miles).toBe(100)
  })

  it('refuses a second upgrade while one is being built', () => {
    useGame.setState({ money: 9000, stats: { earn: 1000, spent: 1500 }, questsDone: ['materials'], shop: { tier: 0, order: { to: 1, day: D0 } } })
    useGame.getState().upgradeShop()
    expect(useGame.getState().shop.order).toEqual({ to: 1, day: D0 })
    expect(useGame.getState().money).toBe(9000)
  })
})

describe('house order, overnight build and loan gating', () => {
  it('records the loan at once, builds overnight, and blocks the next stage until paid', () => {
    useGame.setState({ money: 10000 })
    useGame.getState().orderHome()
    expect(useGame.getState().home).toEqual({ stage: 0, loan: 2500, order: { to: 1, day: D0 } })
    // 짓는 중에는 다시 맡길 수 없다
    useGame.getState().orderHome()
    expect(useGame.getState().home.order?.to).toBe(1)

    goTo(addDays(D0, 1) as string)
    expect(useGame.getState().home).toEqual({ stage: 1, loan: 2500, order: null })

    // 빚이 남아 있으면 다음 집을 맡길 수 없다
    useGame.getState().orderHome()
    expect(useGame.getState().home.order).toBeNull()
    expect(useGame.getState().home.stage).toBe(1)

    // 주머니로 조금만 갚으면 남은 빚이 줄어든다
    useGame.getState().repayFromPocket(1000)
    expect(useGame.getState().home.loan).toBe(1500)
    expect(useGame.getState().money).toBe(10000 - 1000 - 0)

    // 나머지는 통장에서 갚는다
    useGame.setState({ bank: { ...useGame.getState().bank, savings: 2000 } })
    useGame.getState().repayFromSavings(5000)
    expect(useGame.getState().home.loan).toBe(0)
    expect(useGame.getState().bank.savings).toBe(500)

    useGame.getState().orderHome()
    expect(useGame.getState().home).toEqual({ stage: 1, loan: 8000, order: { to: 2, day: addDays(D0, 1) } })
  })

  it('will not take a loan when the wallet is empty of the repayment amount', () => {
    useGame.setState({ money: 300, home: { stage: 1, loan: 2500, order: null } })
    useGame.getState().repayFromPocket(1000)
    expect(useGame.getState().home.loan).toBe(2500)
    expect(useGame.getState().money).toBe(300)
  })
})

describe('ATM deposit, withdraw, limits and interest', () => {
  it('moves money into the savings book and enforces the daily withdraw limit', () => {
    useGame.setState({ money: 10000 })
    useGame.getState().bankDeposit(5000)
    expect(useGame.getState().money).toBe(5000)
    expect(useGame.getState().bank.savings).toBe(5000)

    useGame.getState().bankWithdraw(3000)
    expect(useGame.getState().money).toBe(8000)
    expect(useGame.getState().bank.savings).toBe(2000)

    // 하루 한도 3000 을 다 썼다
    useGame.getState().bankWithdraw(1)
    expect(useGame.getState().money).toBe(8000)
    expect(useGame.getState().bank.savings).toBe(2000)

    // 다음 날은 한도가 다시 열린다
    goTo(addDays(D0, 1) as string)
    useGame.getState().bankWithdraw(2000)
    expect(useGame.getState().bank.savings).toBe(0)
  })

  it('refuses to deposit past the savings cap and to deposit more than the wallet holds', () => {
    useGame.setState({ money: 1_000_000, bank: { ...createBank(D0), savings: SAVINGS_BASE_CAP - 100 } })
    useGame.getState().bankDeposit(200)
    expect(useGame.getState().bank.savings).toBe(SAVINGS_BASE_CAP - 100)
    useGame.getState().bankDeposit(100)
    expect(useGame.getState().bank.savings).toBe(SAVINGS_BASE_CAP)
    useGame.setState({ money: 5 })
    useGame.getState().bankDeposit(10)
    expect(useGame.getState().bank.savings).toBe(SAVINGS_BASE_CAP)
  })

  it('adds interest on the 30-day rollover and says so', () => {
    useGame.setState({ bank: { ...createBank(D0), savings: 100_000 } })
    goTo(addDays(D0, 30) as string)
    expect(useGame.getState().bank.savings).toBe(100_500)
    expect(useGame.getState().bank.day).toBe(addDays(D0, 30))
    expect(useGame.getState().toast?.text).toContain('이자 도토리 500개')
  })

  it('caps one month of interest at the interest ceiling', () => {
    useGame.setState({ bank: { ...createBank(D0), savings: 250_000 } })
    goTo(addDays(D0, 30) as string)
    expect(useGame.getState().bank.savings).toBe(251_000)
  })
})

describe('ATM mileage products', () => {
  it('turns miles into a coupon item and into a bigger savings cap', () => {
    useGame.setState({ miles: 1900 })
    useGame.getState().buyAtm('coupon')
    expect(useGame.getState().miles).toBe(1500)
    expect(countOf(useGame.getState().inventory, 'acorn-coupon')).toBe(1)

    useGame.getState().buyAtm('savings-cap')
    expect(useGame.getState().miles).toBe(0)
    expect(useGame.getState().bank.capUpgrades).toBe(1)
  })

  it('does not spend miles when the pocket has no room for the coupon', () => {
    useGame.setState({ miles: 400, pocket: 0 })
    useGame.getState().buyAtm('coupon')
    expect(useGame.getState().miles).toBe(400)
    expect(countOf(useGame.getState().inventory, 'acorn-coupon')).toBe(0)
  })
})

describe('saved data', () => {
  it('saves the shop, home, storage and bank beside the old fields', () => {
    const saved = saveOf(useGame.getState())
    expect(saved.shop).toEqual(NEW_SHOP)
    expect(saved.home).toEqual(NEW_HOME)
    expect(saved.bank.day).toBe(D0)
    expect(saved.homeFurniture).toEqual([])
    expect(saved.homeStorage).toEqual([])
  })

  it('fills in defaults when an old save has no economy fields, and keeps good values', () => {
    const migrate = migrateSave
    const old = migrate({ money: 77, day: D0, inventory: [] }) as unknown as ReturnType<typeof saveOf>
    expect(old.money).toBe(77)
    expect(old.shop).toEqual(NEW_SHOP)
    expect(old.home).toEqual(NEW_HOME)
    expect(old.bank).toEqual(createBank(D0))
    expect(old.homeFurniture).toEqual([])

    const good = { shop: { tier: 2, order: null }, home: { stage: 2, loan: 0, order: null }, bank: { ...createBank(D0), savings: 9 } }
    const kept = migrate({ money: 1, day: D0, ...good }) as unknown as ReturnType<typeof saveOf>
    expect(kept.shop.tier).toBe(2)
    expect(kept.home.stage).toBe(2)
    expect(kept.bank.savings).toBe(9)

    // 깨진 값은 기본값으로 되돌린다
    const broken = migrate({ shop: { tier: 9 }, home: { stage: 7, loan: -3 }, bank: { savings: 'x' } }) as unknown as ReturnType<typeof saveOf>
    expect(broken.shop).toEqual(NEW_SHOP)
    expect(broken.home).toEqual(NEW_HOME)
    expect(broken.bank.savings).toBe(0)
  })
})
