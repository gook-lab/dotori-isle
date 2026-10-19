import { describe, expect, it } from 'vitest'
import { dailyStock } from './shopTiers'
import { nextDay } from './festivals'
import { STAMP_REWARD, STAMP_GOAL } from './stampCard'

// 단골 스탬프 보상(도토리 150)이 상점에서 쓰는 돈에 맞는지 본다.
// 가정: 하루 한 번 사서 여섯 칸(여섯 날)을 채우면 그동안 쓴 돈은 "구매 하루 수 × 6일 × 평균 정가"다.
// 평균 정가는 단계별로 30일 진열의 물건 가격을 그대로 셈한다(특가는 할인된 값).
const START = '2026-10-19'

/** 단계별 30일 진열의 평균 가격(진열 한 칸당) */
function avgPrice(tier: 0 | 1 | 2 | 3): number {
  let day = START
  let total = 0
  let count = 0
  for (let i = 0; i < 30; i++) {
    for (const e of dailyStock(tier, day)) {
      total += e.price
      count++
    }
    day = nextDay(day)
  }
  return Math.round(total / count)
}

/** 보상이 목표 칸 수만큼 날 동안 쓴 돈의 몇 %인지(구매 하루 N개 가정) */
const ratio = (tier: 0 | 1 | 2 | 3, perDay: number) => Math.round((STAMP_REWARD / (STAMP_GOAL * perDay * avgPrice(tier))) * 100)

describe('단골 스탬프 보상과 상점 지출', () => {
  it('단계별 평균 정가와, 하루 한 개 살 때 보상이 목표 날 지출의 몇 %인지', () => {
    expect({
      avg: [avgPrice(0), avgPrice(1), avgPrice(2), avgPrice(3)],
      oneADay: [ratio(0, 1), ratio(1, 1), ratio(2, 1), ratio(3, 1)],
    }).toEqual({ avg: [139, 200, 310, 303], oneADay: [18, 13, 8, 8] })
  })
})
