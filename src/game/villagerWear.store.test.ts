import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { wornGiftOf, migrateSave, useGame } from './store'

const fresh = useGame.getState()
const MOCHA = 'mocha'
const D1 = '2026-03-16'
const D2 = '2026-03-17'

function openDialog() {
  useGame.setState({
    dialog: { villagerId: MOCHA, name: '모카', lines: ['안녕'], index: 0, offer: null, choice: null, ask: null } as never,
  })
}

beforeEach(() => {
  useGame.setState({ ...fresh, day: D1, closet: ['shirt-sky', 'shirt-lemon'], villagerWear: {}, giftDay: {}, friendship: {} })
  openDialog()
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('주민에게 옷 선물하기', () => {
  it('옷장의 옷을 주면 주민 옷 칸과 선물한 날이 적힌다', () => {
    useGame.getState().giveWear('shirt-lemon')
    const s = useGame.getState()
    expect(s.villagerWear[MOCHA]).toEqual({ outfit: 'shirt-lemon', day: D1 })
    expect(s.giftDay[MOCHA]).toBe(D1)
    expect(s.friendship[MOCHA]).toBeGreaterThan(0)
  })

  it('옷은 복사해서 주므로 내 옷장에 그대로 남는다', () => {
    useGame.getState().giveWear('shirt-lemon')
    expect(useGame.getState().closet).toContain('shirt-lemon')
  })

  it('옷장에 없는 옷은 줄 수 없다', () => {
    useGame.getState().giveWear('shirt-berry')
    expect(useGame.getState().villagerWear[MOCHA]).toBeUndefined()
  })

  it('하루에 한 주민에게 한 번만 준다', () => {
    useGame.getState().giveWear('shirt-lemon')
    openDialog()
    useGame.getState().giveWear('shirt-sky')
    expect(useGame.getState().villagerWear[MOCHA].outfit).toBe('shirt-lemon')
  })

  it('다음 날부터 주민이 그 옷을 입는다', () => {
    useGame.getState().giveWear('shirt-lemon')
    const entry = useGame.getState().villagerWear[MOCHA]
    expect(wornGiftOf(entry, D1, {})).toBeUndefined()
    expect(wornGiftOf(entry, D2, {})?.id).toBe('shirt-lemon')
  })
})

describe('주민 옷 저장 정리(migrateSave)', () => {
  it('옷 칸이 아니거나 날짜가 깨진 항목은 버린다', () => {
    const s = migrateSave({
      villagerWear: {
        mocha: { outfit: 'shirt-lemon', day: D1 },
        bomi: { outfit: 'straw-hat', day: D1 },
        dongri: { outfit: 'shirt-berry', day: 'nope' },
      },
    })
    expect(Object.keys(s.villagerWear)).toEqual(['mocha'])
  })
})
