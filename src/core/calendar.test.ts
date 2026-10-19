import { describe, expect, it } from 'vitest'
import { birthdayOf } from './birthdays'
import { eventsOn, monthCells, shiftMonth, tomorrowAlert, tomorrowLine, upcomingEvents, yearMonthOf, type CalendarCtx } from './calendar'
import { FESTIVALS, FESTIVAL_DAY } from './festivals'
import { isMeteorNight } from './skyEvents'
import { seasonOfMonth } from './season'
import { VILLAGERS } from './villagers'

const base = (over: Partial<CalendarCtx> = {}): CalendarCtx => ({
  today: '2026-03-15',
  weatherOn: () => 'cloudy',
  villagers: [],
  moveTalk: null,
  arrivals: [],
  outLetters: [],
  ...over,
})

describe('달력 칸', () => {
  it('2026년 3월은 일요일에 시작하고 7열로 맞춘다', () => {
    const cells = monthCells(2026, 3)
    expect(cells[0]).toBe('2026-03-01') // 2026-03-01 은 일요일
    expect(cells.length % 7).toBe(0)
    expect(cells.filter((c) => c !== null)).toHaveLength(31)
  })

  it('달 밖의 칸은 비어 있다', () => {
    const cells = monthCells(2026, 2) // 2026-02-01 은 일요일
    expect(cells[0]).toBe('2026-02-01')
    expect(cells.filter((c) => c !== null)).toHaveLength(28)
  })

  it('달은 앞뒤로 넘기고 연도도 넘긴다', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(yearMonthOf('2026-10-19')).toEqual({ year: 2026, month: 10 })
  })
})

