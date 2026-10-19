import { describe, expect, it } from 'vitest'
import { addMileGain, formatMiles, mileToastText, type MileGain } from './miles'

describe('마일 토스트 합치기', () => {
  it('같은 이유는 횟수와 마일을 더하고, 새 이유는 뒤에 붙인다', () => {
    let gains: MileGain[] = []
    gains = addMileGain(gains, { name: '물고기', count: 1, unit: '마리', amount: 10 })
    gains = addMileGain(gains, { name: '물고기', count: 2, unit: '마리', amount: 20 })
    gains = addMileGain(gains, { name: '할 일', count: 1, unit: '개', amount: 30 })
    expect(gains).toEqual([
      { name: '물고기', count: 3, unit: '마리', amount: 30 },
      { name: '할 일', count: 1, unit: '개', amount: 30 },
    ])
  })

  it('토스트 한 줄은 🏅 합계와 이유를 보여 준다. 한 번만 쌓인 이유는 횟수를 적지 않는다', () => {
    expect(mileToastText([{ name: '물고기', count: 3, unit: '마리', amount: 30 }])).toBe('🏅 +30마일 · 물고기 3마리')
    expect(mileToastText([{ name: '섬 평가 보상', count: 1, unit: '개', amount: 150 }])).toBe('🏅 +150마일 · 섬 평가 보상')
    expect(
      mileToastText([
        { name: '할 일', count: 2, unit: '개', amount: 20 },
        { name: '집 꾸미기 점수', count: 1, unit: '개', amount: 50 },
      ]),
    ).toBe('🏅 +70마일 · 할 일 2개 · 집 꾸미기 점수')
  })
})

describe('마일 표기', () => {
  it('천 단위에 콤마를 찍고 뒤에 마일을 붙인다', () => {
    expect(formatMiles(40)).toBe('40마일')
    expect(formatMiles(1500)).toBe('1,500마일')
  })
})
