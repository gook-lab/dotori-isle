import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../core/economy'
import { NEW_SHOP } from '../core/shopTiers'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const D0 = '2026-03-10' // 화요일

beforeEach(() => {
  useGame.setState({
    ...fresh,
    day: D0,
    islandStart: D0,
    money: 0,
    questsDone: [],
    dex: {},
    stats: {},
    shop: NEW_SHOP,
    introduced: [],
    letters: [],
    panel: null,
    photo: false,
  })
})

const introIds = () => useGame.getState().letters.map((l) => l.id).filter((id) => id.startsWith('intro-'))

describe('기능 소개 편지', () => {
  it('sends the intro letter when a system opens, and only once', () => {
    useGame.setState({ questsDone: ['dig'] })
    expect(introIds()).toEqual(['intro-atm'])
    expect(useGame.getState().introduced).toEqual(['atm'])
    // 같은 조건을 다시 채워도 편지는 한 번만 온다
    useGame.setState({ questsDone: ['dig', 'welcome'] })
    expect(introIds()).toEqual(['intro-atm'])
  })

  it('sends nothing on the first day', () => {
    useGame.setState({ day: '2026-03-11' })
    expect(introIds()).toEqual([])
  })

  it('introduces the museum when the dex reaches the museum count', () => {
    const dex = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i}`, 1]))
    useGame.setState({ dex })
    expect(introIds()).toEqual(['intro-museum'])
  })
})

describe('기존 저장 옮기기', () => {
  it('counts systems that were already open in an old save as introduced, so no letter floods in', () => {
    const s = migrateSave({ day: D0, islandStart: D0, questsDone: ['dig'], dex: {} })
    expect(s.introduced).toEqual(['atm'])
  })

  it('keeps a saved introduced list and drops unknown ids', () => {
    const s = migrateSave({ day: D0, introduced: ['atm', 'nope', 'atm'] })
    expect(s.introduced).toEqual(['atm'])
  })
})

describe('열림 조건을 지키는 행동', () => {
  it('does not open the photo mode before its quest and days', () => {
    useGame.getState().setPhoto(true)
    expect(useGame.getState().photo).toBe(false)
    expect(useGame.getState().toast?.text ?? useGame.getState().toastQueue.at(-1)?.text).toContain('사진 모드')
  })

  it('opens the photo mode once the blossom quest and five days are in', () => {
    useGame.setState({ questsDone: ['blossom'], islandStart: addDays(D0, -5) as string })
    useGame.getState().setPhoto(true)
    expect(useGame.getState().photo).toBe(true)
  })

  it('does not sell the ladder before the garden quest and four days', () => {
    useGame.setState({ money: 500, questsDone: ['garden'] })
    useGame.getState().buyTool('ladder')
    expect(useGame.getState().tools).not.toContain('ladder')
    expect(useGame.getState().money).toBe(500)
  })

  it('sells the ladder once the garden quest and four days are in', () => {
    useGame.setState({ money: 500, questsDone: ['garden'], islandStart: addDays(D0, -4) as string })
    useGame.getState().buyTool('ladder')
    expect(useGame.getState().tools).toContain('ladder')
  })
})
