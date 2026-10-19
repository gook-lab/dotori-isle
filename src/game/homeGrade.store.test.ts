import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STAR_GIFTS } from '../core/homeScore'
import { migrateSave, useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-18T12:00:00'))

const fresh = useGame.getState()
// 2026-10-19 은 월요일이다. 편지는 월요일 아침 날이 바뀔 때 온다.
const MON1 = '2026-10-19'
const MON2 = '2026-10-26'
const EIGHT_CHAIRS = Array.from({ length: 8 }, (_, i) => ({ id: `chair-${i}`, itemId: 'chair', x: i, z: 0, rot: 0, floor: 0 as const }))

beforeEach(() => {
  useGame.setState({ ...fresh, day: '2026-10-18', money: 0, miles: 0, letters: [], homeFurniture: EIGHT_CHAIRS, homeStars: [], wallPhoto: null })
})

afterEach(() => {
  useGame.setState(fresh)
})

describe('집 등급 편지', () => {
  it('처음 오른 등급의 기념 가구를 편지 선물로 주고, 같은 등급은 다음 주에 다시 주지 않는다', () => {
    useGame.setState({ day: MON1 })
    const first = useGame.getState()
    const letter = first.letters.find((l) => l.id === `home-score-${MON1}`)
    expect(letter).toBeDefined()
    expect(letter?.gift).toBe(STAR_GIFTS[1])
    expect(letter?.text).toContain('별 1개')
    expect(first.homeStars).toEqual([1])

    useGame.setState({ day: MON2 })
    const second = useGame.getState()
    const again = second.letters.find((l) => l.id === `home-score-${MON2}`)
    expect(again).toBeDefined()
    expect(again?.gift).toBeNull()
    expect(second.homeStars).toEqual([1])
  })

  it('저장 글의 등급 기록은 1~5의 중복 없는 숫자만 남긴다', () => {
    expect(migrateSave({ homeStars: [1, 1, 9, 0, 'x', 3] }).homeStars).toEqual([1, 3])
    expect(migrateSave({}).homeStars).toEqual([])
  })
})
