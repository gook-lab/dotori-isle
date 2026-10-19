import { describe, expect, it } from 'vitest'
import { gestureChat, pickChat, rememberTopic, TOPIC_IDS, withTic, type ChatContext, type TodayTalk } from './chat'
import { mulberry32 } from './rng'
import { VILLAGERS } from './villagers'

const base = (id: string, over: Partial<ChatContext> = {}): ChatContext => ({
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

describe('villager chat', () => {
  it('puts the speech tic before the final punctuation', () => {
    expect(withTic('날씨 좋다!', '냥')).toBe('날씨 좋다냥!')
    expect(withTic('그렇구나', ' 훗')).toBe('그렇구나 훗.')
    expect(withTic('놀자!', '~해줘!')).toBe('놀자~해줘!')
  })

  it('never repeats a recent topic while others are available', () => {
    const rng = mulberry32(3)
    let recent: string[] = []
    for (let i = 0; i < 30; i++) {
      const c = pickChat(base('mocha', { recent }), rng)
      // 화제 기억이 길어서 다 떨어지는 순간에는 되풀이를 허용하므로, 바로 앞의 네 화제만 본다
      expect(recent.slice(-4)).not.toContain(c.topic)
      recent = rememberTopic(recent, c.topic)
    }
    expect(recent.length).toBeLessThanOrEqual(12)
  })

  it('reacts to what you wear, hold and carry', () => {
    const seen = new Set<string>()
    const rng = mulberry32(8)
    for (let i = 0; i < 200; i++) seen.add(pickChat(base('bomi', { hat: 'straw-hat', tool: 'rod', pocket: ['sea-bass', 'peach'] }), rng).topic)
    for (const t of ['hat', 'tool', 'pocket-fish', 'pocket-fruit', 'gossip']) expect(seen).toContain(t)
    const hat = pickChat(base('bomi', { hat: 'straw-hat', recent: ['weather', 'season', 'time', 'tool', 'gossip', 'hobby', 'island'] }), mulberry32(1))
    if (hat.topic === 'hat') expect(hat.lines[0]).toContain('밀짚모자')
  })

  it('asks questions only when allowed, each answer has a reply in the villager voice', () => {
    const rng = mulberry32(5)
    let asked = 0
    for (let i = 0; i < 300; i++) {
      const c = pickChat(base('bori', { level: 2 }), rng)
      if (c.ask) {
        asked++
        expect(c.ask.options.length).toBeGreaterThanOrEqual(2)
        for (const o of c.ask.options) expect(o.reply).toContain('해줘')
      }
      expect(pickChat(base('bori', { level: 2, allowAsk: false }), rng).ask).toBeUndefined()
    }
    expect(asked).toBeGreaterThan(10)
  })

  it('talks about home only inside their house', () => {
    const rng = mulberry32(2)
    for (let i = 0; i < 100; i++) expect(pickChat(base('coco'), rng).topic).not.toBe('home')
    expect(pickChat(base('coco', { home: true }), mulberry32(4)).topic).toBeTypeOf('string')
  })

  it('shout and tiny villagers chat with gestures', () => {
    const c = gestureChat(base('yuja', { hat: 'cap' }), mulberry32(1), ['얍!'])
    expect(c.lines[0]).toMatch(/^\(.+\) 얍!$/)
  })
})

describe('chat punctuation', () => {
  it('keeps question marks and never doubles punctuation', () => {
    expect(withTic('아침이 좋아, 밤이 좋아?', '~')).toBe('아침이 좋아, 밤이 좋아~?')
    expect(withTic('또 왔네? 심심했구나', '~해줘!')).toBe('또 왔네? 심심했구나~해줘!')
    expect(withTic('너랑 이야기하는 게 제일 좋아!', '~해줘!')).not.toMatch(/!!$/)
  })
})

describe('today talk in villager chat', () => {
  const TODAY: TodayTalk = {
    shop: { closed: false, sale: '달빛 등' },
    broadcast: '오늘은 장날이에요. 광장에 장이 서요.',
    songiHigh: true,
    story: { no: 2, title: '이웃 맞이' },
    bottle: true,
    storyDone: true,
    weekQuote: '물고기 3마리를 낚았어요.',
    pumpkin: true,
    harvest: true,
    birthday: true,
  }
  const TODAY_IDS = ['shop-today', 'broadcast-today', 'songi-today', 'story-today', 'bottle-today', 'story-done', 'week-recap', 'pumpkin-night', 'harvest-today', 'birthday-talk']
  // 성격 6종을 모두 덮는 주민. 말투가 성격마다 다른지 본다.
  const VOICES = ['mocha', 'bomi', 'pengdol', 'guriguri', 'dongri', 'bori']

  it('shows today talk only when the matching fact is there', () => {
    const seen = new Set<string>()
    const rng = mulberry32(21)
    for (let i = 0; i < 300; i++) seen.add(pickChat(base('bomi', { today: {} }), rng).topic)
    for (const id of TODAY_IDS) expect(seen).not.toContain(id)
  })

  it('gives every today topic at least two lines in each personality', () => {
    for (const id of TODAY_IDS) {
      for (const who of VOICES) {
        const others = TOPIC_IDS.filter((t) => t !== id)
        const c = base(who, { today: TODAY, recent: others, allowAsk: false })
        const chat = pickChat(c, mulberry32(5))
        expect(chat.topic).toBe(id)
        expect(chat.lines.length).toBeGreaterThanOrEqual(2)
        expect(chat.lines.every((l) => l.length > 0)).toBe(true)
      }
    }
  })

  it('speaks the closed-shop gossip and the sale name in the villager voice', () => {
    const closed = pickChat(base('bori', { today: { shop: { closed: true, sale: null } }, recent: TOPIC_IDS.filter((t) => t !== 'shop-today'), allowAsk: false }), mulberry32(2))
    expect(closed.lines.join(' ')).toContain('공사')
    const open = pickChat(base('mocha', { today: { shop: { closed: false, sale: '달빛 등' } }, recent: TOPIC_IDS.filter((t) => t !== 'shop-today'), allowAsk: false }), mulberry32(2))
    expect(open.lines.join(' ')).toContain('달빛 등')
  })

  it('gestures for today news in the voiced villagers, with a 해요체 narration', () => {
    const closed = base('yuja', { today: { shop: { closed: true, sale: null }, broadcast: '장날이에요', story: { no: 1, title: '섬에 오다' }, bottle: true } })
    const texts = new Set<string>()
    const rng = mulberry32(12)
    for (let i = 0; i < 300; i++) texts.add(gestureChat(closed, rng, ['얍!']).lines[0])
    const all = [...texts].join('\n')
    expect(all).toContain('망치로 두드리는 흉내를 내요')
    expect(all).toContain('귀를 쫑긋 세우고 고개를 기울여요')
    expect(all).toContain('주먹을 꽉 쥐고 힘내라는 몸짓을 해요')
    expect(all).toContain('바다 쪽을 손가락으로 가리켜요')
  })

  it('keeps the no-repeat rule for today topics', () => {
    let recent: string[] = []
    const rng = mulberry32(44)
    for (let i = 0; i < 20; i++) {
      const c = pickChat(base('dongri', { today: TODAY, recent, allowAsk: false }), rng)
      if (recent.length < TOPIC_IDS.length - 1) expect(recent).not.toContain(c.topic)
      recent = rememberTopic(recent, c.topic)
    }
  })
})

describe('증축된 이웃 집 포치 화제', () => {
  const island = { wallpaper: false, set: false, ledger: false, stairs: false, facility: false }
  const talksAbout = (c: ChatContext) => Array.from({ length: 80 }, (_, i) => pickChat(c, mulberry32(i + 1)).lines.join(' '))
  const hasPorch = (text: string) => text.includes('차양')

  it('주인은 자기 집 포치 얘기를 하지 않는다', () => {
    const c = base('mocha', { island: { ...island, porch: [{ id: 'mocha', name: '모카' }] } })
    expect(talksAbout(c).some(hasPorch)).toBe(false)
  })

  it('다른 주민은 증축된 이웃 집 포치 얘기를 한다', () => {
    const c = base('bomi', { island: { ...island, porch: [{ id: 'mocha', name: '모카' }] } })
    const texts = talksAbout(c)
    expect(texts.some(hasPorch)).toBe(true)
    expect(texts.some((t) => t.includes('모카가') && hasPorch(t))).toBe(true)
  })

  it('여러 채면 말하는 주민 자신의 집은 빼고 다음 집을 고른다', () => {
    const c = base('mocha', { island: { ...island, porch: [{ id: 'mocha', name: '모카' }, { id: 'bomi', name: '봄이' }] } })
    const texts = talksAbout(c)
    expect(texts.some((t) => t.includes('봄이가') && hasPorch(t))).toBe(true)
    expect(texts.some((t) => t.includes('모카가') && hasPorch(t))).toBe(false)
  })
})
