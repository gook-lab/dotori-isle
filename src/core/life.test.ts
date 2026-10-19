import { describe, expect, it } from 'vitest'
import { createBank, type BankState } from './bank'
import { bankRow, cleanDailyBase, expandRow, homeRow, lifeRows, otherOf, shopRow, sinkOf, todayRow, weeklyRow, cleanLedger, pushLedger, weekLedger, LEDGER_DAYS } from './life'
import { expandCost } from './houseExpand'
import { newWeekly } from './weekly'

const D = '2026-10-21'
const bank = (over: Partial<BankState> = {}): BankState => ({ ...createBank(D), ...over })
const stats = { sold: 0, spent: 0, questsDone: [] as string[] }

describe('섬 살림: 상점 줄', () => {
  it('shows the next shop tier with its bars, sold and spent and quest', () => {
    const row = shopRow(0, stats)
    expect(row.title).toContain('노점')
    expect(row.title).toContain('다음')
    // 노점 다음(가게)은 판 도토리와 퀘스트만 본다. 쓴 도토리 조건은 0이라 줄에 없다.
    const labels = row.bars.map((b) => b.label)
    expect(labels.some((l) => l.includes('팔기'))).toBe(true)
    expect(labels.some((l) => l.includes('메인 퀘스트'))).toBe(true)
    expect(row.bars.every((b) => !b.done)).toBe(true)
  })

  it('marks the bars done as the progress grows and says so when all are met', () => {
    const partial = shopRow(0, { sold: 400, spent: 0, questsDone: [] })
    expect(partial.bars.find((b) => b.label.includes('팔기'))).toMatchObject({ have: 400, need: 1000, done: false })
    expect(partial.line).toContain('채워 가고')
    const all = shopRow(0, { sold: 1000, spent: 0, questsDone: ['materials'] })
    expect(all.bars.every((b) => b.done)).toBe(true)
    expect(all.line).toContain('조건을 다 채웠어요')
  })

  it('says there is nothing more at the top tier', () => {
    expect(shopRow(3, stats).bars).toEqual([])
  })
})

describe('섬 살림: 집 줄', () => {
  it('shows the remaining loan and blocks the next build until it is paid', () => {
    const row = homeRow(1, 1200)
    expect(row.line).toContain('1,200')
    expect(row.line).toContain('갚아야')
  })

  it('names the next build when there is no loan', () => {
    const row = homeRow(0, 0)
    expect(row.title).toContain('다음')
    expect(row.line).toContain('대출')
  })
})

describe('섬 살림: 통장 줄', () => {
  it('shows the next interest and the deposit maturity', () => {
    const row = bankRow(bank({ savings: 20000 }), D, { principal: 5000, days: 7, start: D, due: '2026-10-28' })
    expect(row.target).toBe('atm')
    expect(row.line).toContain('이자')
    expect(row.line).toContain('2026-10-28')
  })

  it('says when there is no deposit or interest', () => {
    const row = bankRow(bank(), D, null)
    expect(row.line).toContain('정기 예금은 아직 없어요')
    expect(row.line).toContain('붙을 이자가 없어요')
  })
})

describe('섬 살림: 이번 주 목표 줄', () => {
  it('is hidden before the story reaches the weekly chapter', () => {
    expect(weeklyRow(null, D, {}, 0)).toBeNull()
  })

  it('counts the finished goals once the weekly board opens', () => {
    const row = weeklyRow(null, D, {}, 99)
    expect(row).not.toBeNull()
    expect(row?.title).toMatch(/이번 주 목표 0\/3/)
    expect(row?.bars).toHaveLength(3)
  })

  it('starts a saved week at zero progress', () => {
    const week = newWeekly('2026-10-19', {})
    const row = weeklyRow(week, D, {}, 99)
    expect(row?.bars.every((b) => b.have === 0 && !b.done)).toBe(true)
  })
})

describe('섬 살림: 전체 줄', () => {
  it('builds shop, home, and bank rows, plus the weekly row only when open', () => {
    const base = { day: D, shopTier: 0 as const, shopStats: stats, homeStage: 0 as const, loan: 0, bank: bank(), deposit: null, weekly: null, stats: {}, dailyBase: {} }
    expect(lifeRows({ ...base, storyChapter: 0 }).map((r) => r.target)).toEqual(['shop', 'home', 'atm', 'flow'])
    expect(lifeRows({ ...base, storyChapter: 99 }).map((r) => r.target)).toEqual(['shop', 'home', 'atm', 'flow', 'quest'])
  })
})

