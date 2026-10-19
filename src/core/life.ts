/**
 * 섬 살림 요약: 상점 단계, 집 단계와 대출, 통장과 정기 예금, 이번 주 목표를 한 화면에 모은 순수 함수.
 * 값은 기존 함수(상점 조건, 집 단계, 이자, 예금, 주간 목표)를 그대로 읽는다. 새로 저장하지 않는다.
 */

import { nextInterest, type BankState } from './bank'
import { addDays } from './economy'
import { josa } from './items'
import { depositInterest, type FixedDeposit } from './deposit'
import { expandCost, type HouseExpand } from './houseExpand'
import { homeDef, nextStage, type HomeStage } from './home'
import { SHOP_TIERS, tierDef, unlockChecks, type ShopStats, type ShopTier } from './shopTiers'
import { weeklyOpen, weeklyView, type WeeklyState } from './weekly'
import { VILLAGERS } from './villagers'

export interface LifeBar {
  label: string
  have: number
  need: number
  done: boolean
}

export interface LifeRow {
  /** 누르면 열리는 곳 */
  target: 'shop' | 'home' | 'atm' | 'quest' | 'flow'
  title: string
  /** 한 줄 설명(해요체) */
  line: string
  /** 진척 막대(없으면 빈 배열) */
  bars: LifeBar[]
}

export interface LifeInput {
  day: string
  shopTier: ShopTier
  shopStats: ShopStats
  homeStage: HomeStage
  /** 집 꾸미기 등급. 없으면 집 줄에 점수를 붙이지 않는다. */
  homeGrade?: HomeGrade | null
  loan: number
  bank: BankState
  deposit: FixedDeposit | null
  weekly: WeeklyState | null
  /** 증축 중인 집. 없으면 줄을 붙이지 않는다. */
  houseExpand?: HouseExpand | null
  storyChapter: number
  stats: Readonly<Record<string, number>>
  /** 날이 바뀔 때 저장한 누적 기록. 오늘 번·쓴 양은 지금 누적에서 이것을 뺀 값이다. */
  dailyBase: Readonly<Record<string, number>>
  /** 지금 지갑과 아침 지갑. 있으면 오늘 줄에 그 밖의 흐름을 붙인다. */
  money?: number
  dailyMoney?: number | null
}

/** 상점: 지금 단계와 다음 단계 조건 진척 */
export function shopRow(tier: ShopTier, stats: ShopStats): LifeRow {
  const name = tierDef(tier).name
  if (tier >= SHOP_TIERS.length - 1) return { target: 'shop', title: `🏪 ${name}`, line: '가게가 가장 커요. 더 키울 곳은 없어요.', bars: [] }
  const next = (tier + 1) as ShopTier
  const bars = unlockChecks(next, stats)
  const done = bars.length > 0 && bars.every((b) => b.done)
  return {
    target: 'shop',
    title: `🏪 ${name} · 다음 ${tierDef(next).name}`,
    // 집 대출이 남아 있어도 상점은 올릴 수 있다(startUpgrade 는 대출을 보지 않는다)
    line: `${done ? '조건을 다 채웠어요. 상점 공사를 맡겨 볼 수 있어요.' : '다음 단계 조건을 채워 가고 있어요.'} 집 대출과 상관없이 올릴 수 있어요.`,
    bars,
  }
}

/** 집 꾸미기 점수와 별 등급(없으면 null). 집 줄 제목에 붙는다. */
export interface HomeGrade {
  total: number
  stars: number
}

