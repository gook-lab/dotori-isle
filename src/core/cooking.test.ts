import { describe, expect, it } from 'vitest'
import { addItem, type Slot } from './inventory'
import { activeBuffs, canCook, clockOf, COOK_BY_ID, COOK_RECIPES, cook, effectSeconds, HAPPY_SECONDS, HASTE_SECONDS, isDish, shortfall } from './cooking'

const inv = (...items: [string, number][]): Slot[] => items.map(([id, count]) => ({ id, count }))
const count = (list: readonly Slot[], id: string) => list.find((s) => s.id === id)?.count ?? 0

describe('요리 목록', () => {
  it('여섯 종이고 결과물은 모두 요리 종류다', () => {
    expect(COOK_RECIPES.length).toBe(6)
    for (const r of COOK_RECIPES) expect(isDish(r.id)).toBe(true)
  })

  it('효과: 파이·쿠키는 달리기, 생선구이·수프는 바위, 꽃잎 차는 기쁨', () => {
    expect(COOK_BY_ID['dish-fruit-pie'].effect).toBe('haste')
    expect(COOK_BY_ID['dish-acorn-cookie'].effect).toBe('haste')
    expect(COOK_BY_ID['dish-grilled-fish'].effect).toBe('rock')
    expect(COOK_BY_ID['dish-clam-soup'].effect).toBe('rock')
    expect(COOK_BY_ID['dish-petal-tea'].effect).toBe('happy')
  })
})

describe('재료 확인', () => {
  it('과일 파이는 과일 세 개가 필요하다. 두 개만 있으면 부족한 재료를 보여 준다', () => {
    const r = COOK_BY_ID['dish-fruit-pie']
    expect(shortfall(r, inv(['peach', 2]), 0)).toEqual([{ label: '과일', have: 2, need: 3 }])
    expect(canCook(r, inv(['peach', 1], ['orange', 2]), 0)).toBe(true)
  })

  it('과일은 종류가 섞여도 된다', () => {
    expect(canCook(COOK_BY_ID['dish-fruit-pie'], inv(['peach', 1], ['orange', 1], ['peach', 1]), 0)).toBe(true)
  })

  it('생선구이는 물고기 한 마리, 수프는 조개 두 개', () => {
    expect(canCook(COOK_BY_ID['dish-grilled-fish'], inv(['mackerel', 1]), 0)).toBe(true)
    expect(canCook(COOK_BY_ID['dish-grilled-fish'], inv(['conch', 1]), 0)).toBe(false)
    expect(canCook(COOK_BY_ID['dish-clam-soup'], inv(['conch', 1], ['scallop', 1]), 0)).toBe(true)
    expect(canCook(COOK_BY_ID['dish-clam-soup'], inv(['mackerel', 3]), 0)).toBe(false)
  })

  it('도토리 쿠키는 도토리 5개가 필요하고, 모자라면 도토리 줄을 보여 준다', () => {
    expect(shortfall(COOK_BY_ID['dish-acorn-cookie'], [], 4)).toEqual([{ label: '도토리', have: 4, need: 5 }])
    expect(canCook(COOK_BY_ID['dish-acorn-cookie'], [], 5)).toBe(true)
  })

  it('꽃잎 차는 꽃잎 한 장, 버섯 꼬치는 버섯 두 개', () => {
    expect(canCook(COOK_BY_ID['dish-petal-tea'], inv(['petal', 1]), 0)).toBe(true)
    expect(canCook(COOK_BY_ID['dish-mushroom-skewer'], inv(['mushroom', 1]), 0)).toBe(false)
    expect(canCook(COOK_BY_ID['dish-mushroom-skewer'], inv(['mushroom', 2]), 0)).toBe(true)
  })
})

describe('요리 만들기', () => {
  it('재료를 빼고 요리를 한 개 넣는다', () => {
    const out = cook(COOK_BY_ID['dish-fruit-pie'], inv(['peach', 2], ['orange', 2]), 0)
    expect(out).not.toBeNull()
    expect(count(out!.inv, 'peach')).toBe(0)
    expect(count(out!.inv, 'orange')).toBe(1)
    expect(count(out!.inv, 'dish-fruit-pie')).toBe(1)
  })

  it('쿠키는 도토리를 다섯 개 쓴다', () => {
    const out = cook(COOK_BY_ID['dish-acorn-cookie'], [], 12)
    expect(out?.money).toBe(7)
    expect(count(out!.inv, 'dish-acorn-cookie')).toBe(1)
  })

  it('재료가 모자라면 아무것도 바뀌지 않고 null 이다', () => {
    expect(cook(COOK_BY_ID['dish-grilled-fish'], [], 0)).toBeNull()
  })

  it('주머니가 꽉 차면 재료를 빼지 않는다', () => {
    const full = addItem([], 'wood', 1, 1).inv
    const bag = [...full, { id: 'mackerel', count: 1 }]
    expect(cook(COOK_BY_ID['dish-grilled-fish'], bag, 0, 1)).toBeNull()
    expect(bag[1].count).toBe(1)
  })

  it('재료 종류가 여러 칸에 나뉘어 있어도 필요한 만큼만 쓴다', () => {
    const out = cook(COOK_BY_ID['dish-clam-soup'], inv(['conch', 1], ['scallop', 3]), 0)
    expect(count(out!.inv, 'scallop')).toBe(2)
    expect(count(out!.inv, 'conch')).toBe(0)
  })
})

describe('효과 시간', () => {
  it('달리기는 3분, 기쁨은 2분', () => {
    expect(effectSeconds('haste')).toBe(HASTE_SECONDS)
    expect(effectSeconds('happy')).toBe(HAPPY_SECONDS)
    expect(HASTE_SECONDS).toBe(180)
    expect(effectSeconds('rock')).toBe(0)
  })
})

describe('HUD 효과 칩', () => {
  it('남은 효과만 칩으로 보여 준다', () => {
    expect(activeBuffs(100, { hasteUntil: 0, happyUntil: 0, rockCharge: false })).toEqual([])
    const out = activeBuffs(100, { hasteUntil: 142, happyUntil: 90, rockCharge: true })
    expect(out.map((b) => b.label)).toEqual(['달리기 빨라짐', '바위 한 번에 대기'])
    expect(out[0].seconds).toBe(42)
    expect(out[1].seconds).toBeNull()
  })

  it('남은 시간을 m:ss 로 올림해서 적는다', () => {
    expect(clockOf(42)).toBe('0:42')
    expect(clockOf(41.2)).toBe('0:42')
    expect(clockOf(125)).toBe('2:05')
    expect(clockOf(-3)).toBe('0:00')
  })
})
