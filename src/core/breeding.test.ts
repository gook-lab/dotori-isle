import { describe, expect, it } from 'vitest'
import { BLOOM, type Plant } from './garden'
import { BREED_CHANCE, breedOvernight, childColor, GOLD_CAN_BONUS, rareFlowerOf, RARE_FLOWERS } from './breeding'
import { mulberry32 } from './rng'

const PINK = '#ff8fa3'
const YELLOW = '#ffd166'
const ORANGE = '#ff9f68'
const PURPLE = '#c77dff'
const WHITE = '#ffffff'

const flower = (id: string, x: number, z: number, color = PINK, extra: Partial<Plant> = {}): Plant => ({
  id,
  x,
  z,
  color,
  stage: BLOOM,
  watered: true,
  ...extra,
})

const everywhere = () => true
let seq = 0
const newId = () => `n${++seq}`
const fixed = (v: number) => () => v

describe('childColor — 유전 표', () => {
  it('빨강(분홍)과 노랑을 섞으면 주황이 된다', () => {
    expect(childColor(PINK, YELLOW, fixed(0.9))).toBe(ORANGE)
    expect(childColor(YELLOW, PINK, fixed(0.9))).toBe(ORANGE)
  })

  it('분홍과 하양은 분홍이다', () => {
    expect(childColor(PINK, WHITE, fixed(0.9))).toBe(PINK)
  })

  it('주황과 보라는 희귀한 하늘색이 된다', () => {
    expect(childColor(ORANGE, PURPLE, fixed(0.9))).toBe(RARE_FLOWERS[0].color)
  })

  it('표에 없는 조합은 두 부모 중 하나를 고른다', () => {
    expect(childColor(YELLOW, PURPLE, fixed(0.1))).toBe(YELLOW)
    expect(childColor(YELLOW, PURPLE, fixed(0.9))).toBe(PURPLE)
  })

  it('같은 색끼리는 그 색이다', () => {
    expect(childColor(YELLOW, YELLOW, fixed(0.9))).toBe(YELLOW)
  })

  it('희귀색은 도감 id 로 돌려준다', () => {
    expect(rareFlowerOf(RARE_FLOWERS[1].color)?.id).toBe('flower-rose')
    expect(rareFlowerOf(PINK)).toBeNull()
  })
})

describe('breedOvernight — 물 준 쌍의 확률 교배', () => {
  it('확률을 이기면 빈 옆칸에 활짝 핀 새 꽃이 난다', () => {
    const a = flower('a', 0, 0)
    const b = flower('b', 1, 0)
    // 첫 번째 굴림(쌍 확률)은 통과, 그다음 칸 고르기와 색 고르기는 0 으로
    const rolls = [0, 0, 0]
    const rng = () => rolls.shift() ?? 0
    const out = breedOvernight([a, b], { goldCan: false, rng, free: everywhere, newId })
    expect(out.born.length).toBe(1)
    const child = out.born[0].plant
    expect(child.stage).toBe(BLOOM)
    expect(child.watered).toBe(false)
    expect(out.plants.length).toBe(3)
    // 새 꽃은 부모 옆칸에 있어야 한다
    expect(Math.abs(child.x - a.x) + Math.abs(child.z - a.z) === 1 || Math.abs(child.x - b.x) + Math.abs(child.z - b.z) === 1).toBe(true)
  })

  it('확률에 지면 아무것도 나지 않는다', () => {
    const out = breedOvernight([flower('a', 0, 0), flower('b', 1, 0)], { goldCan: false, rng: fixed(BREED_CHANCE + 0.01), free: everywhere, newId })
    expect(out.born).toEqual([])
    expect(out.plants.length).toBe(2)
  })

  it('금 물뿌리개는 확률을 더 올린다', () => {
    const roll = BREED_CHANCE + GOLD_CAN_BONUS / 2
    const plain = breedOvernight([flower('a', 0, 0), flower('b', 1, 0)], { goldCan: false, rng: fixed(roll), free: everywhere, newId })
    const gold = breedOvernight([flower('a', 0, 0), flower('b', 1, 0)], { goldCan: true, rng: fixed(roll), free: everywhere, newId })
    expect(plain.born.length).toBe(0)
    expect(gold.born.length).toBe(1)
  })

  it('물 주지 않았거나 아직 덜 핀 꽃은 부모가 안 된다', () => {
    const dry = breedOvernight([flower('a', 0, 0, PINK, { watered: false }), flower('b', 1, 0)], { goldCan: false, rng: fixed(0), free: everywhere, newId })
    const bud = breedOvernight([flower('a', 0, 0, PINK, { stage: BLOOM - 1 }), flower('b', 1, 0)], { goldCan: false, rng: fixed(0), free: everywhere, newId })
    expect(dry.born).toEqual([])
    expect(bud.born).toEqual([])
  })

  it('옆칸이 아니면(대각선·두 칸 떨어짐) 교배하지 않는다', () => {
    const diag = breedOvernight([flower('a', 0, 0), flower('b', 1, 1)], { goldCan: false, rng: fixed(0), free: everywhere, newId })
    const far = breedOvernight([flower('a', 0, 0), flower('b', 2, 0)], { goldCan: false, rng: fixed(0), free: everywhere, newId })
    expect(diag.born).toEqual([])
    expect(far.born).toEqual([])
  })

  it('빈 옆칸이 없으면 낳지 않는다', () => {
    const blocked = breedOvernight([flower('a', 0, 0), flower('b', 1, 0)], { goldCan: false, rng: fixed(0), free: () => false, newId })
    expect(blocked.born).toEqual([])
  })

  it('같은 칸에 두 송이가 나지 않는다', () => {
    // 가운데를 사이에 둔 세 꽃: 두 쌍이 같은 빈칸을 노린다
    const plants = [flower('a', 0, 0), flower('b', 1, 0), flower('c', 0, 1)]
    const out = breedOvernight(plants, { goldCan: true, rng: fixed(0), free: everywhere, newId })
    const cells = out.born.map((b) => `${b.plant.x},${b.plant.z}`)
    expect(new Set(cells).size).toBe(cells.length)
  })

  it('희귀색이 나면 도감 id 를 붙여 돌려준다', () => {
    const a = flower('a', 0, 0, ORANGE)
    const b = flower('b', 1, 0, PURPLE)
    const out = breedOvernight([a, b], { goldCan: false, rng: fixed(0), free: everywhere, newId })
    expect(out.born[0].rare).toBe('flower-sky')
  })

  it('같은 씨앗이면 결과가 항상 같다', () => {
    const run = (seed: number) => {
      seq = 0
      const plants = [flower('a', 0, 0, PINK), flower('b', 1, 0, YELLOW), flower('c', 1, 1, PURPLE), flower('d', 2, 1, ORANGE)]
      return breedOvernight(plants, { goldCan: true, rng: mulberry32(seed), free: everywhere, newId }).born.map((b) => b.plant)
    }
    expect(run(7)).toEqual(run(7))
  })
})
