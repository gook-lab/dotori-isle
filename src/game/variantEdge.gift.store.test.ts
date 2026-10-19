import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NEW_SHOP } from '../core/shopTiers'
import { useGame } from './store'

const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({
    ...fresh,
    panel: 'talk',
    money: 0,
    pocket: 20,
    letters: [],
    houses: ['mocha'],
    friendship: {},
    giftDay: {},
    birthdayThanks: [],
    day: '2026-01-02',
    dialog: { villagerId: 'mocha', name: '모카', lines: ['안녕!'], index: 0, offer: null, ask: null, choice: null },
    shop: NEW_SHOP,
    stats: {},
    inventory: [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }],
  })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('선물하기: 고른 칸의 변형을 준다', () => {
  it('금박 의자를 고르면 금박 칸이 나가고 기본 의자는 남는다', () => {
    useGame.getState().giveGift('chair', 'gold')
    // 답례로 다른 물건이 들어올 수 있어 의자 칸만 본다
    expect(useGame.getState().inventory.filter((x) => x.id === 'chair')).toEqual([{ id: 'chair', count: 1 }])
  })

  it('기본 의자를 고르면 기본 칸이 나가고 금박 칸은 남는다', () => {
    useGame.getState().giveGift('chair', undefined)
    expect(useGame.getState().inventory.filter((x) => x.id === 'chair')).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
  })
})
