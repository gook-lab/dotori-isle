import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flowOf, moveOf, otherOf } from '../core/life'
import { dailyStock } from '../core/shopTiers'
import { NEW_SHOP_LOG } from '../core/shopEvents'
import { useGame } from './store'

// 하루 동안 판매·구매·입출금·상환·예금·마일 교환을 섞고, 가계부(번 도토리·쓴 도토리)가 지갑 변화와 어떻게 맞는지 본다.
// 가계부는 상점 판매(earn)와 상점 구매(spent)만 센다. ATM 입출금·예금·상환·마일 교환은 돈이 옮겨 가거나 마일이라 가계부에 들어가면 안 된다.
const DAY = '2026-10-29'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${DAY}T11:00:00`))
  useGame.setState({
    day: DAY,
    money: 3000,
    miles: 1200,
    stats: {},
    dailyBase: {},
    dailyMoney: 3000,
    inventory: [{ id: 'peach', count: 2 }],
    shop: { tier: 0, order: null },
    home: { stage: 1, loan: 1000, order: null },
    deposit: null,
    bank: { savings: 500, day: DAY, withdrawnDay: DAY, withdrawnToday: 0, capUpgrades: 0, limitUpgrades: 0 },
    shopLog: NEW_SHOP_LOG,
    toast: null,
    toastQueue: [],
  })
})

describe('가계부와 지갑 흐름', () => {
  it('ATM 입금·출금·예금 맡기기·해지·대출 상환은 가계부 번/쓴 도토리에 들어가지 않는다', () => {
    const s = useGame.getState()
    s.bankDeposit(400)
    s.bankWithdraw(100)
    s.repayFromPocket(300)
    s.depositOpen(200, 3)
    s.depositBreak()
    const after = useGame.getState()
    expect(flowOf(after.stats, after.dailyBase)).toEqual({ earned: 0, spent: 0 })
    expect(otherOf(after.money, after.dailyMoney ?? null, after.stats, after.dailyBase)).toBe(0)
    expect(moveOf(after.stats, after.dailyBase)).toEqual({ atmIn: 100, atmOut: 400 + 300 + 200 })
    // 지갑은 입금·상환·예금만큼 줄고, 출금만큼 늘었다(해지는 통장으로 돌아간다)
    expect(after.money).toBe(3000 - 400 - 300 - 200 + 100)
    expect(after.bank.savings).toBe(500 + 400 - 100 + 200)
  })

  it('판매는 번 도토리, 상점 구매는 쓴 도토리로 잡히고, 둘을 합친 흐름이 지갑 변화와 맞는다', () => {
    const start = useGame.getState().money
    const price = dailyStock(0, DAY)[0].price
    useGame.getState().sellAll()
    const sold = useGame.getState()
    const earned = sold.money - start
    expect(earned).toBeGreaterThan(0)
    useGame.getState().buyItem(dailyStock(0, DAY)[0].itemId)
    const mid = useGame.getState()
    expect(flowOf(mid.stats, mid.dailyBase)).toEqual({ earned, spent: price })
    expect(mid.money).toBe(start + earned - price)
  })

  it('하루 섞기: 판매 뒤 구매, 입출금·상환을 해도 가계부 합계는 상점 거래 합과 같다', () => {
    const start = useGame.getState().money
    useGame.getState().sellAll()
    const price = dailyStock(0, DAY)[0].price
    useGame.getState().buyItem(dailyStock(0, DAY)[0].itemId)
    useGame.getState().bankDeposit(300)
    useGame.getState().repayFromPocket(200)
    useGame.getState().depositOpen(100, 3)
    useGame.getState().bankWithdraw(50)
    useGame.getState().buyAtm('acorn-cushion')
    const end = useGame.getState()
    const flow = flowOf(end.stats, end.dailyBase)
    const earnedFromSale = end.stats.earn ?? 0
    expect(flow.earned).toBe(earnedFromSale)
    expect(flow.spent).toBe(price)
    // 지갑 변화 = 번 것 - 상점에서 쓴 것 - 입금 - 상환 - 예금 + 출금. 마일 교환은 도토리를 쓰지 않는다.
    expect(end.money).toBe(start + flow.earned - flow.spent - 300 - 200 - 100 + 50)
    expect(otherOf(end.money, end.dailyMoney ?? null, end.stats, end.dailyBase)).toBe(0)
  })

  it('퀘스트 보상처럼 상점과 ATM 밖에서 들어온 돈은 그 밖의 흐름으로 잡힌다', () => {
    const start = useGame.getState().money
    useGame.getState().sellAll()
    useGame.setState({ money: useGame.getState().money + 250 })
    useGame.getState().bankDeposit(120)
    const end = useGame.getState()
    const flow = flowOf(end.stats, end.dailyBase)
    const move = moveOf(end.stats, end.dailyBase)
    const other = otherOf(end.money, end.dailyMoney ?? null, end.stats, end.dailyBase)
    expect(other).toBe(250)
    // 가계부 순변화(번 − 쓴 + 그 밖) 는 지갑 순변화에서 이동분(통장 빼기 − 넣기)을 뺀 값과 같다
    expect(flow.earned - flow.spent + other).toBe(end.money - start - (move.atmIn - move.atmOut))
  })

  it('아침 기준값이 없는 예전 저장은 그 밖의 흐름이 0 이다', () => {
    useGame.setState({ dailyMoney: null })
    useGame.getState().sellAll()
    useGame.setState({ money: useGame.getState().money + 99 })
    const end = useGame.getState()
    expect(otherOf(end.money, null, end.stats, end.dailyBase)).toBe(0)
  })
})
