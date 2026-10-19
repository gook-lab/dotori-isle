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
import { completeHouseExpand, donateHouse, expandCost, expandOffer, houseTapAmount, type HouseExpand } from './houseExpand'
import { VILLAGERS } from './villagers'

/*
 * 후반 경제 90일 정식 sim (핵심 회귀 검사).
 * 상점·마일·대출·통장·스탬프·결산·섬 가꾸기 1차·2차·주간 한정·리폼을 한 번에 돌려 하루 잉여를 본다.
 * 실제 store 를 돌리지 않고 core 함수를 합쳐 쓴다. 숫자를 바꾸면 이 파일의 가정만 고친다.
 *
 * 가정(플레이어 행동 예산):
 * - 판매: 나무 흔들기 하루 6그루, 그루마다 복숭아 3개. 낚시 4마리, 벌레 6마리, 조개 8개(가중치 평균).
 *   8일째부터 해산물 하루 1개. 일요일엔 송이 30개를 그 주 시세 평균으로 판다.
 * - 그 밖의 상점 구매: 하루 250도토리(씨앗·가구 등). 스탬프는 단계별 구매 확률 14/10/6/7%, 정가 139/200/310/303.
 * - 상점 단계: 판매 조건과 공사비만 본다. 퀘스트는 1단계 3일째, 2단계 7일째, 3단계 14일째에 채운 것으로 본다.
 *   구매 조건(spent)은 실제 구매 누계로 본다.
 * - 집: 빚이 없으면 바로 다음 단계를 맡긴다(가장 빠른 속도). 빚은 지갑에서 먼저 갚는다.
 * - 마일: 보통 빈도(mileBudget.sim 과 같은 흐름). 섬 가꾸기 1차는 남는 마일을 모두 낸다.
 * - 섬 2차: 1차를 다 들이면 열리고, 남는 도토리를 값까지 낸다(통장 인출 한도 안에서).
 * - 주간 한정: 상점 2단계 이상이면 그 주에 한 번, 값이 되면 산다.
 * - 리폼 가정: 기본 리폼은 상점 2단계 이후 매일 1회(평균 가격). 고급 마감은 상점 3단계 이후 이틀에 한 번(평균 가격).
 *   고급 마감 빈도가 가장 큰 변수다.
 * - 통장: 지갑에 300 만 남기고 나머지는 넣는다. 인출은 하루 한도(3,000)를 지킨다.
 * - 주민 집 증축(선택): 내 집 5단계(16일째쯤)부터, 지어진 주민 집 11채(손님 제외)를 하나씩 넓힌다.
 *   대화 선택지를 하루 세 번 누른다(한 번에 1,000개, 남은 값까지). 값은 주민당 5,000~8,000.
 *   완성은 값이 찬 다음 날 아침. 재료 수급으로 보면 느린 경우도 13일째에 11채가 다 지어져서, 16일째에 다 있다고 봐도 된다.
 * - 빠진 수입: 퀘스트 보상, 편지 선물, 행사, 장터, 가구 판매. 빠진 지출: 장식·옷 구매.
 *
 * 반복 잉여 = (판매 + 스탬프 보상) − (그 밖의 구매 + 스탬프 구매). 싱크 지출 = 한정·2차·리폼 도토리.
 * 남는 잉여 = 반복 잉여 − 싱크 지출.
 */

