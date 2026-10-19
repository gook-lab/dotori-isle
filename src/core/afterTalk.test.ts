import { describe, expect, it } from 'vitest'
import { pickChat, type ChatContext } from './chat'
import { afterKindOf, afterTalkKey, afterTalkLines, AFTER_TALK_KEEP, cleanAfterDays, cleanAfterTalkDone } from './afterTalk'
import { mulberry32 } from './rng'
import { VILLAGERS } from './villagers'

const PERSONALITIES = ['cheery', 'shy', 'cool', 'lazy', 'sporty', 'grumpy'] as const
const KEYS = ['home-stars:2', 'shop-tier:3', 'dex:50', 'island-stars:5']

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

describe('섬 이야기 이후 목표 이야기: 대사', () => {
  it('목표 종류마다 성격별 두 줄이 있고, 숫자 자리는 목표 숫자로 채운다', () => {
    for (const key of KEYS) {
      for (const p of PERSONALITIES) {
        const lines = afterTalkLines(p, key)
        expect(lines, `${key} ${p}`).toHaveLength(2)
        for (const l of lines) expect(l).not.toContain('{n}')
      }
    }
    expect(afterTalkLines('cheery', 'dex:50').join(' ')).toContain('50종')
    expect(afterTalkLines('cheery', 'home-stars:2').join(' ')).toContain('별 2개')
    expect(afterKindOf('island-stars:5')).toBe('island-stars')
  })

  it('목표 이야기는 채운 날과 그다음 날에만 고른다', () => {
    const reached = { 'dex:50': '2026-10-19' }
    expect(afterTalkKey(reached, [], '2026-10-18')).toBeNull()
    expect(afterTalkKey(reached, [], '2026-10-19')).toBe('dex:50')
    expect(afterTalkKey(reached, [], '2026-10-20')).toBe('dex:50')
    expect(afterTalkKey(reached, [], '2026-10-21')).toBeNull()
  })

  it('한 번 꺼낸 목표는 다시 고르지 않고, 여러 개면 먼저 채운 것부터 고른다', () => {
    const reached = { 'dex:50': '2026-10-19', 'island-stars:5': '2026-10-19', 'home-stars:2': '2026-10-18' }
    expect(afterTalkKey(reached, [], '2026-10-19')).toBe('home-stars:2')
    expect(afterTalkKey(reached, ['home-stars:2'], '2026-10-19')).toBe('dex:50')
    expect(afterTalkKey(reached, ['home-stars:2', 'dex:50', 'island-stars:5'], '2026-10-19')).toBeNull()
  })

  it('오늘 말을 거는 첫 주민이 고르면 그 주민이 목표 이야기를 한다(화제 기억과 상관없이)', () => {
    const c = pickChat(base('mocha', { afterDue: 'dex:50', recent: ['weather-today', 'fish-talk'] }), mulberry32(4))
    expect(c.topic).toBe('after-milestone')
    expect(c.lines.join(' ')).toContain('50종')
  })

  it('목표 이야기가 없으면 평소 화제를 고른다', () => {
    const c = pickChat(base('mocha'), mulberry32(4))
    expect(c.topic).not.toBe('after-milestone')
  })
})

describe('섬 이야기 이후 목표 이야기: 저장값 검증', () => {
  it('채운 날 맵은 목표 키와 날짜 꼴만 남기고 최근 것만 남긴다', () => {
    expect(cleanAfterDays({ 'dex:50': '2026-10-19', 'dex:999': '2026-10-19', 'shop-tier:3': 'soon', 'island-stars:5': '2026-11-01' })).toEqual({
      'dex:50': '2026-10-19',
      'island-stars:5': '2026-11-01',
    })
    expect(cleanAfterDays([1, 2])).toEqual({})
    expect(cleanAfterDays(undefined)).toEqual({})
    const many = Object.fromEntries(Array.from({ length: AFTER_TALK_KEEP + 3 }, (_, i) => [`home-stars:${(i % 5) + 1}`, `2026-10-${String(i + 1).padStart(2, '0')}`]))
    expect(Object.keys(cleanAfterDays(many)).length).toBeLessThanOrEqual(AFTER_TALK_KEEP)
  })

  it('이야기를 끝낸 키 목록은 목표 키만 남기고 중복을 없앤다', () => {
    expect(cleanAfterTalkDone(['dex:50', 'dex:50', 'bogus', 3])).toEqual(['dex:50'])
    expect(cleanAfterTalkDone(undefined)).toEqual([])
  })
})