/** 집: 지금 집, 꾸미기 점수와 별 등급, 남은 대출, 다음 집 */
export function homeRow(stage: HomeStage, loan: number, grade: HomeGrade | null = null): LifeRow {
  const now = homeDef(stage).name
  const next = nextStage(stage)
  // 꾸민 점수가 0이면 0점·별 0을 붙이지 않는다(꾸미기를 시작한 뒤에만 보인다)
  const deco = grade && grade.total > 0 ? ` · 꾸미기 ${grade.total}점 · 별 ${grade.stars}` : ''
  if (!next) return { target: 'home', title: `🏡 ${now}${deco}`, line: '가장 큰 집이에요. 더 지을 곳은 없어요.', bars: [] }
  const line = loan > 0 ? `남은 대출 도토리 ${loan.toLocaleString()}개를 갚아야 다음 집을 맡길 수 있어요. ATM은 도토리 상점 안에 있어요.` : `다음 집은 ${josa(next.name, '이에요', '예요')}. 대출 도토리 ${next.loan.toLocaleString()}개가 잡혀요.`
  return { target: 'home', title: `🏡 ${now}${deco} · 다음 ${next.name}`, line, bars: [] }
}

/** 통장: 잔고, 다음 이자, 정기 예금 만기 */
export function bankRow(bank: BankState, day: string, deposit: FixedDeposit | null): LifeRow {
  const next = nextInterest(bank, day)
  const interest = next && next.amount > 0 ? `${next.days}일 뒤 약 도토리 ${next.amount.toLocaleString()}개 이자` : '지금은 붙을 이자가 없어요'
  const dep = deposit
    ? `정기 예금 도토리 ${deposit.principal.toLocaleString()}개는 ${deposit.due} 만기예요(이자 약 도토리 ${depositInterest(deposit.principal, deposit.days).toLocaleString()}개)`
    : '정기 예금은 아직 없어요'
  return { target: 'atm', title: `🐿️ 통장 🌰 ${bank.savings.toLocaleString()}`, line: `${interest} · ${dep}`, bars: [] }
}

/** 불러온 아침 기준값. 숫자가 아닌 칸과 음수는 버리고, 없으면 빈 기록이다. */
export function cleanDailyBase(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0))
}

/** 오늘 번 도토리와 쓴 도토리. 누적(earn·spent)에서 아침에 저장한 기준값을 뺀다. */
export function flowOf(stats: Readonly<Record<string, number>>, base: Readonly<Record<string, number>>): { earned: number; spent: number } {
  return {
    earned: Math.max(0, (stats.earn ?? 0) - (base.earn ?? 0)),
    spent: Math.max(0, (stats.spent ?? 0) - (base.spent ?? 0)),
  }
}

/** 오늘 ATM 이동: stats.atmIn 은 통장→지갑, stats.atmOut 은 지갑→통장·예금·대출 상환. 날이 바뀌면 기준값을 뺀다. */
export function moveOf(stats: Readonly<Record<string, number>>, base: Readonly<Record<string, number>>): { atmIn: number; atmOut: number } {
  return {
    atmIn: Math.max(0, (stats.atmIn ?? 0) - (base.atmIn ?? 0)),
    atmOut: Math.max(0, (stats.atmOut ?? 0) - (base.atmOut ?? 0)),
  }
}

/**
 * 도토리를 상점 밖에 쓴 곳(섬 가꾸기 2차 · 집 증축 돕기 · 리폼). 상점 누계 spent 와 따로 센다.
 * stats 칸에 쌓이므로 아침 기준값(dailyBase)과 같이 날짜별로 뺀다. 0 원인 곳은 줄에서 뺀다.
 */
export const SINK_KINDS = [
  { key: 'spentGift', label: '섬 가꾸기 2차' },
  { key: 'spentHouse', label: '집 증축 돕기' },
  { key: 'spentReform', label: '리폼' },
] as const

/** 오늘 상점 밖에 쓴 도토리 항목별 금액. 쓴 것이 없으면 빈 배열. */
export function sinkOf(stats: Readonly<Record<string, number>>, base: Readonly<Record<string, number>>): { label: string; amount: number }[] {
  return SINK_KINDS.map((k) => ({ label: k.label, amount: Math.max(0, (stats[k.key] ?? 0) - (base[k.key] ?? 0)) })).filter((x) => x.amount > 0)
}

