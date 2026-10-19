import { beforeEach, describe, expect, it } from 'vitest'
import { NEW_HOME } from '../core/home'
import { saveOf, useGame } from './store'

const fresh = useGame.getState()

beforeEach(() => {
  useGame.setState({
    ...fresh,
    money: 0,
    pocket: 20,
    inHome: true,
    home: { ...NEW_HOME, stage: 3 },
    homeFloor: 0,
    homeFurniture: [],
    homePlacing: 'chair',
    inventory: [{ id: 'chair', count: 1 }, { id: 'chair', count: 1, variant: 'gold' }],
  })
})

describe('방에 놓기: 놓는 칸과 적는 변형을 맞춘다', () => {
  it('기본 칸이 앞에 있으면 기본 의자를 놓고 금박 칸은 가방에 남는다', () => {
    useGame.getState().placeInHome(1, -3)
    const s = useGame.getState()
    expect(s.homeFurniture).toHaveLength(1)
    expect(s.homeFurniture[0].variant).toBeUndefined()
    expect(s.inventory).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
  })

  it('변형을 고르지 않으면 기본 칸을 놓고, 금박 칸은 가방에 남는다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1, variant: 'gold' }, { id: 'chair', count: 1 }] })
    useGame.getState().placeInHome(1, -3)
    const s = useGame.getState()
    expect(s.homeFurniture[0].variant).toBeUndefined()
    expect(s.inventory).toEqual([{ id: 'chair', count: 1, variant: 'gold' }])
  })
})

describe('방 놓기: 고른 변형으로 놓기 시작한다', () => {
  it('기본 칸이 앞에 있어도 금박을 고르면 금박 의자를 놓고 기본 칸은 남는다', () => {
    useGame.getState().startPlacing('chair', 'gold')
    expect(useGame.getState().homePlacingVariant).toBe('gold')
    useGame.getState().placeInHome(1, -3)
    const s = useGame.getState()
    expect(s.homeFurniture[0].variant).toBe('gold')
    expect(s.inventory).toEqual([{ id: 'chair', count: 1 }])
  })

  it('금박이 다 나가면 놓기를 끝내고, 기본 칸으로 넘어가지 않는다', () => {
    useGame.getState().startPlacing('chair', 'gold')
    useGame.getState().placeInHome(1, -3)
    const s = useGame.getState()
    expect(s.homePlacing).toBeNull()
    expect(s.homePlacingVariant).toBeUndefined()
    expect(s.inventory).toEqual([{ id: 'chair', count: 1 }])
  })

  it('금박 칸이 두 개면 한 번 놓아도 놓기는 금박으로 이어진다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 2, variant: 'gold' }] })
    useGame.getState().startPlacing('chair', 'gold')
    useGame.getState().placeInHome(1, -3)
    expect(useGame.getState().homePlacing).toBe('chair')
    expect(useGame.getState().homePlacingVariant).toBe('gold')
  })

  it('오래된 변형 값이 남아도 놓기가 깨지지 않고 그 물건의 칸으로 놓는다', () => {
    useGame.setState({ inventory: [{ id: 'chair', count: 1 }], homePlacing: 'chair', homePlacingVariant: 'gold' })
    useGame.getState().placeInHome(1, -3)
    const s = useGame.getState()
    expect(s.homeFurniture).toHaveLength(1)
    expect(s.inventory).toEqual([])
  })

  it('놓기 변형은 저장 데이터에 들어가지 않는다', () => {
    useGame.getState().startPlacing('chair', 'gold')
    const save: object = saveOf(useGame.getState())
    expect('placingVariant' in save).toBe(false)
    expect('homePlacingVariant' in save).toBe(false)
  })
})
