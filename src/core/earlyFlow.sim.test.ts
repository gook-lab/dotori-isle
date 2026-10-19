import { describe, expect, it } from 'vitest'
import { accrueInterest, createBank, deposit, withdraw, withdrawableNow, type BankState } from './bank'
import { applyPayment, NEW_HOME, settleHome, startHomeUpgrade, type HomeState } from './home'
import { ITEM_LIST, ITEMS, BUG_TABLE, FISH_TABLE, SHELL_TABLE } from './items'
import { DEX_BONUS } from './dexReward'
import { nextDay } from './festivals'
import { NEW_ISLAND_GIFT, currentGift, donateGift, GIFT_PROJECTS_2, morningGift, type IslandGiftState } from './islandGift'
import { limitedFor, weekStart } from './weeklyLimited'
import { advancedAcorns, reformAcorns } from './reform'
import { mulberry32 } from './rng'
import { NAP_MILES } from './furnitureActions'
import { newMiles } from './miles'
import { addMonthSales, settleMonth, shouldSettle, type ShopMonth } from './shopMonth'
import { SHOP_TIERS } from './shopTiers'
import { songiWeekOf, songiWeekQuotes } from './songi'
import { NEW_STAMP_CARD, stampOn, type StampCard } from './stampCard'
import { TODO_REWARD } from './todo'
import { WEEKLY_MILES } from './weekly'
import { ZONE_MILES } from './museum'
import { COUPON_VALUE, COUPON_DAILY_MAX } from './bank'

/*
 * 초반 1~15일 흐름 정식 sim (시드 고정, 회귀 검사).
 * lateSinks.sim.test.ts 와 같은 가정(판매 예산·스탬프·마일·통장·집·상점 단계)을 쓰고, 날짜만 20일까지 본다.
 * 실제 store 를 돌리지 않고 core 함수를 합쳐 쓴다. 난수는 mulberry32(7) 로 고정해 늘 같은 결과가 나온다.
 *
 * 이 파일만의 가정:
 * - 쿠폰: 남는 마일이 400 이상이면 하루 두 장까지 사서 상점에 판다(마일 400 → 도토리 500). 1차 섬 가꾸기보다 먼저 쓴다.
 * - 집 증축(주민 집)은 내 집 5단계 뒤의 흐름이라 이 sim 에서는 뺀다(16일 이후 일).
 * - 순서 두 가지: 집 우선(기본, 대출이 있으면 바로 다음 집을 맡김)과 상점 우선(상점 2단계 전에는 집 공사를 시작하지 않음).
 *
 * 검사: 1~15일 하루 잉여 ≥ 0, 1~15일 상환 뒤 지갑 ≥ 0, 집 우선이면 상점 2단계가 20일 안,
 * 상점 우선이면 집 5단계가 20일 안에 온다.
 * 하루 잉여 = 판매 + 스탬프 보상 + 쿠폰 − 그 밖의 구매 − 스탬프 구매 − 250(그 밖의 지출).
 */
const START = '2026-10-19'
/** 하루 기록 한 줄 */
export interface Day { d: number; repeat: number; sink: number; tier: number; saving: boolean; stage: number; loan: number; wallet: number; miles: number; coupons: number }
const BUDGET = { shakeTrees: 6, peachPerTree: 3, fish: 4, bugs: 6, shells: 8, seafoodFrom: 8, seafood: 1, songiPieces: 30 }
const EXTRA = 250
const STAMP_P = [0.14, 0.10, 0.06, 0.07]
const STAMP_PRICE = [139, 200, 310, 303]
const QUEST_DAY: Record<number, number> = { 1: 3, 2: 7, 3: 14 }
const REFORM_TIER = 2
const ADVANCED_TIER = 3

const wavg = (rows: readonly { id: string; weight: number }[]) => rows.reduce((a, r) => a + ITEMS[r.id].price * r.weight, 0) / rows.reduce((a, r) => a + r.weight, 0)
const seafood = ITEM_LIST.filter((i) => i.kind === 'seafood')
const AVG = {
  fish: wavg(FISH_TABLE),
  bug: wavg(BUG_TABLE),
  shell: wavg(SHELL_TABLE),
  seafood: seafood.reduce((a, i) => a + i.price, 0) / seafood.length,
}
const FURNITURE = ITEM_LIST.filter((i) => i.kind === 'furniture').map((i) => i.id)
const REFORM_AVG = FURNITURE.reduce((a, id) => a + (reformAcorns(id) ?? 0), 0) / FURNITURE.length
const ADVANCED_AVG = FURNITURE.reduce((a, id) => a + (advancedAcorns(id) ?? 0), 0) / FURNITURE.length

