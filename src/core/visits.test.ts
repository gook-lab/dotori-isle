import { describe, expect, it } from 'vitest'
import type { Placed } from './placement'
import { interiorComment, pickSpot, visitGreeting, visitorFor, visitPhase, VISIT_TOTAL, VISIT_WALK, VISIT_USE } from './visits'
import { mulberry32 } from './rng'

const placed = (itemId: string, id = itemId): Placed => ({ id, itemId, x: 1, z: -2, rot: 0 })

describe('방문 날 정하기', () => {
  it('같은 날은 언제나 같은 결과다', () => {
    expect(visitorFor('2026-10-19', ['bomi', 'mocha'])).toBe(visitorFor('2026-10-19', ['bomi', 'mocha']))
  })

  it('이사 온 주민이 없으면 방문하지 않는다', () => {
    for (let d = 1; d <= 60; d++) expect(visitorFor(`2026-10-${String(d).padStart(2, '0')}`, [])).toBeNull()
  })

  it('일 년 동안 대략 일주일에 한 번꼴로 온다', () => {
    const residents = ['bomi', 'mocha', 'pengdol']
    let count = 0
    for (let d = 0; d < 364; d++) {
      const day = new Date(2026, 0, 1 + d)
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      const who = visitorFor(key, residents)
      if (who) {
        count++
        expect(residents).toContain(who)
      }
    }
    expect(count).toBeGreaterThan(30)
    expect(count).toBeLessThan(80)
  })
})

describe('방문객이 쓸 가구', () => {
  it('쓸 수 있는 가구만 고르고, 불빛과 우체통은 고르지 않는다', () => {
    const room = [placed('lamp', 'a'), placed('mailbox', 'b'), placed('chair', 'c')]
    for (let i = 0; i < 20; i++) {
      const s = pickSpot(room, mulberry32(i))
      expect(s?.id).toBe('c')
      expect(s?.use).toBe('sit')
    }
  })

  it('쓸 게 없으면 null', () => {
    expect(pickSpot([placed('lamp')], mulberry32(1))).toBeNull()
    expect(pickSpot([], mulberry32(1))).toBeNull()
  })

  it('같은 씨앗이면 같은 가구를 고른다', () => {
    const room = [placed('chair', 'a'), placed('flowerpot', 'b'), placed('telescope', 'c')]
    expect(pickSpot(room, mulberry32(9))).toEqual(pickSpot(room, mulberry32(9)))
  })

  it('인사말에는 이름과 가구 쓰임이 들어간다', () => {
    const spot = pickSpot([placed('chair', 'a')], mulberry32(1))
    expect(visitGreeting('보미', spot)).toContain('보미')
    expect(visitGreeting('보미', spot)).toContain('나무 의자')
    expect(visitGreeting('보미', null)).toContain('집들이')
  })
})

describe('나갈 때 한마디', () => {
  it('빈 방은 가구를 놓으라고 한다', () => {
    expect(interiorComment('보미', [])).toContain('텅 비었')
  })

  it('불빛이나 화분이 있으면 그 분위기로 말한다', () => {
    expect(interiorComment('보미', [placed('campfire')])).toContain('따뜻')
    expect(interiorComment('보미', [placed('flowerpot')])).toContain('화분')
    expect(interiorComment('보미', [placed('telescope')])).toContain('창가')
  })

  it('가구가 많으면 풍성하다고 하고, 적으면 소박하다고 한다', () => {
    const many = Array.from({ length: 6 }, (_, i) => placed('chair', `c${i}`))
    expect(interiorComment('보미', many)).toContain('풍성')
    expect(interiorComment('보미', [placed('chair')])).toContain('소박')
  })
})

describe('방문 단계', () => {
  const spot = pickSpot([placed('chair', 'a')], mulberry32(1))
  it('들어오기, 쓰기, 나가기 순서로 흐르고 끝나면 done', () => {
    expect(visitPhase(0, spot)).toBe('walk-in')
    expect(visitPhase(VISIT_WALK + 0.5, spot)).toBe('use')
    expect(visitPhase(VISIT_WALK + VISIT_USE + 0.5, spot)).toBe('walk-out')
    expect(visitPhase(VISIT_TOTAL, spot)).toBe('done')
  })

  it('쓸 가구가 없으면 쓰는 단계 없이 바로 나간다', () => {
    expect(visitPhase(VISIT_WALK + 1, null)).toBe('walk-out')
    expect(visitPhase(VISIT_WALK * 2, null)).toBe('done')
  })
})
