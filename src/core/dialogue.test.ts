import { describe, expect, it } from 'vitest'
import { gestureChat, GOSSIP, pickChat, rememberTopic, type ChatContext } from './chat'
import { dayPart } from './clock'
import { GUESTS, guestTalk } from './guests'
import { morningLetter } from './letters'
import { mulberry32 } from './rng'
import type { Season } from './season'
import { dailyRequest, talkLines, VILLAGERS } from './villagers'
import type { Weather } from './weather'

const WEATHERS: Weather[] = ['sunny', 'cloudy', 'rain', 'snow']
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
const PARTS = ['dawn', 'morning', 'day', 'evening', 'night'] as const
const MAX_LEN = 38

const ctxFor = (id: string, over: Partial<ChatContext> = {}): ChatContext => ({
  v: VILLAGERS.find((v) => v.id === id)!,
  hour: 14,
  part: 'day',
  weather: 'sunny',
  season: 'autumn',
  level: 1,
  hat: null,
  outfit: 'shirt-sky',
  tool: 'hand',
  pocket: [],
  home: false,
  others: [{ id: 'yuja', name: '유자' }],
  recent: [],
  ...over,
})

/** 모든 주민의 모든 대화 상황에서 나올 수 있는 말을 모은다. */
function everySpeech(): { speech: { who: string; line: string }[]; letters: { who: string; line: string }[] } {
  const out: { who: string; line: string }[] = []
  const letters: { who: string; line: string }[] = []
  const rng = mulberry32(42)
  for (const v of VILLAGERS) {
    for (const part of PARTS) {
      for (const level of [0, 1, 2, 3]) {
        for (const firstToday of [true, false]) {
          for (const nth of [1, 2, 3, 4, 5]) {
            const request = 'peach'
            for (const [hasItem, requestDone] of [[false, false], [true, false], [false, true]] as const) {
              for (const points of [0, 50, 90]) {
                talkLines(v, { firstToday, level, night: part === 'night', part, points, request, requestDone, hasItem, nth }).forEach((line) => out.push({ who: v.name, line }))
              }
            }
          }
        }
      }
    }
    for (let i = 0; i < 120; i++) {
      const c = ctxFor(v.id, {
        part: PARTS[i % PARTS.length],
        weather: WEATHERS[i % WEATHERS.length],
        season: SEASONS[Math.floor(i / 4) % SEASONS.length],
        level: i % 4,
        hat: i % 3 === 0 ? 'straw-hat' : null,
        tool: i % 2 ? 'rod' : 'hand',
        pocket: i % 5 === 0 ? ['sea-bass', 'peach'] : [],
        home: i % 6 === 0,
        others: VILLAGERS.slice(0, 3).map((o) => ({ id: o.id, name: o.name })),
        recent: [],
        allowAsk: i % 7 !== 0,
      })
      const chat = v.voice ? gestureChat(c, rng, ['얍!', '와…!']) : pickChat(c, rng)
      chat.lines.forEach((line) => out.push({ who: v.name, line }))
      chat.ask?.options.forEach((o) => out.push({ who: v.name, line: o.reply }))
    }
  }
  for (const g of GUESTS) {
    for (let nth = 1; nth <= 90; nth++) {
      for (const [invited, waiting] of [[false, null], [false, '소라'], [true, null]] as const) {
        const t = guestTalk(g, { nth, invited, waiting, day: `2026-10-${String((nth % 28) + 1).padStart(2, '0')}` })
        t.lines.forEach((line) => out.push({ who: g.name, line }))
      }
    }
  }
  for (const day of ['2026-10-18', '2026-07-01', '2026-01-15', '2026-04-09', '2026-11-30']) {
    for (const w of WEATHERS) {
      for (let i = 0; i < 20; i++) {
        const friendship: Record<string, number> = Object.fromEntries(VILLAGERS.map((v) => [v.id, 1 + i]))
        const houses = i % 2 ? [] : VILLAGERS.map((v) => v.id)
        const l = morningLetter(`${day}-${i}`, friendship, { houses, recruits: GUESTS.map((g) => g.id) }, w)
        if (l) letters.push({ who: l.fromName, line: l.text })
      }
    }
  }
  return { speech: out, letters }
}