/** 그날 상점에 파는 도토리(판매 예산) */
function soldOn(day: string, n: number): number {
  let sold = BUDGET.shakeTrees * BUDGET.peachPerTree * ITEMS.peach.price + BUDGET.fish * AVG.fish + BUDGET.bugs * AVG.bug + BUDGET.shells * AVG.shell
  if (n >= BUDGET.seafoodFrom) sold += BUDGET.seafood * AVG.seafood
  if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) {
    const w = songiWeekOf(day)
    const q = w ? songiWeekQuotes(w) : []
    sold += BUDGET.songiPieces * (q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0)
  }
  return Math.round(sold)
}

/** 날마다 누적 마일(mileBudget.sim 과 같은 흐름). 1차 기부와 결산 보너스는 이 위에서 따로 센다. */
function milesIncome(days: number): number[] {
  const RATE: Record<string, number> = { shake: 4, chop: 2, rock: 2, dig: 0.3, bug: 0.5, fish: 0.5, plant: 0.5, water: 1, talk: 1.5, give: 0.2, craft: 0.2, build: 0.05, trip: 0.05, recruit: 0.05, 'fish-fresh': 0.1, rustle: 2, earn: 400 }
  const out: number[] = []
  let claimed: Record<string, number> = {}
  let total = 0
  for (let d = 1; d <= days; d++) {
    const stats: Record<string, number> = {}
    for (const k of Object.keys(RATE)) stats[k] = Math.floor(RATE[k] * d)
    const m = newMiles(stats, claimed)
    claimed = m.claimed
    let g = m.miles + TODO_REWARD * 3 + 100 + NAP_MILES
    if (d === 1) g += 100
    if (d === 7) g += 200
    if (d === 14) g += DEX_BONUS
    if (d === 21) g += 300 + DEX_BONUS
    if (d % 7 === 0) g += WEEKLY_MILES * 2 + 20
    if (d >= 10 && d % 7 === 0) g += 40
    if (d === 28) g += ZONE_MILES
    total += g
    out.push(total)
  }
  return out
}

interface Options {
  /** 주간 한정 진열을 산다 */
  limited: boolean
  /** 섬 가꾸기 2차를 낸다 */
  gift2: boolean
  /** 리폼을 한다(기본 매일, 고급 이틀에 한 번) */
  reform: boolean
  /** 쿠폰: 남는 마일로 하루 2장(400마일)을 사서 상점에 판다(500개) */
  coupon?: boolean
  /** 상점 2단계 전에는 집 공사를 시작하지 않는다(상점 우선) */
  shopFirst?: boolean
}

interface Result {
  /** 반복 잉여(판매 + 스탬프 보상 − 그 밖의 구매 − 스탬프 구매) */
  surplus: number[]
  /** 싱크 지출(한정·2차·리폼) */
  sink: number[]
  /** 1차 마지막 완성 날(1일째 기준). 없으면 null */
  gift1Day: number | null
  /** 2차 마지막 완성 날. 없으면 null */
  gift2Day: number | null
  /** 상점 3단계 날 */
  tier3Day: number | null
  limitedTotal: number
  /** 날마다 기록(1일째가 첫 줄) */
  rows: Day[]
}

