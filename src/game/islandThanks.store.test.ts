import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './store'

// 2차 시설은 완성 아침(10-31)에 들어오고, 감사 편지는 그다음 날 아침(11-01)에 한 통 온다
beforeEach(() => {
  useGame.setState({ money: 0, day: '2026-10-30', toast: null, toastQueue: [], letters: [], islandAcorn: { built: 0, fund: 0, ready: null }, islandThanksDay: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('섬 가꾸기 2차 감사 편지', () => {
  it('완성 아침에는 아직 편지가 없고, 다음 날 아침에 시설을 보는 주민이 한 통 보낸다', () => {
    vi.useFakeTimers()
    useGame.setState({ islandAcorn: { built: 0, fund: 30000, ready: '2026-10-31' } })
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    let s = useGame.getState()
    expect(s.islandAcorn?.built).toBe(1)
    expect(s.islandThanksDay).toBe('2026-10-31')
    expect(s.letters.some((l) => l.id.startsWith('island-thanks-'))).toBe(false)

    vi.setSystemTime(new Date('2026-11-01T08:00:00'))
    useGame.getState().syncClock()
    s = useGame.getState()
    const thanks = s.letters.filter((l) => l.id.startsWith('island-thanks-'))
    expect(thanks.map((l) => l.id)).toEqual(['island-thanks-lighthouse-lamps'])
    expect(s.islandThanksDay).toBeNull()
  })

  it('같은 시설의 편지는 한 번만 온다. 다음 아침에 다시 열어도 늘지 않는다', () => {
    vi.useFakeTimers()
    useGame.setState({ islandAcorn: { built: 1, fund: 0, ready: null }, islandThanksDay: '2026-10-31' })
    vi.setSystemTime(new Date('2026-11-01T08:00:00'))
    useGame.getState().syncClock()
    vi.setSystemTime(new Date('2026-11-02T08:00:00'))
    useGame.getState().syncClock()
    const thanks = useGame.getState().letters.filter((l) => l.id === 'island-thanks-lighthouse-lamps')
    expect(thanks).toHaveLength(1)
  })

  it('이틀 연속 완성되면 A 편지는 R+1 아침에, B 편지는 R+2 아침에 온다. 두 편지가 섞이지 않는다', () => {
    vi.useFakeTimers()
    // R(10-31)에 A(등대 가로등)가 완성된다
    useGame.setState({ islandAcorn: { built: 0, fund: 30000, ready: '2026-10-31' } })
    vi.setSystemTime(new Date('2026-10-31T08:00:00'))
    useGame.getState().syncClock()
    expect(useGame.getState().islandThanksDay).toBe('2026-10-31')

    // R+1(11-01) 아침: A 편지가 오고, 같은 아침에 B(해변 파라솔)가 완성되어 islandThanksDay 가 다시 채워진다
    useGame.setState({ islandAcorn: { built: 1, fund: 15000, ready: '2026-11-01' } })
    vi.setSystemTime(new Date('2026-11-01T08:00:00'))
    useGame.getState().syncClock()
    let s = useGame.getState()
    expect(s.islandAcorn?.built).toBe(2)
    expect(s.islandThanksDay).toBe('2026-11-01')
    expect(s.letters.filter((l) => l.id.startsWith('island-thanks-')).map((l) => l.id)).toEqual(['island-thanks-lighthouse-lamps'])

    // R+2(11-02) 아침: B 편지가 오고 A 편지는 다시 오지 않는다
    vi.setSystemTime(new Date('2026-11-02T08:00:00'))
    useGame.getState().syncClock()
    s = useGame.getState()
    expect(s.letters.filter((l) => l.id.startsWith('island-thanks-')).map((l) => l.id)).toEqual(['island-thanks-beach-parasol', 'island-thanks-lighthouse-lamps'])
    expect(s.islandThanksDay).toBeNull()
  })
})