describe('대사 형식', () => {
  const { speech, letters } = everySpeech()

  it('모든 대사와 편지는 쓰레기 문자열이 없고 문장부호가 어긋나지 않는다', () => {
    expect(speech.length).toBeGreaterThan(1000)
    const bad = [...speech, ...letters].filter(({ line }) => /undefined|NaN|\.\.|!\.|\?\.|~\.|  |\[object/.test(line))
    expect(bad.map((b) => `${b.who}: ${b.line}`)).toEqual([])
  })

  it(`말풍선 대사 한 줄은 ${MAX_LEN}자를 넘지 않는다(편지는 제외)`, () => {
    const long = speech.filter(({ line }) => [...line].length > MAX_LEN)
    expect(long.map((b) => `${b.who}: ${b.line} (${[...b.line].length})`)).toEqual([])
  })

  it('공백으로 시작하는 말끝 버릇은 질문에 붙지 않는다', () => {
    const bad: string[] = []
    for (const v of VILLAGERS.filter((x) => x.tic.startsWith(' '))) {
      for (let i = 0; i < 60; i++) {
        const c = pickChat(ctxFor(v.id, { level: 2, part: PARTS[i % 5], weather: WEATHERS[i % 4], allowAsk: false }), mulberry32(i))
        c.lines.filter((l) => l.endsWith('?') && l.endsWith(`${v.tic.trim()}?`)).forEach((l) => bad.push(l))
      }
      if (GUESTS.includes(v)) {
        for (let nth = 1; nth <= 30; nth++) {
          guestTalk(v, { nth, invited: false, waiting: null, day: '2026-10-18' }).lines.filter((l) => l.endsWith(`${v.tic.trim()}?`)).forEach((l) => bad.push(l))
        }
      }
    }
    expect(bad).toEqual([])
  })
})

describe('손님 대사 다양성', () => {
  it('손님마다 대화 30번 동안 서로 다른 줄이 12개 이상 나온다', () => {
    for (const g of GUESTS) {
      const seen = new Set<string>()
      for (let nth = 1; nth <= 30; nth++) guestTalk(g, { nth, invited: false, waiting: null, day: '2026-10-18' }).lines.forEach((l) => seen.add(l))
      expect(seen.size, g.name).toBeGreaterThanOrEqual(12)
    }
  })

  it('대화가 쌓여도 같은 질문만 되풀이하지 않는다(50번째와 90번째 대화)', () => {
    for (const g of GUESTS) {
      const seen = new Set<string>()
      for (let nth = 31; nth <= 90; nth++) guestTalk(g, { nth, invited: false, waiting: null, day: '2026-10-18' }).lines.forEach((l) => seen.add(l))
      expect(seen.size, g.name).toBeGreaterThanOrEqual(20)
    }
  })

  it('같은 순번이라도 날짜가 다르면 줄이 달라진다', () => {
    const g = GUESTS[0]
    const a = guestTalk(g, { nth: 2, invited: false, waiting: null, day: '2026-10-18' }).lines
    const b = guestTalk(g, { nth: 2, invited: false, waiting: null, day: '2026-10-19' }).lines
    expect(a).not.toEqual(b)
  })
})

describe('편지 날씨', () => {
  it('비 오는 날에만 달팽이 이야기를, 맑은 날엔 쓰지 않는다', () => {
    const friendship = Object.fromEntries(VILLAGERS.map((v) => [v.id, 5]))
    const texts = (w: Weather) => {
      const out: string[] = []
      for (let i = 0; i < 200; i++) out.push(morningLetter(`2026-03-${i}`, friendship, { houses: [], recruits: [] }, w)!.text)
      return out
    }
    expect(texts('rain').some((t) => t.includes('달팽이'))).toBe(true)
    for (const w of ['sunny', 'cloudy', 'snow'] as Weather[]) expect(texts(w).some((t) => t.includes('달팽이'))).toBe(false)
    for (const w of ['rain', 'snow'] as Weather[]) expect(texts(w).some((t) => t.includes('바닷바람'))).toBe(false)
    expect(texts('snow').some((t) => t.includes('눈'))).toBe(true)
  })
})

describe('말투 세부', () => {
  it('마을 소문은 주민 이름과 맞는다', () => {
    for (const v of VILLAGERS) {
      if (GOSSIP[v.id]) expect(GOSSIP[v.id], v.id).toContain(v.name)
    }
    expect(GOSSIP.pengdol).not.toContain('펭돌이')
  })

  it('저녁 인사는 밤 인사와 섞이지 않는다(19시는 저녁)', () => {
    expect(dayPart(19)).toBe('evening')
    const evening = talkLines(VILLAGERS[0], { firstToday: true, level: 1, night: false, part: 'evening', request: 'peach', requestDone: false, hasItem: false, nth: 1 })
    expect(evening[0]).not.toContain('별이')
    const night = talkLines(VILLAGERS[0], { firstToday: true, level: 1, night: true, part: 'night', request: 'peach', requestDone: false, hasItem: false, nth: 1 })
    expect(night[0]).toContain('별이')
  })

  it('이미 대답한 질문은 같은 날 다시 묻지 않는다', () => {
    const asks = ['ask-time', 'ask-season', 'ask-catch']
    for (let i = 0; i < 50; i++) {
      const c = pickChat(ctxFor('bori', { level: 2, answered: asks }), mulberry32(i))
      expect(c.ask).toBeUndefined()
    }
  })

  it('질문 한 줄은 짧다', () => {
    for (let i = 0; i < 200; i++) {
      const c = pickChat(ctxFor('mocha', { level: 2, recent: [] }), mulberry32(i))
      if (c.ask) expect([...c.lines[c.lines.length - 1]].length).toBeLessThanOrEqual(30)
    }
  })
})

describe('소리로 말하는 주민 다양성', () => {
  // 게임(store)이 gestureChat 에 넘기는 소리 목록과 같다.
  const SOUNDS: Record<string, string[]> = {
    yuja: ['얍!', '와햐!', '헤에?!', '얍얍!'],
    somi: ['와…!', '이야…', '…훗?', '흐에…'],
  }
  const HOURS = [2, 6, 9, 13, 18, 21]
  const POCKETS: string[][] = [[], ['sea-bass'], ['cabbage-white'], ['peach'], ['sea-bass', 'peach']]

  /** 90번 대화를 날짜·시각·날씨·계절·친한 정도·주머니를 바꿔 가며 돌려 본 줄 모음 */
  function simulateVoiceTalks(id: string): Set<string> {
    const v = VILLAGERS.find((x) => x.id === id)!
    const seen = new Set<string>()
    let recent: string[] = []
    for (let n = 1; n <= 90; n++) {
      const day = `2026-${String(1 + (n % 12)).padStart(2, '0')}-${String(1 + (n % 27)).padStart(2, '0')}`
      const hour = HOURS[n % HOURS.length]
      const part = dayPart(hour)
      const level = n < 10 ? 0 : n < 40 ? 1 : n < 70 ? 2 : 3
      const request = dailyRequest(v.id, day)
      const hasItem = n % 5 === 0
      const requestDone = !hasItem && n % 7 === 0
      const hello = talkLines(v, { firstToday: n % 3 === 1, level, night: part === 'night', part, points: [0, 30, 60, 95][level], request, requestDone, hasItem, nth: n })
      const chat = gestureChat(
        {
          v, hour, part, weather: WEATHERS[n % 4], season: SEASONS[Math.floor(n / 23) % 4], level,
          hat: n % 3 === 0 ? 'straw-hat' : null, outfit: 'shirt-sky', tool: n % 2 ? 'rod' : 'hand',
          pocket: POCKETS[n % POCKETS.length], home: n % 6 === 0, others: [], recent,
        },
        mulberry32(n),
        SOUNDS[id],
      )
      recent = rememberTopic(recent, chat.topic)
      ;[...hello, ...chat.lines].forEach((line) => seen.add(line))
    }
    return seen
  }

  for (const id of ['somi', 'yuja']) {
    it(`${id} 는 대화 90번 동안 서로 다른 줄이 45개 이상 나온다`, () => {
      const seen = simulateVoiceTalks(id)
      expect(seen.size, id).toBeGreaterThanOrEqual(45)
      const bad = [...seen].filter((l) => [...l].length > MAX_LEN || /undefined|NaN|\.\.|!\.|\?\.|~\.|  |\[object/.test(l))
      expect(bad, id).toEqual([])
    })
  }
})