function run(opt: Options, days: number): Result {
  const rnd = mulberry32(7)
  const cumMiles = milesIncome(days)
  let key = START
  let tier = 0
  let wallet = 0
  let soldCum = 0
  let spentCum = 0
  let saving = false
  let bank: BankState = createBank(key)
  let home: HomeState = NEW_HOME
  let stamp: StampCard = NEW_STAMP_CARD
  let tally: ShopMonth | null = null
  let g1: IslandGiftState = NEW_ISLAND_GIFT
  let g2: IslandGiftState = NEW_ISLAND_GIFT
  let mileSpent = 0
  let bonusMiles = 0
  let lastLimited: string | null = null
  let g1Day: number | null = null
  let g2Day: number | null = null
  let tier3Day: number | null = null
  let limitedTotal = 0
  const surplus: number[] = []
  const dayRows: Day[] = []
  let couponsTotal = 0
  const sink: number[] = []

  // 지갑이 모자라면 통장에서 찾는다(하루 인출 한도 안에서)
  const fund = (need: number) => {
    const amt = Math.min(need - wallet, withdrawableNow(bank, key))
    if (amt <= 0) return
    const r = withdraw(bank, amt, key)
    if (r.ok) {
      bank = r.state
      wallet += r.gained
    }
  }

  for (let d = 1; d <= days; d++) {
    home = settleHome(home, key)
    bank = accrueInterest(bank, key)
    if (shouldSettle(tally, key)) {
      const st = settleMonth(tally!, key)
      tally = st.tally
      bonusMiles += st.bonus
    }

    // 쿠폰: 남는 마일로 하루 두 장까지 사서 바로 상점에 판다(마일 400 → 도토리 500)
    let couponToday = 0
    if (opt.coupon) {
      for (let k = 0; k < COUPON_DAILY_MAX; k++) {
        if (cumMiles[d - 1] + bonusMiles - mileSpent < 400) break
        mileSpent += 400
        wallet += COUPON_VALUE
        couponToday++
      }
      couponsTotal += couponToday
    }
    // 섬 가꾸기 1차(마일): 남는 마일을 값까지 낸다. 완성은 다음 날 아침
    const mg = morningGift(g1, key)
    g1 = mg.state
    if (mg.built) g1Day = d
    const milesNow = cumMiles[d - 1] + bonusMiles - mileSpent
    const cur1 = currentGift(g1)
    if (cur1) {
      const amount = Math.min(milesNow, cur1.cost - g1.fund)
      if (amount > 0) {
        const r = donateGift(g1, milesNow, amount, key)
        if (r.ok) {
          g1 = r.state
          mileSpent += amount
        }
      }
    }

    // 섬 가꾸기 2차(도토리): 1차를 다 들이면 열린다
    if (opt.gift2 && currentGift(g1) === null) {
      const mg2 = morningGift(g2, key, GIFT_PROJECTS_2)
      g2 = mg2.state
      if (mg2.built) g2Day = d
    }

    // 하루 판매와 그 밖의 구매
    const sold = soldOn(key, d)
    let repeat = sold
    wallet += sold
    soldCum += sold
    tally = addMonthSales(tally, key, [{ id: 'peach', amount: sold }])
    if (rnd() < STAMP_P[tier]) {
      const r = stampOn(stamp, key)
      stamp = r.card
      wallet -= STAMP_PRICE[tier]
      spentCum += STAMP_PRICE[tier]
      if (r.reward) wallet += r.reward
      repeat += (r.reward || 0) - STAMP_PRICE[tier]
    }
    wallet -= EXTRA
    spentCum += EXTRA
    repeat -= EXTRA
    if (wallet < 0) wallet = 0

    let sinkToday = 0

    // 상점 단계 올리기: 판매·구매·퀘스트 조건을 맞추고 공사비를 낸다
    const nt = tier + 1
    const u = nt < SHOP_TIERS.length ? SHOP_TIERS[nt] : null
    if (u && soldCum >= u.unlock.sold && spentCum >= u.unlock.spent && d >= QUEST_DAY[nt]) {
      fund(u.upgradeCost)
      if (wallet >= u.upgradeCost) {
        wallet -= u.upgradeCost
        tier = nt
        saving = false
        if (tier === ADVANCED_TIER) tier3Day = d
      } else {
        saving = true
      }
    }

    // 집: 빚이 없으면 다음 단계를 맡기고, 빚은 지갑에서 먼저 갚는다
    if (!home.order && home.loan === 0 && home.stage < 5 && !(opt.shopFirst && tier < 2)) {
      const r = startHomeUpgrade(home, key)
      if (r.ok) home = r.state
    }
    if (home.loan > 0) {
      fund(home.loan)
      const r = applyPayment(home.loan, Math.min(wallet, home.loan))
      if (r.ok && r.paid > 0) {
        wallet -= r.paid
        home = { ...home, loan: r.balance }
      }
    }

    // 싱크 1: 섬 가꾸기 2차(남는 도토리를 값까지)
    const cur2 = currentGift(g2, GIFT_PROJECTS_2)
    if (opt.gift2 && cur2 && currentGift(g1) === null) {
      fund(cur2.cost - g2.fund)
      const amount = Math.min(wallet, cur2.cost - g2.fund)
      if (amount > 0) {
        const r = donateGift(g2, wallet, amount, key, GIFT_PROJECTS_2, false)
        if (r.ok) {
          g2 = r.state
          wallet = r.miles
          sinkToday += amount
        }
      }
    }

    // 싱크 2: 주간 한정(상점 2단계 이상, 그 주에 한 번)
    if (opt.limited && tier >= REFORM_TIER && lastLimited !== weekStart(key)) {
      const pick = limitedFor(key)!
      fund(pick.price)
      if (wallet >= pick.price) {
        wallet -= pick.price
        lastLimited = weekStart(key)
        sinkToday += pick.price
        limitedTotal += pick.price
      }
    }

    // 싱크 3: 리폼(기본 매일 / 고급 이틀에 한 번)
    if (opt.reform && tier >= REFORM_TIER) {
      fund(REFORM_AVG)
      if (wallet >= REFORM_AVG) {
        wallet -= REFORM_AVG
        sinkToday += REFORM_AVG
      }
    }
    if (opt.reform && tier >= ADVANCED_TIER && d % 2 === 0) {
      fund(ADVANCED_AVG)
      if (wallet >= ADVANCED_AVG) {
        wallet -= ADVANCED_AVG
        sinkToday += ADVANCED_AVG
      }
    }

    // 남는 돈은 통장에 넣고 지갑에는 300 만 둔다(상점 단계 조건을 기다리는 동안은 모은다)
    if (wallet > 300 && !saving) {
      const r = deposit(bank, wallet, wallet - 300, key)
      if (r.ok) {
        bank = r.state
        wallet = r.money
      }
    }

    surplus.push(repeat + couponToday * COUPON_VALUE)
    dayRows.push({ d, repeat: repeat + couponToday * COUPON_VALUE, sink: sinkToday, tier, saving, stage: home.stage, loan: home.loan, wallet, miles: cumMiles[d - 1] + bonusMiles - mileSpent, coupons: couponToday })
    sink.push(sinkToday)
    key = nextDay(key)
  }
  return { surplus, sink, gift1Day: g1Day, gift2Day: g2Day, tier3Day, limitedTotal, rows: dayRows }
}