/**
 * 그 밖의 지갑 흐름(순액): 지갑 변화에서 상점 판매·구매와 ATM 이동, 상점 밖 지출(sinkOf)을 뺀 나머지.
 * 퀘스트 보상, 편지 선물, 상점 단계 공사비처럼 가계부 막대에 안 잡히는 것이 여기 든다.
 * dailyMoney 가 없으면(예전 저장) 0 이다. 지갑 변화 = 번 것 − 쓴 것 + 통장 빼기 − 통장 넣기 + 상점 밖 지출(−) + 그 밖의 흐름.
 */
export function otherOf(money: number, dailyMoney: number | null, stats: Readonly<Record<string, number>>, base: Readonly<Record<string, number>>): number {
  if (dailyMoney === null) return 0
  const { earned, spent } = flowOf(stats, base)
  const { atmIn, atmOut } = moveOf(stats, base)
  const sinks = sinkOf(stats, base).reduce((n, x) => n + x.amount, 0)
  return money - dailyMoney - (earned - spent) - (atmIn - atmOut) + sinks
}

/** 불러온 아침 지갑 기준값. 없거나 틀리면 null 이다. */
export function cleanDailyMoney(v: unknown): number | null {
  return isCount(v) ? v : null
}

/** 오늘 번 도토리와 쓴 도토리 줄. 그 밖의 흐름이 있으면 뒤에 붙인다. 누르는 곳은 없다. */
export function todayRow(stats: Readonly<Record<string, number>>, base: Readonly<Record<string, number>>, other = 0): LifeRow {
  const { earned, spent } = flowOf(stats, base)
  const named = sinkOf(stats, base).map((x) => ` · ${x.label}에\u00a0${x.amount.toLocaleString()}개`).join('')
  const rest = other > 0 ? ` · 그 밖에 받은\u00a0${other.toLocaleString()}개` : other < 0 ? ` · 그 밖에 쓴\u00a0${(-other).toLocaleString()}개` : ''
  return { target: 'flow', title: '🌰 오늘', line: `번 도토리 ${earned.toLocaleString()}개 · 쓴 도토리 ${spent.toLocaleString()}개${named}${rest}`, bars: [] }
}

/** 가계부 하루 기록: 그날 번 도토리와 쓴 도토리. 날이 바뀔 때 어제 것을 남긴다. */
export interface DayLog {
  day: string
  earned: number
  spent: number
  /** 상점 판매·구매와 ATM 이동을 뺀 나머지 지갑 흐름(순액). 양수면 받은 것, 음수면 쓴 것. 예전 기록에는 없다. */
  other?: number
}

/** 가계부가 보관하는 날 수(최근 것만 남긴다). 앱의 7일 막대와 같다. */
export const LEDGER_DAYS = 7

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function isCount(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0
}

/** 같은 날은 뒤의 것이 이기고, 날짜순으로 정렬한 뒤 최근 LEDGER_DAYS 칸만 남긴다. */
function keepLedger(rows: DayLog[]): DayLog[] {
  const byDay = new Map<string, DayLog>(rows.map((r) => [r.day, r]))
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).slice(-LEDGER_DAYS)
}

/** 불러온 가계부: 날짜 글과 숫자가 맞는 칸만 남기고, 최근 LEDGER_DAYS 칸으로 줄인다. 없으면 빈 기록이다. */
export function cleanLedger(v: unknown): DayLog[] {
  if (!Array.isArray(v)) return []
  const rows = v.flatMap((r): DayLog[] => {
    if (!r || typeof r !== 'object') return []
    const { day, earned, spent, other } = r as Record<string, unknown>
    if (typeof day !== 'string' || !DAY_KEY.test(day) || !isCount(earned) || !isCount(spent)) return []
    if (typeof other === 'number' && Number.isFinite(other)) return [{ day, earned, spent, other }]
    return [{ day, earned, spent }]
  })
  return keepLedger(rows)
}

/** 날이 바뀔 때 어제 기록을 가계부에 더한다. */
export function pushLedger(ledger: readonly DayLog[], entry: DayLog): DayLog[] {
  return keepLedger([...ledger, entry])
}