describe('섬 살림: 오늘 줄', () => {
  it('counts today as the change from the morning base', () => {
    const row = todayRow({ earn: 1500, spent: 400 }, { earn: 1000, spent: 100 })
    expect(row.target).toBe('flow')
    expect(row.line).toBe('번 도토리 500개 · 쓴 도토리 300개')
    expect(row.bars).toEqual([])
  })

  it('starts at zero when nothing changed since the morning', () => {
    expect(todayRow({ earn: 900, spent: 20 }, { earn: 900, spent: 20 }).line).toBe('번 도토리 0개 · 쓴 도토리 0개')
  })

  it('treats a missing base as zero and never shows a negative count', () => {
    expect(todayRow({ earn: 300 }, {}).line).toBe('번 도토리 300개 · 쓴 도토리 0개')
    expect(todayRow({ earn: 100 }, { earn: 250 }).line).toBe('번 도토리 0개 · 쓴 도토리 0개')
  })
})

describe('섬 살림: 아침 기준값 불러오기', () => {
  it('keeps only finite non-negative numbers and drops everything else', () => {
    expect(cleanDailyBase({ earn: 40, spent: -1, bad: 'x', nan: Number.NaN, ok: 0 })).toEqual({ earn: 40, ok: 0 })
  })

  it('treats a missing or broken value as an empty record', () => {
    expect(cleanDailyBase(undefined)).toEqual({})
    expect(cleanDailyBase(null)).toEqual({})
    expect(cleanDailyBase([1, 2])).toEqual({})
    expect(cleanDailyBase('earn')).toEqual({})
  })
})

describe('섬 살림 집 줄의 꾸미기 등급', () => {
  it('집 줄 제목에 꾸미기 점수와 별 등급을 붙인다. 점수가 없으면 붙이지 않는다', () => {
    expect(homeRow(0, 0, { total: 45, stars: 2 }).title).toContain('꾸미기 45점 · 별 2')
    expect(homeRow(0, 0).title).not.toContain('꾸미기')
    expect(homeRow(0, 0, { total: 0, stars: 0 }).title).not.toContain('별 0')
  })
})

