import { describe, expect, it } from 'vitest'
import { HOUSE_HELLO, HOUSE_TOPIC, talkLines, VILLAGERS } from './villagers'

const v = VILLAGERS[0]
const base = { firstToday: true, level: 1, night: true, request: 'chair', requestDone: false, hasItem: false, nth: 0, points: 10 }
const core = (line: string) => line.replace(/[.!?…]+$/, '')

describe('집 안에서 나누는 말', () => {
  it('밤에 집 안에서 말을 걸면 집 인사와 방 가구 화제 한 줄을 먼저 한다', () => {
    const lines = talkLines(v, { ...base, part: 'night', inHouse: true })
    expect(lines[0]).toContain(core(HOUSE_HELLO.reading))
    expect(HOUSE_TOPIC.some((t) => lines[1].includes(core(t)))).toBe(true)
  })

  it('새벽 창가에서는 창가 인사를, 밤 침대에서는 졸린 인사를 쓴다', () => {
    const lines = talkLines(v, { ...base, part: 'dawn', hour: 5, inHouse: true })
    expect(lines[0]).toContain(core(HOUSE_HELLO.window))
  })

  it('바깥에서 말을 걸면 집 대사가 나오지 않는다', () => {
    const lines = talkLines(v, { ...base, part: 'night', inHouse: false })
    expect(lines.some((l) => HOUSE_TOPIC.some((t) => l.includes(core(t))))).toBe(false)
  })

  it('낮에는 집 안이어도 바깥과 같은 말이다(주민이 집에 없는 시간)', () => {
    const inside = talkLines(v, { ...base, part: 'day', night: false, inHouse: true })
    const outside = talkLines(v, { ...base, part: 'day', night: false, inHouse: false })
    expect(inside).toEqual(outside)
  })

  it('집 화제는 순번마다 바뀌고 한 줄이 너무 길지 않다', () => {
    const picked = new Set([0, 1, 2, 3].map((n) => talkLines(v, { ...base, part: 'night', inHouse: true, nth: n })[1]))
    expect(picked.size).toBe(HOUSE_TOPIC.length)
    for (const t of HOUSE_TOPIC) expect(t.length).toBeLessThanOrEqual(38)
  })

  it('침대에 누운 시간(23시 이후)에 말을 걸면 졸린 인사를 한다', () => {
    const lines = talkLines(v, { ...base, part: 'night', hour: 23.5, inHouse: true })
    expect(lines[0]).toContain('졸려')
  })
})
