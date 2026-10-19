import { describe, expect, it } from 'vitest'
import { LAMP_KEEP_MARGIN, OUTDOOR_LAMP_SLOTS, pickLampSlots } from './lampSlots'

const c = (id: string, d2: number) => ({ id, d2 })

describe('바깥 등 고정 칸 — 가까운 등만 빛을 낸다', () => {
  it('칸은 항상 고정 개수이고, 가까운 등부터 채운다', () => {
    const cands = [c('a', 9), c('b', 1), c('c', 4)]
    const out = pickLampSlots(cands, [])
    expect(out).toHaveLength(OUTDOOR_LAMP_SLOTS)
    expect(out.slice(0, 3)).toEqual(['b', 'c', 'a'])
    expect(out.slice(3).every((x) => x === null)).toBe(true)
  })

  it('등이 칸보다 많으면 칸 수만큼만 고른다', () => {
    const many = Array.from({ length: 12 }, (_, i) => c(`l${i}`, i))
    const out = pickLampSlots(many, [])
    expect(out.filter((x) => x !== null)).toHaveLength(OUTDOOR_LAMP_SLOTS)
    expect(out[0]).toBe('l0')
  })

  it('이미 칸을 가진 등은 조금 밀려도 같은 칸을 유지한다(깜빡임 방지)', () => {
    const prev = ['a', 'b', null, null, null]
    // a 가 순위 한 칸 밀린 것은 여유 안이라 그대로 둔다
    const cands = [c('x', 1), c('a', 2), c('b', 3), c('y', 4), c('z', 5)]
    const out = pickLampSlots(cands, prev)
    expect(out[0]).toBe('a')
    expect(out[1]).toBe('b')
    expect(out).toContain('x')
  })

  it('여유 밖으로 밀려난 등만 칸을 내준다', () => {
    const prev = ['a', 'b', 'c', 'd', 'e']
    const far = OUTDOOR_LAMP_SLOTS + LAMP_KEEP_MARGIN
    // a 는 가장 멀어져 여유 밖이 된다. 나머지는 가까워서 그대로다.
    const cands = [c('b', 1), c('c', 2), c('d', 3), c('e', 4), c('f', 5), c('g', 6), c('h', 7)]
    const out = pickLampSlots(cands.concat([c('a', 100)]), prev)
    expect(out).not.toContain('a')
    expect(out.slice(1)).toEqual(['b', 'c', 'd', 'e'])
    expect(far).toBe(7)
  })

  it('등이 사라지면 그 칸은 빈 칸이 된다', () => {
    const out = pickLampSlots([c('b', 1)], ['a', 'b', null, null, null])
    expect(out).toEqual([null, 'b', null, null, null])
  })
})