describe('지난 7일 가계부', () => {
  const rec = (day: string, earned: number, spent: number) => ({ day, earned, spent })

  it('불러올 때 날짜와 숫자가 맞는 칸만 남기고, 같은 날은 뒤의 것이 이기며, 최근 7칸만 날짜순으로 둔다', () => {
    const raw = [rec('2026-10-10', 5, 1), rec('2026-10-09', -3, 0), { day: 'nope', earned: 1, spent: 1 }, rec('2026-10-10', 9, 2), null, 'x']
    for (let i = 1; i <= 8; i++) raw.push(rec(`2026-10-${String(i).padStart(2, '0')}`, i, 0))
    const out = cleanLedger(raw)
    expect(out).toHaveLength(LEDGER_DAYS)
    expect(out.map((r) => r.day)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-10'].slice(-LEDGER_DAYS))
    expect(out.find((r) => r.day === '2026-10-10')).toEqual(rec('2026-10-10', 9, 2))
  })

  it('없거나 배열이 아니면 빈 기록이다', () => {
    expect(cleanLedger(undefined)).toEqual([])
    expect(cleanLedger({ day: '2026-10-10' })).toEqual([])
  })

  it('날이 바뀌면 어제 기록을 더하고, 여덟 번째 날부터는 가장 오래된 날을 뺀다', () => {
    let ledger: ReturnType<typeof pushLedger> = []
    for (let i = 1; i <= 9; i++) ledger = pushLedger(ledger, rec(`2026-10-${String(i).padStart(2, '0')}`, i * 10, i))
    expect(ledger).toHaveLength(LEDGER_DAYS)
    expect(ledger[0].day).toBe('2026-10-03')
    expect(ledger[ledger.length - 1]).toEqual(rec('2026-10-09', 90, 9))
  })

  it('주간 칸은 오늘로 끝나는 7일이고, 오늘은 지금 누적으로 채우며, 기록 없는 날은 빈 칸이다', () => {
    const ledger = [rec('2026-10-14', 40, 3), rec('2026-10-16', 10, 0)]
    const stats = { earn: 1100, spent: 60 }
    const base = { earn: 1080, spent: 50 }
    const slots = weekLedger(ledger, '2026-10-19', stats, base)
    expect(slots.map((s) => s.day)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'])
    expect(slots[6]).toMatchObject({ earned: 20, spent: 10, recorded: true })
    expect(slots[0]).toMatchObject({ earned: 0, spent: 0, recorded: false })
    expect(slots[2].recorded).toBe(false)
    expect(slots[1].recorded).toBe(true)
  })

  it('가장 많이 번 날에만 표시를 주고, 번 것이 하나도 없으면 아무 날에도 주지 않는다', () => {
    const ledger = [rec('2026-10-14', 40, 3), rec('2026-10-16', 40, 0), rec('2026-10-17', 0, 5)]
    const slots = weekLedger(ledger, '2026-10-19', { earn: 0, spent: 0 }, {})
    expect(slots.filter((s) => s.best)).toEqual([expect.objectContaining({ day: '2026-10-14' })])
    const quiet = weekLedger([rec('2026-10-14', 0, 3)], '2026-10-19', { earn: 0, spent: 0 }, {})
    expect(quiet.some((s) => s.best)).toBe(false)
  })
})


describe('섬 살림: 주민 집 증축 줄', () => {
  it('shows the house name and the acorns still needed while a house is being expanded', () => {
    const row = expandRow({ villagerId: 'mocha', fund: 1000, ready: null })
    expect(row?.title).toBe(`🏠 모카네 집 증축 · 남은 도토리 ${(expandCost('mocha') - 1000).toLocaleString()}개`)
    expect(row?.bars).toEqual([])
  })

  it('says the house is finished tomorrow morning once the acorns are all in', () => {
    expect(expandRow({ villagerId: 'mocha', fund: expandCost('mocha'), ready: '2026-10-22' })?.title).toBe('🏠 모카네 집 증축 · 내일 아침에 완성돼요')
  })

  it('adds no row when no house is being expanded', () => {
    expect(expandRow(null)).toBeNull()
    const base = { day: D, shopTier: 0 as const, shopStats: stats, homeStage: 0 as const, loan: 0, bank: bank(), deposit: null, weekly: null, storyChapter: 0, stats: {}, dailyBase: {} }
    expect(lifeRows({ ...base, houseExpand: null }).some((r) => r.title.includes('증축'))).toBe(false)
    expect(lifeRows({ ...base, houseExpand: { villagerId: 'mocha', fund: 0, ready: null } }).some((r) => r.title.includes('모카네 집 증축'))).toBe(true)
  })
})

describe('섬 살림: 상점 밖 도토리 지출 항목', () => {
  it('names only today\'s spending outside the shop', () => {
    expect(sinkOf({ spentHouse: 1500, spentGift: 3000, spentReform: 36 }, { spentHouse: 500, spentGift: 3000 })).toEqual([
      { label: '집 증축 돕기', amount: 1000 },
      { label: '리폼', amount: 36 },
    ])
    expect(sinkOf({}, {})).toEqual([])
  })

  it('puts the named spending in the today line instead of the other-flow figure', () => {
    const row = todayRow({ earn: 0, spent: 0, spentHouse: 1000, spentGift: 3000 }, {})
    expect(row.line).toBe('번 도토리 0개 · 쓴 도토리 0개 · 섬 가꾸기 2차에\u00a03,000개 · 집 증축 돕기에\u00a01,000개')
  })

  it('does not count a house or gift donation as other flow', () => {
    // 아침 20,000 → 지금 19,000: 증축 1,000 을 냈을 뿐이라 그 밖의 흐름은 0 이다
    expect(otherOf(19000, 20000, { spentHouse: 1000 }, {})).toBe(0)
    // 같은 날 퀘스트 보상 500 을 더 받았다면 그 밖의 흐름은 500 이다
    expect(otherOf(19500, 20000, { spentHouse: 1000 }, {})).toBe(500)
  })
})
