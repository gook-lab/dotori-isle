import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPANION_FRIENDSHIP, COMPANION_MS } from '../core/companion'
import { VILLAGERS } from '../core/villagers'
import { useGame } from './store'

const v = VILLAGERS.find((x) => !x.guest)!
const T0 = new Date(2026, 9, 19, 13, 0).getTime()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  useGame.setState({ companion: null, friendship: { [v.id]: 8 }, inventory: [], inHome: false, traveling: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('같이 낚시', () => {
  it('시작하면 30분 뒤 끝나는 동행이 생기고, 두 번째 시작은 무시한다', () => {
    useGame.getState().startCompanion(v.id)
    const c = useGame.getState().companion!
    expect(c.villagerId).toBe(v.id)
    expect(c.until).toBe(T0 + COMPANION_MS)
    expect(c.catches).toEqual([])
    useGame.getState().startCompanion(VILLAGERS.find((x) => x.id !== v.id)!.id)
    expect(useGame.getState().companion?.villagerId).toBe(v.id)
  })

  it('잡은 물고기는 쌓이고 다음 입질 시각이 다시 정해진다', () => {
    useGame.getState().startCompanion(v.id)
    useGame.getState().recordCompanionCatch('carp')
    const c = useGame.getState().companion!
    expect(c.catches).toEqual(['carp'])
    expect(c.nextBite).toBeGreaterThan(T0)
  })

  it('끝나면 우정이 오르고, 마지막에 잡은 물고기를 선물로 받는다', () => {
    useGame.getState().startCompanion(v.id)
    useGame.getState().recordCompanionCatch('carp')
    useGame.getState().recordCompanionCatch('sea-bass')
    useGame.getState().endCompanion()
    const s = useGame.getState()
    expect(s.companion).toBeNull()
    expect(s.friendship[v.id]).toBe(8 + COMPANION_FRIENDSHIP)
    expect(s.inventory.map((x) => x.id)).toEqual(['sea-bass'])
  })

  it('한 마리도 못 잡았으면 우정만 오르고 선물은 없다', () => {
    useGame.getState().startCompanion(v.id)
    useGame.getState().endCompanion()
    const s = useGame.getState()
    expect(s.friendship[v.id]).toBe(8 + COMPANION_FRIENDSHIP)
    expect(s.inventory).toEqual([])
  })

  it('30분이 지나면 저절로 끝난다', () => {
    useGame.getState().startCompanion(v.id)
    vi.setSystemTime(T0 + COMPANION_MS - 1000)
    useGame.getState().tickCompanion()
    expect(useGame.getState().companion).not.toBeNull()
    vi.setSystemTime(T0 + COMPANION_MS)
    useGame.getState().tickCompanion()
    expect(useGame.getState().companion).toBeNull()
  })

  it('집에 들어가면 그 자리에서 끝난다', () => {
    useGame.getState().startCompanion(v.id)
    useGame.setState({ inHome: true })
    useGame.getState().tickCompanion()
    expect(useGame.getState().companion).toBeNull()
  })

  it('대화에서 같이 낚시를 고르면 동행이 시작하고 대화창이 닫힌다', () => {
    useGame.setState({ dialog: { villagerId: v.id, name: v.name, lines: ['좋아요'], index: 0, offer: null, choice: { label: '🎣 같이 낚시해요', action: 'fish-along' } }, panel: 'talk' })
    useGame.getState().chooseDialog()
    expect(useGame.getState().companion?.villagerId).toBe(v.id)
    expect(useGame.getState().dialog).toBeNull()
  })

  it('대화에서 벌레잡기를 고르면 벌레 모드로 시작한다', () => {
    useGame.setState({ dialog: { villagerId: v.id, name: v.name, lines: ['좋아요'], index: 0, offer: null, choices: [{ label: '🦋 같이 벌레 잡아요', action: 'bug-along' }] }, panel: 'talk' })
    useGame.getState().chooseDialog('bug-along')
    expect(useGame.getState().companion?.mode).toBe('bug')
    expect(useGame.getState().companion?.clapAt).toBe(0)
  })

  it('벌레 모드에서 플레이어가 벌레를 잡으면 박수 시각이 찍힌다', () => {
    useGame.getState().startCompanion(v.id, 'bug')
    expect(useGame.getState().companion!.clapAt).toBe(0)
    useGame.getState().catchBug({ id: 'bug-test', x: 0, z: 0 } as never, 'cabbage-white')
    expect(useGame.getState().companion!.clapAt).toBeGreaterThan(0)
  })
})
