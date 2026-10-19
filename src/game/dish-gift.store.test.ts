import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DISH_GIFT_BONUS, isDish } from '../core/cooking'
import { tasteOf } from '../core/gifts'
import { ITEMS } from '../core/items'
import { VILLAGERS } from '../core/villagers'
import { useGame } from './store'

const DAY = '2026-10-19'
const v = VILLAGERS.find((x) => !x.guest)!
// 같은 입맛(좋아함·보통·싫어함)으로 반응하는 일반 물건을 골라 비교한다. 입맛이 같으면 기본 점수가 같다.
const DISH = 'dish-fruit-pie'
const PLAIN = Object.keys(ITEMS).find((id) => !isDish(id) && id !== DISH && tasteOf(v.id, id) === tasteOf(v.id, DISH))!

/** 주민과 대화 중인 상태로 맞추고, 선물을 한 번 주고 늘어난 우정 점수를 돌려준다 */
function giveAndMeasure(itemId: string, count: number): number {
  useGame.setState({
    day: DAY,
    friendship: { [v.id]: 0 },
    giftDay: {},
    inventory: [{ id: itemId, count }],
    dialog: { villagerId: v.id, name: v.name, lines: [], index: 0, offer: null },
  })
  useGame.getState().giveGift(itemId)
  return useGame.getState().friendship[v.id] ?? 0
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('요리 선물', () => {
  it('요리를 주면 같은 물건을 주었을 때보다 우정이 보너스만큼 더 오른다', () => {
    const plain = giveAndMeasure(PLAIN, 1)
    const dish = giveAndMeasure(DISH, 1)
    expect(dish - plain).toBe(DISH_GIFT_BONUS)
  })

  it('요리 선물도 하루에 한 번만 받는다', () => {
    giveAndMeasure(DISH, 2)
    const once = useGame.getState().friendship[v.id]
    useGame.getState().giveGift(DISH)
    expect(useGame.getState().friendship[v.id]).toBe(once)
  })
})
