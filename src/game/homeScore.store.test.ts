import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scoreHome, tierOf } from '../core/homeScore'
import { useGame } from './store'

const fresh = useGame.getState()
const MON = '2026-03-16'
const SUN = '2026-03-15'

beforeEach(() => {
  useGame.setState({ ...fresh, day: SUN, letters: [], homeFurniture: [], money: 0, miles: 0, wallPhoto: null })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('집 꾸미기 점수 편지', () => {
  it('월요일이 되면 점수 편지를 한 번 보낸다', () => {
    useGame.setState({ day: MON })
    const letters = useGame.getState().letters.filter((l) => l.id === `home-score-${MON}`)
    expect(letters).toHaveLength(1)
    expect(letters[0].text).toContain('0점')
  })

  it('같은 월요일에 다시 바뀌어도 편지는 하나다', () => {
    useGame.setState({ day: MON })
    useGame.setState({ day: '2026-03-17' })
    useGame.setState({ day: MON })
    expect(useGame.getState().letters.filter((l) => l.id === `home-score-${MON}`)).toHaveLength(1)
  })

  it('화요일에는 편지를 보내지 않는다', () => {
    useGame.setState({ day: '2026-03-17' })
    expect(useGame.getState().letters.some((l) => l.id.startsWith('home-score'))).toBe(false)
  })

  it('보상 구간이면 도토리를 편지와 함께 준다', () => {
    const furniture = Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, itemId: 'chair', x: i, z: 0, rot: 0 }))
    useGame.setState({ homeFurniture: furniture, wallPhoto: 'p1', money: 10 })
    useGame.setState({ day: MON })
    const expected = tierOf(scoreHome({ stage: useGame.getState().home.stage, furniture, framed: true }).total)
    expect(expected).not.toBeNull()
    expect(useGame.getState().money).toBe(10 + (expected?.reward.acorns ?? 0))
  })
})
