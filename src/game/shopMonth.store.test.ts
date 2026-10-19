import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEW_SHOP_LOG } from '../core/shopEvents'
import { useGame } from './store'

// 가게 결산의 날: 달 마지막 날 아침에 이번 달 판매 누계를 편지로 보내고 보너스 마일을 준다.
const LAST = '2026-10-31'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`2026-10-30T11:00:00`))
  useGame.setState({
    day: '2026-10-30',
    money: 3000,
    miles: 100,
    letters: [],
    shopLog: NEW_SHOP_LOG,
    shopMonth: { month: '2026-10', total: 12000, items: { peach: 12000 }, settled: false },
    toast: null,
    toastQueue: [],
  })
})

describe('도토리 상점 결산', () => {
  it('달 마지막 날 아침에 결산 편지와 보너스 마일을 주고, 같은 달 안에서는 한 번만 보낸다', () => {
    vi.setSystemTime(new Date(`${LAST}T09:00:00`))
    useGame.getState().syncClock()
    const after = useGame.getState()
    expect(after.letters.filter((l) => l.id.startsWith('shop-month-')).map((l) => l.id)).toEqual(['shop-month-2026-10'])
    expect(after.miles).toBe(120)
    expect(after.shopMonth).toMatchObject({ month: '2026-10', total: 12000, settled: true })
    useGame.getState().syncClock()
    expect(useGame.getState().letters.filter((l) => l.id.startsWith('shop-month-'))).toHaveLength(1)
  })

  it('마지막 날을 놓쳤으면 다음 달 첫 아침에 지난달 것을 보낸다', () => {
    vi.setSystemTime(new Date('2026-11-01T09:00:00'))
    useGame.getState().syncClock()
    const letter = useGame.getState().letters.find((l) => l.id === 'shop-month-2026-10')
    expect(letter?.text).toContain('1일부터 말일까지')
  })

  it('결산이 끝난 뒤 다음 달에 팔면 누계는 새 달부터 다시 센다', () => {
    vi.setSystemTime(new Date(`${LAST}T09:00:00`))
    useGame.getState().syncClock()
    vi.setSystemTime(new Date('2026-11-02T11:00:00'))
    useGame.getState().syncClock()
    useGame.setState({ inventory: [{ id: 'peach', count: 1 }] })
    useGame.getState().sellAll()
    expect(useGame.getState().shopMonth).toMatchObject({ month: '2026-11', settled: false })
    expect(useGame.getState().shopMonth?.total ?? 0).toBeGreaterThan(0)
  })
})