describe('그날의 일정', () => {
  it('축제 날에는 축제 아이콘이 붙는다', () => {
    const f = FESTIVALS[seasonOfMonth(3)]
    const day = `2026-${String(f.month).padStart(2, '0')}-${String(FESTIVAL_DAY).padStart(2, '0')}`
    const ev = eventsOn(day, base())
    expect(ev.some((e) => e.kind === 'festival')).toBe(true)
  })

  it('일요일에는 낚시 대회가 열리고, 토요일에는 장날이다', () => {
    expect(eventsOn('2026-03-15', base()).some((e) => e.kind === 'tourney')).toBe(true)
    expect(eventsOn('2026-03-21', base()).some((e) => e.kind === 'market')).toBe(true)
    expect(eventsOn('2026-03-16', base()).some((e) => e.kind === 'tourney' || e.kind === 'market')).toBe(false)
  })

  it('별똥별은 실제 별똥별 밤만, 오늘부터 일주일 안은 예보로 보여 준다', () => {
    const sunnyDays = Array.from({ length: 40 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`).filter((d) => d.startsWith('2026-03') && isMeteorNight(d, 'sunny'))
    const near = sunnyDays.find((d) => d >= '2026-03-15' && d <= '2026-03-21')
    const far = sunnyDays.find((d) => d > '2026-03-21')
    const sunny = base({ weatherOn: () => 'sunny' })
    if (near) expect(eventsOn(near, sunny).find((e) => e.kind === 'sky')?.label).toContain('예보')
    if (far) expect(eventsOn(far, sunny).some((e) => e.kind === 'sky')).toBe(false)
    // 맑지 않은 날에는 별똥별이 없다
    expect(eventsOn('2026-03-16', base({ weatherOn: () => 'rain' })).some((e) => e.kind === 'sky')).toBe(false)
  })

  it('생일인 주민의 날에는 생일 아이콘이 붙는다', () => {
    const v = VILLAGERS[0]
    const b = birthdayOf(v.id)
    const day = `2026-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
    expect(eventsOn(day, base({ villagers: [v] })).some((e) => e.kind === 'birthday')).toBe(true)
  })

  it('이사 날과 손님이 오는 날, 답장 예정일을 보여 준다', () => {
    const ev = eventsOn('2026-03-19', base({ moveTalk: { id: 'sora', since: '2026-03-16' }, arrivals: [{ id: 'toto', day: '2026-03-19' }], nameOf: (id) => id }))
    expect(ev.filter((e) => e.kind === 'moving')).toHaveLength(2)
    const reply = eventsOn('2026-03-20', base({ outLetters: [{ id: 'o', to: 'mocha', day: '2026-03-16', text: 't', paper: 'kraft', gift: null, replyDay: '2026-03-20', replyText: 'r', replied: false, acked: false }], nameOf: () => '모카' }))
    expect(reply.some((e) => e.kind === 'reply' && e.label.includes('모카'))).toBe(true)
  })

  it('아무 일도 없는 날은 빈 목록이다', () => {
    expect(eventsOn('2026-03-16', base())).toEqual([])
  })
})

describe('앞으로 며칠의 일정(upcomingEvents)', () => {
  it('오늘부터 n일 안의 일정을 날짜순으로 모으고, 일정 없는 날은 뺀다', () => {
    // 2026-03-15 은 일요일(낚시 대회·송이), 03-21 은 토요일(장날), 03-22 는 일요일이다
    const list = upcomingEvents('2026-03-15', 10, base())
    expect(list.map((d) => d.day)).toEqual(['2026-03-15', '2026-03-21', '2026-03-22'])
    expect(list[0].events.some((e) => e.kind === 'tourney')).toBe(true)
    expect(list[1].events.some((e) => e.kind === 'market')).toBe(true)
  })

  it('지난 날은 넣지 않고, 기간은 n일이다(n 번째 날은 포함하지 않는다)', () => {
    // n 일이면 오늘을 포함해 n 칸을 본다. 03-16 부터 5일은 03-20 까지라 장날(03-21)은 빠진다
    const list = upcomingEvents('2026-03-16', 5, base())
    expect(list.every((d) => d.day >= '2026-03-16')).toBe(true)
    expect(list).toEqual([])
    expect(upcomingEvents('2026-03-16', 6, base()).map((d) => d.day)).toEqual(['2026-03-21'])
    expect(upcomingEvents('2026-03-15', 1, base()).map((d) => d.day)).toEqual(['2026-03-15'])
  })

  it('30일 안에서 호박 등불 밤과 도토리 감사 장날, 송이 상인 날을 모두 찾는다', () => {
    // 10-20 부터 30일이면 10-31 호박 등불 밤과 일요일 송이, 토요일 장이 모두 안에 든다
    const list = upcomingEvents('2026-10-20', 30, base())
    const kinds = new Set(list.flatMap((d) => d.events.map((e) => e.kind)))
    expect(kinds.has('pumpkin')).toBe(true)
    expect(kinds.has('songi')).toBe(true)
    expect(kinds.has('market')).toBe(true)
    expect(list.find((d) => d.day === '2026-10-31')?.events.some((e) => e.kind === 'pumpkin')).toBe(true)
    expect(list.every((d, i, all) => i === 0 || all[i - 1].day < d.day)).toBe(true)
  })

  it('일정이 하나도 없으면 빈 목록이다', () => {
    expect(upcomingEvents('2026-03-16', 1, base())).toEqual([])
  })

  it('주민 생일도 기간 안에서 잡힌다', () => {
    const v = VILLAGERS[0]
    const md = birthdayOf(v.id)
    const bd = `2026-${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`
    const list = upcomingEvents(bd, 1, base({ villagers: VILLAGERS }))
    expect(list[0]?.events.some((e) => e.kind === 'birthday' && e.label.includes(v.name))).toBe(true)
  })
})

describe('행사 설명과 내일 알림', () => {
  it('every event has a name and a one-line note', () => {
    const list = upcomingEvents('2026-10-01', 60, base({ villagers: VILLAGERS }))
    const all = list.flatMap((d) => d.events)
    expect(all.length).toBeGreaterThan(0)
    for (const e of all) {
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.note.length).toBeGreaterThan(8)
    }
  })

  it('장날 설명은 떠돌이 상인과 그날만 파는 물건을 말한다', () => {
    const market = eventsOn('2026-03-21', base()).find((e) => e.kind === 'market')
    expect(market?.note).toContain('떠돌이 상인')
    expect(market?.note).toContain('그날만')
  })

  it('저녁 18시 전에는 내일 알림이 없다', () => {
    expect(tomorrowAlert('2026-10-30', 17, base())).toBeNull()
  })

  it('저녁 18시 이후 내일 행사가 있으면 첫 행사 이름과 개수를 준다', () => {
    // 2026-10-30 저녁: 내일(10-31) 호박 등불 밤
    const a = tomorrowAlert('2026-10-30', 18, base())
    expect(a?.name).toBe('호박 등불 밤')
    expect(a?.count).toBeGreaterThanOrEqual(1)
  })

  it('내일 알림 문장은 받침에 따라 이/가를 고른다', () => {
    expect(tomorrowLine('호박 등불 밤')).toBe('내일 호박 등불 밤이 있어요')
    expect(tomorrowLine('낚시 대회')).toBe('내일 낚시 대회가 있어요')
    expect(tomorrowLine('송이 상인')).toBe('내일 송이 상인이 있어요')
  })

  it('내일 행사가 없으면 알림이 없다', () => {
    expect(tomorrowAlert('2026-03-16', 20, base())).toBeNull()
  })
})
