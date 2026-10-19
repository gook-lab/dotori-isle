import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const D1 = '2026-03-16'
const D2 = '2026-03-17'

beforeEach(() => {
  useGame.setState({
    ...fresh,
    day: D1,
    money: 100,
    pocket: 20,
    outLetters: [],
    letters: [],
    friendship: {},
    inventory: [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }],
  })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('편지 동봉: 고른 칸의 변형을 보낸다', () => {
  it('금박 의자를 동봉하면 금박 칸이 나가고 기본 의자는 남으며, 편지에 변형이 실린다', () => {
    expect(useGame.getState().sendLetter('mocha', '안녕', 'kraft', 'chair', 'gold')).toBe(true)
    const s = useGame.getState()
    expect(s.inventory.filter((x) => x.id === 'chair')).toEqual([{ id: 'chair', count: 1 }])
    expect(s.outLetters[0].gift).toBe('chair')
    expect(s.outLetters[0].giftVariant).toBe('gold')
  })

  it('기본 의자를 동봉하면 변형 값 없이 기본 칸이 나간다', () => {
    expect(useGame.getState().sendLetter('mocha', '안녕', 'kraft', 'chair', undefined)).toBe(true)
    const s = useGame.getState()
    expect(s.inventory.filter((x) => x.id === 'chair')).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
    expect(s.outLetters[0].giftVariant).toBeUndefined()
  })

  it('가방에 없는 변형을 고르면 편지를 보내지 않고 물건도 그대로다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }] })
    expect(useGame.getState().sendLetter('mocha', '안녕', 'kraft', 'chair', 'gold')).toBe(false)
    expect(useGame.getState().inventory).toEqual([{ id: 'chair', count: 1 }])
    expect(useGame.getState().outLetters).toEqual([])
  })

  it('알 수 없는 변형 값은 기본 가구로 보고 기본 칸을 뺀다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }] })
    expect(useGame.getState().sendLetter('mocha', '안녕', 'kraft', 'chair', 'rainbow')).toBe(true)
    expect(useGame.getState().outLetters[0].giftVariant).toBeUndefined()
    expect(useGame.getState().inventory).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
  })
})

describe('보낸 편지 저장 정리: 동봉 변형', () => {
  const base = { id: 'o1', to: 'mocha', day: D1, text: '안녕', paper: 'kraft', gift: 'chair', replyDay: D2, replyText: '답장', replied: false, acked: false }

  it('알려진 변형은 그대로 두고, 모르는 변형은 뺀다', () => {
    const [kept] = migrateSave({ outLetters: [{ ...base, giftVariant: 'gold' }] }).outLetters
    expect(kept.giftVariant).toBe('gold')
    const [dropped] = migrateSave({ outLetters: [{ ...base, giftVariant: 'rainbow' }] }).outLetters
    expect(dropped.giftVariant).toBeUndefined()
    expect(dropped.gift).toBe('chair')
  })

  it('동봉이 없는 편지에는 변형을 남기지 않는다', () => {
    const [l] = migrateSave({ outLetters: [{ ...base, gift: null, giftVariant: 'gold' }] }).outLetters
    expect(l.giftVariant).toBeUndefined()
  })
})