const START = '2026-10-19'
const BUDGET = { shakeTrees: 6, peachPerTree: 3, fish: 4, bugs: 6, shells: 8, seafoodFrom: 8, seafood: 1, songiPieces: 30 }
const EXTRA = 250
const STAMP_P = [0.14, 0.10, 0.06, 0.07]
const STAMP_PRICE = [139, 200, 310, 303]
const QUEST_DAY: Record<number, number> = { 1: 3, 2: 7, 3: 14 }
const REFORM_TIER = 2
/** 주민 집 증축 선택지를 하루에 누르는 횟수(한 번에 1,000개) */
const HOUSE_TAPS_PER_DAY = 3
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
  /** 주민 집 증축을 한다(내 집 5단계 뒤, 하루 지갑 전액) */
  houses?: boolean
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
  /** 증축을 끝낸 집 수 */
  housesDone: number
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
  let houseCur: HouseExpand | null = null
  let houseDone: string[] = []
  // 지어진 주민 집(손님 제외). 증축은 이 목록을 차례로 넓힌다.
  const builtHouses = VILLAGERS.filter((v) => !v.guest).map((v) => v.id)
  const surplus: number[] = []
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
    if (!home.order && home.loan === 0 && home.stage < 5) {
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
    // 싱크 4: 주민 집 증축(내 집 5단계 뒤, 대화 선택지를 하루 세 번 누른다: 한 번에 1,000개, 남은 값까지)
    if (opt.houses) {
      const done = completeHouseExpand(houseCur, houseDone, key)
      houseCur = done.current
      houseDone = done.expanded
      for (let tap = 0; tap < HOUSE_TAPS_PER_DAY; tap++) {
        // 진행 중인 집이 있으면 그 집, 없으면 아직 안 넓힌 첫 집을 고른다
        const target = houseCur?.villagerId ?? builtHouses.find((id) => !houseDone.includes(id)) ?? null
        if (!target || !expandOffer(home.stage, builtHouses, houseDone, houseCur, target)) break
        const fund = houseCur?.villagerId === target ? houseCur.fund : 0
        const amount = houseTapAmount(expandCost(target) - fund, wallet)
        if (amount <= 0) break
        const r = donateHouse(houseCur, wallet, amount, key, target)
        if (!r.ok) break
        houseCur = r.state
        wallet = r.money
        sinkToday += amount
      }
    }

    if (wallet > 300 && !saving) {
      const r = deposit(bank, wallet, wallet - 300, key)
      if (r.ok) {
        bank = r.state
        wallet = r.money
      }
    }

    surplus.push(repeat)
    sink.push(sinkToday)
    key = nextDay(key)
  }
  return { surplus, sink, gift1Day: g1Day, gift2Day: g2Day, tier3Day, limitedTotal, housesDone: houseDone.length }
}

const avg = (xs: readonly number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
/** 하루 잉여 구간 평균(1일째가 0번). from·to 는 날짜(1일째 기준)다. */
const span = (xs: readonly number[], from: number, to: number) => avg(xs.slice(from - 1, to))
const netOf = (r: Result, from: number, to: number) => avg(r.surplus.slice(from - 1, to).map((x, i) => x - r.sink[from - 1 + i]))

describe('후반 경제 90일 sim — 하루 잉여 회귀', () => {
  const DAYS = 90
  const base = run({ limited: false, gift2: false, reform: false }, DAYS)
  const full = run({ limited: true, gift2: true, reform: true }, DAYS)
  console.log('SIMOUT', JSON.stringify({ base16: span(base.surplus, 16, 30), base31: span(base.surplus, 31, 90), netFull16: netOf(full, 16, 30), netFull31: netOf(full, 31, 90), sinkFull16: avg(full.sink.slice(15, 30)), sinkFull31: avg(full.sink.slice(30, 90)), limited: full.limitedTotal, g1: full.gift1Day, g2: full.gift2Day, tier3: full.tier3Day }))

  it('싱크가 없는 기준: 16~30일 반복 잉여가 2,000 을 넘는다(싱크가 메울 대상)', () => {
    expect(span(base.surplus, 16, 30)).toBeGreaterThan(2000)
    expect(span(base.surplus, 31, 90)).toBeGreaterThan(1000)
  })

  it('전체 싱크(한정 + 2차 + 리폼): 16~30일 남는 잉여는 0 이상 2,000 이하다', () => {
    const v = netOf(full, 16, 30)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(2000)
  })

  it('전체 싱크: 31~90일 남는 잉여는 0 이상 1,000 이하다', () => {
    const v = netOf(full, 31, 90)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1000)
  })

  it('싱크가 실제로 돈다: 한정 누계와 리폼 지출이 0 보다 크고, 2차가 90일 안에 끝난다', () => {
    expect(full.limitedTotal).toBeGreaterThan(0)
    expect(full.sink.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(full.gift2Day).not.toBeNull()
    expect(full.gift2Day!).toBeLessThanOrEqual(90)
  })

  it('섬 가꾸기 2차는 1차가 끝난 뒤에 완성된다', () => {
    expect(full.gift1Day).not.toBeNull()
    expect(full.gift2Day!).toBeGreaterThan(full.gift1Day!)
  })

  it('주민 집 증축을 더하면 16~30일 남는 잉여는 0 이상 2,000 이하이고, 지어진 집 11채를 모두 90일 안에 넓힌다', () => {
    const withHouses = run({ limited: true, gift2: true, reform: true, houses: true }, DAYS)
    const v = netOf(withHouses, 16, 30)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(2000)
    expect(withHouses.housesDone).toBe(VILLAGERS.filter((x) => !x.guest).length)
  })

  it('한정 물건의 값은 정가 + 고급 마감 값보다 싸지 않다(sim 가정과 같은 값 기준)', () => {
    const pick = limitedFor(START)!
    expect(pick.price).toBeGreaterThanOrEqual(ITEMS[pick.itemId].buy! + advancedAcorns(pick.itemId)!)
  })
})
