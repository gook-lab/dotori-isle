import { describe, expect, it } from 'vitest'
import {
  applyPayment,
  canUpgrade,
  HOME_STAGES,
  homeDef,
  loanLabel,
  NEW_HOME,
  nextStage,
  payLoan,
  pickHomePlot,
  settleHome,
  startHomeUpgrade,
  storageSlots,
} from './home'
import { byWater, isWalkable } from './island'
import { reservedByHomes } from './villagers'
import { blockedByProps, SPAWN } from './world'

const DAY = '2026-10-18'

describe('집 단계 정의', () => {
  it('텐트 → 작은 집 → 큰 집 → 다락방 → 옆방 → 지하실 순서이고, 텐트는 무료다', () => {
    expect(HOME_STAGES.map((s) => s.name)).toEqual(['텐트', '작은 집', '큰 집', '다락방 증축', '옆방 증축', '지하실 증축'])
    expect(HOME_STAGES[0].loan).toBe(0)
    expect(HOME_STAGES.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('보관 칸은 단계마다 늘고 주머니 최대(40)를 넘지 않는다', () => {
    const slots = HOME_STAGES.map((s) => s.storage)
    expect(slots).toEqual([...slots].sort((a, b) => a - b))
    expect(storageSlots(3)).toBe(40)
  })

  it('다음 단계와 마지막 단계 판정', () => {
    expect(nextStage(0)?.name).toBe('작은 집')
    expect(nextStage(4)?.name).toBe('지하실 증축')
    expect(nextStage(5)).toBeNull()
    expect(homeDef(2).grid).toEqual({ w: 5, h: 5 })
  })
})

describe('대출 · 갚기 · 다음 집', () => {
  it('빚이 0 이어야 다음 집을 맡길 수 있다', () => {
    expect(canUpgrade(0, 0)).toEqual({ ok: true, to: 1, loan: 2500 })
    const r = canUpgrade(1, 1200)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('1,200')
  })

  it('마지막 단계는 더 올릴 수 없다', () => {
    expect(canUpgrade(5, 0).ok).toBe(false)
    expect(canUpgrade(4, 0)).toEqual({ ok: true, to: 5, loan: 9000 })
  })

  it('잘못된 단계나 빚 값은 거절한다', () => {
    expect(canUpgrade(6, 0).ok).toBe(false)
    expect(canUpgrade(0, -1).ok).toBe(false)
    expect(canUpgrade(0, 1.5).ok).toBe(false)
  })

  it('빚을 갚는 계산: 남은 빚만큼만 빠지고 초과분은 없다', () => {
    expect(applyPayment(2500, 1000)).toEqual({ ok: true, balance: 1500, paid: 1000 })
    expect(applyPayment(2500, 9999)).toEqual({ ok: true, balance: 0, paid: 2500 })
  })

  it('빚이 없거나 금액이 잘못되면 갚을 수 없다', () => {
    expect(applyPayment(0, 100)).toEqual({ ok: false, reason: '갚을 대출이 없어요' })
    expect(applyPayment(100, 0).ok).toBe(false)
    expect(applyPayment(100, -5).ok).toBe(false)
    expect(applyPayment(100, 2.5).ok).toBe(false)
    expect(applyPayment(-1, 5).ok).toBe(false)
  })

  it('도토리로 갚을 때 돈이 모자라면 실패하고, 있으면 실제 빠진 만큼을 돌려준다', () => {
    expect(payLoan(300, 2500, 1000)).toEqual({ ok: false, reason: '도토리가 모자라요' })
    expect(payLoan(5000, 2500, 1000)).toEqual({ ok: true, money: 4000, balance: 1500, paid: 1000 })
    expect(payLoan(5000, 2500, 9999)).toEqual({ ok: true, money: 2500, balance: 0, paid: 2500 })
  })

  it('빚 상태 한 줄 요약', () => {
    expect(loanLabel(0)).toBe('대출이 없어요')
    expect(loanLabel(2500)).toContain('2,500')
  })
})

describe('집 짓기 — 밤새 완성', () => {
  it('맡긴 날에는 빚이 잡히고 집은 아직 그대로다', () => {
    const r = startHomeUpgrade(NEW_HOME, DAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state).toEqual({ stage: 0, loan: 2500, order: { to: 1, day: DAY } })
    expect(settleHome(r.state, DAY)).toBe(r.state)
  })

  it('다음 날 아침 완성되고 단계가 오른다', () => {
    const r = startHomeUpgrade(NEW_HOME, DAY)
    if (!r.ok) throw new Error('setup')
    expect(settleHome(r.state, '2026-10-19')).toEqual({ stage: 1, loan: 2500, order: null })
  })

  it('짓는 중이면 또 맡길 수 없고, 빚이 남아 있으면 맡길 수 없다', () => {
    const r = startHomeUpgrade(NEW_HOME, DAY)
    if (!r.ok) throw new Error('setup')
    expect(startHomeUpgrade(r.state, DAY).ok).toBe(false)
    const indebted = { stage: 1 as const, loan: 2500, order: null }
    expect(startHomeUpgrade(indebted, DAY).ok).toBe(false)
  })

  it('빚을 다 갚은 뒤에는 다음 단계를 맡길 수 있다', () => {
    const paidUp = { stage: 1 as const, loan: 0, order: null }
    const r = startHomeUpgrade(paidUp, DAY)
    expect(r).toMatchObject({ ok: true, to: 2 })
    if (r.ok) expect(r.state.loan).toBe(8000)
  })

  it('잘못된 날짜는 거절한다', () => {
    expect(startHomeUpgrade(NEW_HOME, '2026-02-30').ok).toBe(false)
  })
})

describe('집 자리 고르기', () => {
  it('스폰 근처에 걸을 수 있고 물·소품·주민 자리와 떨어진 자리를 고른다', () => {
    const p = pickHomePlot()
    expect(p).not.toBeNull()
    if (!p) return
    expect(isWalkable(p.x, p.z)).toBe(true)
    expect(byWater(p.x, p.z, 1.7)).toBe(false)
    expect(blockedByProps(p.x, p.z, 1.7)).toBe(false)
    expect(reservedByHomes(p.x, p.z, 2.2)).toBe(false)
    const d = Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z)
    expect(d).toBeGreaterThanOrEqual(9)
    expect(d).toBeLessThanOrEqual(15)
  })

  it('현관은 남쪽을 먼저 본다(카메라 기준)', () => {
    expect(pickHomePlot()!.rot).toBe(0)
  })

  it('같은 섬이면 늘 같은 자리다', () => {
    expect(pickHomePlot()).toEqual(pickHomePlot())
  })
})
