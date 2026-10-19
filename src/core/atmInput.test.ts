import { describe, expect, it } from 'vitest'
import { depositState, repayLabel, withdrawState } from './atmInput'

describe('넣기 버튼', () => {
  it('지갑이 비었으면 막고 그 이유를 말한다', () => {
    expect(depositState(0, 0, 1000)).toEqual({ ok: false, label: '지갑이 비어 있어요' })
  })

  it('금액을 안 골랐으면 막는다', () => {
    expect(depositState(0, 500, 1000)).toEqual({ ok: false, label: '넣을 금액 고르기' })
  })

  it('가진 돈보다 많으면 막고, 통장 한도를 넘으면 남은 한도를 알려 준다', () => {
    expect(depositState(600, 500, 1000)).toEqual({ ok: false, label: '가진 도토리보다 많아요' })
    expect(depositState(800, 1000, 300)).toEqual({ ok: false, label: '통장에는 300개까지 넣을 수 있어요' })
  })

  it('한도가 꽉 찼으면 그렇게 말한다', () => {
    expect(depositState(10, 1000, 0)).toEqual({ ok: false, label: '통장 한도가 꽉 찼어요' })
  })

  it('넣을 수 있으면 천 단위 쉼표를 찍은 문구로 켜진다', () => {
    expect(depositState(1500, 3000, 5000)).toEqual({ ok: true, label: '1,500 넣기' })
  })
})

describe('빼기 버튼', () => {
  it('통장이 비었거나 오늘 한도를 다 썼으면 막는다', () => {
    expect(withdrawState(100, 0, 0, 0).label).toBe('통장이 비어 있어요')
    expect(withdrawState(100, 0, 500, 0).label).toBe('오늘은 다 뺐어요')
  })

  it('오늘 뺄 수 있는 양을 넘으면 그만큼만 뺄 수 있다고 알려 준다', () => {
    expect(withdrawState(900, 600, 2000, 600)).toEqual({ ok: false, label: '600개까지만 뺄 수 있어요' })
  })

  it('뺄 수 있으면 켜진다', () => {
    expect(withdrawState(300, 600, 2000, 600)).toEqual({ ok: true, label: '300 빼기' })
    expect(withdrawState(0, 600, 2000, 600)).toEqual({ ok: false, label: '뺄 금액 고르기' })
  })
})

describe('대출 갚기 문구', () => {
  it('금액을 안 골랐을 때 출처가 비었으면 돈이 없다고 먼저 말한다', () => {
    expect(repayLabel(0, 0, 2500, '지갑', 0)).toBe('지갑 돈이 없어요')
    expect(repayLabel(0, 0, 2500, '통장', 800)).toBe('통장에서 갚을 금액 고르기')
  })

  it('출처에 돈이 있으면 금액을 적은 문구로, 대출을 넘으면 남은 대출 전부로 말한다', () => {
    expect(repayLabel(500, 500, 2500, '지갑', 900)).toBe('500 갚기')
    expect(repayLabel(2500, 3000, 2500, '지갑', 9000)).toBe('2,500 갚기 · 남은 대출 전부')
    expect(repayLabel(300, 1000, 2500, '통장', 300)).toBe('300 갚기 · 통장 전부')
  })

  it('금액이 있는데 출처가 모자라면 돈이 없다고 말한다', () => {
    expect(repayLabel(0, 500, 2500, '통장', 0)).toBe('통장 돈이 없어요')
  })
})
