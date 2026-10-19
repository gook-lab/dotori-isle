import { beforeEach, describe, expect, it } from 'vitest'
import { onKey } from './controls'
import { useGame } from './store'

describe('quest panel keyboard claim', () => {
  beforeEach(() => {
    // 집 짓기 목표를 채운 동그리 퀘스트 하나가 받을 보상으로 남아 있다
    useGame.setState({
      panel: 'quest',
      quests: [{ id: 'newcomer-dongri', baseline: {} }],
      questsDone: [],
      stats: { 'build:dongri': 1 },
      dailyBase: {},
      dailyClaimed: [],
      money: 0,
      traveling: false,
      doorFade: false,
      caption: null,
    })
  })

  it('claims the first reward with E while the quest panel is open', () => {
    onKey('KeyE')
    expect(useGame.getState().questsDone).toContain('newcomer-dongri')
    expect(useGame.getState().money).toBeGreaterThan(0)
  })

  it('claims with Enter too, and a second press with nothing left does nothing', () => {
    onKey('Enter')
    const money = useGame.getState().money
    onKey('Enter')
    expect(useGame.getState().money).toBe(money)
    expect(useGame.getState().questsDone).toEqual(['newcomer-dongri'])
  })
})

describe('panel open: E does not toggle the panel', () => {
  beforeEach(() => {
    useGame.setState({ panel: 'shop', bagOpen: false, traveling: false, doorFade: false, caption: null, dialog: null })
  })

  it('E 는 열린 상점 창을 닫지도 다시 열지도 않는다. 닫기는 Esc 로만 한다', () => {
    onKey('KeyE')
    expect(useGame.getState().panel).toBe('shop')
    onKey('Escape')
    expect(useGame.getState().panel).toBeNull()
  })

  it('창을 닫은 뒤 E 는 다른 것을 열지 않는다(열린 것은 주변 행동이 정한다)', () => {
    onKey('Escape')
    onKey('KeyE')
    expect(useGame.getState().panel).toBeNull()
  })
})