/** 가계부 막대 한 칸. recorded 가 false 면 기록이 없는 빈 칸이다. */
export interface LedgerSlot {
  day: string
  earned: number
  spent: number
  recorded: boolean
  /** 가장 많이 번 날(기록이 있고 번 것이 0보다 큰 날 중 첫 번째) */
  best: boolean
}

/** 최근 LEDGER_DAYS 일(오늘 포함, 오래된 날부터). 오늘 칸은 지금 누적으로 채우고, 지난 날은 가계부에서 찾는다. */
export function weekLedger(ledger: readonly DayLog[], today: string, stats: Readonly<Record<string, number>>, base: Readonly<Record<string, number>>): LedgerSlot[] {
  const now = flowOf(stats, base)
  const slots: LedgerSlot[] = Array.from({ length: LEDGER_DAYS }, (_, i) => {
    if (i === LEDGER_DAYS - 1) return { day: today, earned: now.earned, spent: now.spent, recorded: true, best: false }
    const day = addDays(today, i - (LEDGER_DAYS - 1)) ?? today
    const hit = ledger.find((r) => r.day === day)
    return { day, earned: hit?.earned ?? 0, spent: hit?.spent ?? 0, recorded: !!hit, best: false }
  })
  let top = -1
  slots.forEach((s, i) => {
    if (s.recorded && s.earned > 0 && (top < 0 || s.earned > slots[top].earned)) top = i
  })
  if (top >= 0) slots[top].best = true
  return slots
}

/** 이번 주 목표: 열린 뒤에만 보여 준다. 채운 개수와 보너스 여부. */
export function weeklyRow(weekly: WeeklyState | null, day: string, stats: Readonly<Record<string, number>>, storyChapter: number): LifeRow | null {
  if (!weeklyOpen(storyChapter)) return null
  const view = weeklyView(weekly, day, stats)
  const bars = view.rows.map((r) => ({ label: r.label, have: r.current, need: r.target, done: r.done }))
  const count = bars.filter((b) => b.done).length
  return {
    target: 'quest',
    title: `📋 이번 주 목표 ${count}/${bars.length}`,
    line: view.bonus ? '보너스까지 받았어요.' : count === bars.length ? '세 가지를 다 채웠어요. 보너스를 받아요.' : '세 가지 중 채운 만큼 마일과 도토리를 받아요.',
    bars,
  }
}

/** 주민 집 증축 중인 집: 남은 도토리 한 줄. 값이 다 찼으면 완성 날만 보여 준다. 진행 중인 집이 없으면 null. */
export function expandRow(expand: HouseExpand | null): LifeRow | null {
  if (!expand) return null
  const name = VILLAGERS.find((v) => v.id === expand.villagerId)?.name ?? expand.villagerId
  const tail = expand.ready ? '내일 아침에 완성돼요' : `남은 도토리 ${(expandCost(expand.villagerId) - expand.fund).toLocaleString()}개`
  return { target: 'home', title: `🏠 ${name}네 집 증축 · ${tail}`, line: '', bars: [] }
}

/** 섬 살림 화면에 그릴 줄들. 이번 주 목표는 열렸을 때만 붙는다. */
export function lifeRows(input: LifeInput): LifeRow[] {
  const rows: LifeRow[] = [
    shopRow(input.shopTier, input.shopStats),
    homeRow(input.homeStage, input.loan, input.homeGrade ?? null),
    bankRow(input.bank, input.day, input.deposit),
    todayRow(input.stats, input.dailyBase, input.money === undefined ? 0 : otherOf(input.money, input.dailyMoney ?? null, input.stats, input.dailyBase)),
  ]
  const house = expandRow(input.houseExpand ?? null)
  if (house) rows.push(house)
  const week = weeklyRow(input.weekly, input.day, input.stats, input.storyChapter)
  if (week) rows.push(week)
  return rows
}
