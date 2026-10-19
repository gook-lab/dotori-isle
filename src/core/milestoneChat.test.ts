import { describe, expect, it } from 'vitest'
import { pickChat, type ChatContext } from './chat'
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

describe('경제 이정표 수다: 말 거는 흐름', () => {
  it('그날 처음 말을 거는 주민에게 이정표가 있으면 이정표 수다를 한다', () => {
    const c = pickChat(base('mocha', { milestoneDue: true, today: { milestone: { kind: 'loan-paid', day: '2026-10-19' } } }), mulberry32(4))
    expect(c.topic).toBe('milestone-talk')
    // 대사 줄은 말투 꼬리(withTic)가 붙으므로 대사 속 핵심 단어로 확인한다
    expect(c.lines.join(' ')).toMatch(/빚|갚|편하|축하|잘했/)
  })

  it('같은 날 두 번째 대화에는 이정표 수다를 강제로 하지 않는다', () => {
    const c = pickChat(base('mocha', { milestoneDue: false, today: { milestone: { kind: 'loan-paid', day: '2026-10-19' } } }), mulberry32(4))
    expect(c.topic).not.toBe('milestone-talk')
  })

  it('이정표가 없으면 이정표 수다는 뽑히지 않는다', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = pickChat(base('mocha', { milestoneDue: true }), mulberry32(seed))
      expect(c.topic).not.toBe('milestone-talk')
    }
  })
})
