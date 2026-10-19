import { describe, expect, it } from 'vitest'
import { parseSaveFile } from './saveFile'
import { saveOf, SAVE_VERSION, useGame } from './store'

/** 내보내기: 지금 상태를 저장 목록(saveOf)으로 거른 글. 저장 키와 파일이 같은 모양이다. */
function exported(over: Partial<ReturnType<typeof saveOf>>): string {
  useGame.setState(over)
  return JSON.stringify({ state: saveOf(useGame.getState()), version: SAVE_VERSION })
}

/** 가져오기: 임의의 글을 파일 검사에 넣는다. 통과하면 이행된 상태를, 아니면 이유를 던진다. */
function imported(text: string) {
  const r = parseSaveFile(text)
  if (!r.ok) throw new Error(r.why)
  return r.state
}

/** 망가진 값을 그대로 넣은 저장 글(저장 목록을 거치지 않는다) */
const broken = (extra: Record<string, unknown>) => JSON.stringify({ state: { money: 10, day: '2026-10-19', inventory: [], ...extra }, version: SAVE_VERSION })

describe('선택 저장 필드: 백업 내보내기·가져오기', () => {
  it('dailyBase 는 내보내고 가져온 뒤에도 같은 기준값이다', () => {
    expect(imported(exported({ dailyBase: { earn: 1200, spent: 40 } })).dailyBase).toEqual({ earn: 1200, spent: 40 })
  })

  it('dailyBase 의 망가진 값(글자·음수·배열)은 버리고 깨지지 않는다', () => {
    expect(imported(broken({ dailyBase: { earn: 'x', spent: -3, ok: 5 } })).dailyBase).toEqual({ ok: 5 })
    expect(imported(broken({ dailyBase: [1, 2] })).dailyBase).toEqual({})
  })

  it('homeNew 는 내보내고 가져온 뒤에도 같은 기록이다', () => {
    expect(imported(exported({ homeNew: { day: '2026-10-19', greeted: true, from: 1 } })).homeNew).toEqual({ day: '2026-10-19', greeted: true, from: 1 })
  })

  it('homeNew 가 잘못되면(단계·날짜) 연출이 없는 null 이 된다', () => {
    expect(imported(broken({ homeNew: { day: '2026-10-19', greeted: false, from: 9 } })).homeNew).toBeNull()
    expect(imported(broken({ homeNew: { day: 'nope', greeted: false, from: 1 } })).homeNew).toBeNull()
  })

  it('seenHints 는 내보내고 가져온 뒤에도 본 목록 그대로다', () => {
    expect(imported(exported({ seenHints: ['atm', 'hall'] })).seenHints).toEqual(['atm', 'hall'])
  })

  it('seenHints 의 모르는 값과 중복은 버린다', () => {
    expect(imported(broken({ seenHints: ['atm', 'nope', 'atm'] })).seenHints).toEqual(['atm'])
    expect(imported(broken({ seenHints: 'atm' })).seenHints).toEqual([])
  })

  it('weekMark 는 내보내고 가져온 뒤에도 같은 기준이다', () => {
    const mark = { day: '2026-10-18', stats: { fish: 2, bug: 1 }, tier: 1, houses: 0, recap: ['물고기 2마리'] }
    const got = imported(exported({ weekMark: mark as never }))
    expect(got.weekMark).toMatchObject({ day: '2026-10-18', tier: 1, houses: 0, recap: ['물고기 2마리'] })
    expect(got.weekMark?.stats.fish).toBe(2)
  })

  it('weekMark 가 잘못되면(단계 범위 밖) null 이 된다', () => {
    expect(imported(broken({ weekMark: { day: '2026-10-18', stats: {}, tier: 9, houses: 0, recap: [] } })).weekMark).toBeNull()
  })

  it('ledger(지난 7일 가계부)는 내보내고 가져온 뒤에도 같은 기록이다', () => {
    const ledger = [{ day: '2026-10-17', earned: 120, spent: 30 }, { day: '2026-10-18', earned: 0, spent: 4 }]
    expect(imported(exported({ ledger })).ledger).toEqual(ledger)
  })

  it('ledger 의 잘못된 칸은 버리고, 8일째 기록은 최근 7칸만 남긴다', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, earned: i, spent: 0 }))
    const out = imported(broken({ ledger: [...rows, { day: 'bad', earned: 1, spent: 1 }, { day: '2026-10-20', earned: -1, spent: 0 }] })).ledger
    expect(out).toHaveLength(7)
    expect(out?.[0].day).toBe('2026-10-02')
    expect(out?.every((r) => r.day !== 'bad' && r.day !== '2026-10-20')).toBe(true)
  })

  it('calendarOpenedDay 는 내보내고 가져온 뒤에도 같은 날이다', () => {
    expect(imported(exported({ calendarOpenedDay: '2026-10-30' })).calendarOpenedDay).toBe('2026-10-30')
  })

  it('calendarOpenedDay 의 잘못된 날짜는 아직 안 연 것(null)이 된다', () => {
    expect(imported(broken({ calendarOpenedDay: 'nope' })).calendarOpenedDay).toBeNull()
    expect(imported(broken({ calendarOpenedDay: 7 })).calendarOpenedDay).toBeNull()
  })

  it('pumpkinDone 은 내보내고 가져온 뒤에도 같은 목록이다', () => {
    expect(imported(exported({ pumpkinDone: ['2026-10-19:ghost'] })).pumpkinDone).toEqual(['2026-10-19:ghost'])
  })

  it('pumpkinDone 의 모르는 형식은 버린다', () => {
    expect(imported(broken({ pumpkinDone: ['x', 3, '2026-10-19:ghost'] })).pumpkinDone).toEqual(['2026-10-19:ghost'])
    expect(imported(broken({ pumpkinDone: 'ghost' })).pumpkinDone).toEqual([])
  })

  it('harvestFairDone 은 내보내고 가져온 뒤에도 같은 목록이다', () => {
    expect(imported(exported({ harvestFairDone: ['2026-10-17:basket'] })).harvestFairDone).toEqual(['2026-10-17:basket'])
  })

  it('harvestFairDone 의 모르는 형식은 버린다', () => {
    expect(imported(broken({ harvestFairDone: ['2026-10-17', 5, '2026-10-17:basket'] })).harvestFairDone).toEqual(['2026-10-17:basket'])
    expect(imported(broken({ harvestFairDone: { a: 1 } })).harvestFairDone).toEqual([])
  })

  it('shopLog 의 진열 날짜와 진열 목록(stockDay·stockSold)은 내보내고 가져온 뒤에도 같다', () => {
    const log = { sold: { peach: 3 }, monthly: '2026-10', stockDay: '2026-10-19', stockSold: ['peach', 'chair'] }
    const got = imported(exported({ shopLog: log as never })).shopLog
    expect(got).toMatchObject({ monthly: '2026-10', stockDay: '2026-10-19', stockSold: ['peach', 'chair'] })
    expect(got.sold.peach).toBe(3)
  })

  it('shopLog 의 잘못된 진열 날짜와 모르는 물건은 버린다', () => {
    const got = imported(broken({ shopLog: { sold: {}, monthly: null, stockDay: 'nope', stockSold: ['peach', 'no-such-item', 7] } })).shopLog
    expect(got.stockDay).toBeNull()
    expect(got.stockSold).toEqual(['peach'])
  })
})
