import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STAMP_COST } from '../core/mail'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const D1 = '2026-03-16'
const D2 = '2026-03-17'

beforeEach(() => {
  useGame.setState({ ...fresh, day: D1, money: 100, inventory: [{ id: 'peach', count: 2 }], outLetters: [], letters: [], friendship: {} })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('주민에게 편지 보내기', () => {
  it('우표값을 내고 편지를 보내며 우정이 1 오른다', () => {
    expect(useGame.getState().sendLetter('mocha', '안녕 모카', 'pink', null)).toBe(true)
    const s = useGame.getState()
    expect(s.money).toBe(100 - STAMP_COST)
    expect(s.outLetters).toHaveLength(1)
    expect(s.outLetters[0]).toMatchObject({ to: 'mocha', day: D1, text: '안녕 모카', paper: 'pink', gift: null, replied: false, acked: false })
    expect(s.friendship.mocha).toBe(1)
  })

  it('하루에 한 통만 보낸다', () => {
    useGame.getState().sendLetter('mocha', '하나', 'kraft', null)
    expect(useGame.getState().sendLetter('bomi', '둘', 'kraft', null)).toBe(false)
    expect(useGame.getState().outLetters).toHaveLength(1)
  })

  it('우표값이 모자라면 보내지 않는다', () => {
    useGame.setState({ money: STAMP_COST - 1 })
    expect(useGame.getState().sendLetter('mocha', '안녕', 'kraft', null)).toBe(false)
    expect(useGame.getState().outLetters).toHaveLength(0)
  })

  it('글이 비었거나 여든 자를 넘으면 보내지 않는다', () => {
    expect(useGame.getState().sendLetter('mocha', '   ', 'kraft', null)).toBe(false)
    expect(useGame.getState().sendLetter('mocha', '가'.repeat(81), 'kraft', null)).toBe(false)
  })

  it('동봉한 물건은 주머니에서 빠지고 편지에 남는다', () => {
    expect(useGame.getState().sendLetter('mocha', '복숭아 줄게', 'mint', 'peach')).toBe(true)
    expect(useGame.getState().inventory).toEqual([{ id: 'peach', count: 1 }])
    expect(useGame.getState().outLetters[0].gift).toBe('peach')
  })

  it('주머니에 없는 물건은 동봉할 수 없다', () => {
    expect(useGame.getState().sendLetter('mocha', '안녕', 'kraft', 'conch')).toBe(false)
    expect(useGame.getState().money).toBe(100)
  })

  it('답장 날이 되면 그 주민의 편지가 우편함에 한 번 온다', () => {
    useGame.getState().sendLetter('mocha', '안녕', 'kraft', null)
    const replyDay = useGame.getState().outLetters[0].replyDay
    useGame.setState({ day: replyDay })
    const replies = useGame.getState().letters.filter((l) => l.id.startsWith('reply-'))
    expect(replies).toHaveLength(1)
    expect(replies[0]).toMatchObject({ from: 'mocha', fromName: '모카' })
    expect(useGame.getState().outLetters[0].replied).toBe(true)
    // 다시 날이 바뀌어도 답장은 한 번만 온다
    useGame.setState({ day: D2 })
    useGame.setState({ day: replyDay })
    expect(useGame.getState().letters.filter((l) => l.id.startsWith('reply-'))).toHaveLength(1)
  })
})

describe('보낸 편지 저장 정리(migrateSave)', () => {
  it('깨진 편지는 버리고 최근 열 통만 남긴다', () => {
    const good = { id: 'o1', to: 'mocha', day: D1, text: '안녕', paper: 'kraft', gift: null, replyDay: D2, replyText: '답장', replied: false, acked: false }
    const bad = { ...good, id: 'o2', paper: 'neon' }
    const s = migrateSave({ outLetters: [good, bad, { ...good, id: 'o3', text: '가'.repeat(81) }] })
    expect(s.outLetters.map((l) => l.id)).toEqual(['o1'])
    const many = Array.from({ length: 14 }, (_, i) => ({ ...good, id: `m${i}` }))
    expect(migrateSave({ outLetters: many }).outLetters).toHaveLength(10)
  })
})