describe('초반 1~15일 흐름 — 정식 검사', () => {
  const OPT = { limited: true, gift2: true, reform: true, coupon: true }

  describe('집 우선(기본 순서)', () => {
    const r = run({ ...OPT }, 20)
    const early = r.rows.filter((x) => x.d <= 15)

    it('1~15일 하루 잉여는 모두 0 이상이다', () => {
      expect(early.length).toBe(15)
      expect(early.every((x) => x.repeat >= 0)).toBe(true)
    })

    it('1~15일 상환 뒤 지갑과 대출 잔액은 모두 0 이상이다', () => {
      expect(early.every((x) => x.wallet >= 0 && x.loan >= 0)).toBe(true)
    })

    it('상점 2단계는 20일 안에 열린다', () => {
      const day = r.rows.find((x) => x.tier >= 2)?.d ?? null
      expect(day).not.toBeNull()
      expect(day!).toBeLessThanOrEqual(20)
    })
  })

  describe('상점 우선', () => {
    const r = run({ ...OPT, shopFirst: true }, 20)
    const early = r.rows.filter((x) => x.d <= 15)

    it('1~15일 하루 잉여는 모두 0 이상이고, 지갑과 대출도 0 이상이다', () => {
      expect(early.every((x) => x.repeat >= 0)).toBe(true)
      expect(early.every((x) => x.wallet >= 0 && x.loan >= 0)).toBe(true)
    })

    it('내 집 5단계는 20일 안에 온다', () => {
      const day = r.rows.find((x) => x.stage >= 5)?.d ?? null
      expect(day).not.toBeNull()
      expect(day!).toBeLessThanOrEqual(20)
    })
  })
})
