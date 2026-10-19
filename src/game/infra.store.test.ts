import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBank } from '../core/bank'
import { BRIDGE_COST, BRIDGE_MAX, bridgeSpots, NO_INFRA, refundOf, STAIR_COST, stairSpots } from '../core/infra'
import { dateKey } from '../core/rng'
import { extraBridges } from '../core/waters'
import { extraRamps, PLATEAUS } from '../core/tiers'
import { migrateSave, useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())
const tomorrow = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return dateKey(d)
})()

beforeEach(() => {
  useGame.setState({ money: 2000, day: today, infra: NO_INFRA, bank: createBank(today), panel: null, inventory: [], tools: [], letters: [] })
  extraBridges.length = 0
  for (const k of Object.keys(extraRamps)) delete extraRamps[k]
})

describe('섬 정비 — 맡기기와 철거', () => {
  it('다리를 맡기면 도토리를 내고 다음 날부터 걸을 수 있다', () => {
    const [s] = bridgeSpots(NO_INFRA)
    expect(useGame.getState().commissionBridge(s.x, s.z, s.rot)).toBe(true)
    expect(useGame.getState().money).toBe(2000 - BRIDGE_COST)
    expect(useGame.getState().infra.bridges).toHaveLength(1)
    expect(extraBridges).toHaveLength(0)
    useGame.setState({ day: tomorrow })
    expect(extraBridges).toHaveLength(1)
  })

  it('돈이 모자라면 맡기지 못한다', () => {
    const [s] = bridgeSpots(NO_INFRA)
    useGame.setState({ money: BRIDGE_COST - 1 })
    expect(useGame.getState().commissionBridge(s.x, s.z, s.rot)).toBe(false)
    expect(useGame.getState().infra.bridges).toHaveLength(0)
  })

  it('다리는 네 개까지만 맡긴다', () => {
    const spots = bridgeSpots(NO_INFRA)
    let done = 0
    for (const s of spots) {
      if (useGame.getState().commissionBridge(s.x, s.z, s.rot)) done++
      if (done === BRIDGE_MAX) break
    }
    expect(done).toBe(BRIDGE_MAX)
    const [extra] = spots.slice(-1)
    expect(useGame.getState().commissionBridge(extra.x, extra.z, extra.rot)).toBe(false)
  })

  it('계단을 맡기면 다음 날 언덕 경사로가 된다', () => {
    const [s] = stairSpots(NO_INFRA)
    expect(useGame.getState().commissionStair(s.plateau, s.ang)).toBe(true)
    expect(useGame.getState().money).toBe(2000 - STAIR_COST)
    useGame.setState({ day: tomorrow })
    const id = PLATEAU_ID(s.plateau)
    expect(extraRamps[id]).toEqual([s.ang])
  })

  it('철거하면 절반을 돌려받고 다리가 사라진다', () => {
    const [s] = bridgeSpots(NO_INFRA)
    useGame.getState().commissionBridge(s.x, s.z, s.rot)
    const id = useGame.getState().infra.bridges[0].id
    const before = useGame.getState().money
    expect(useGame.getState().removeInfra(id)).toBe(true)
    expect(useGame.getState().money).toBe(before + refundOf(BRIDGE_COST))
    expect(useGame.getState().infra.bridges).toHaveLength(0)
  })
})

describe('섬 정비 — 저장 이주', () => {
  it('정비 기록이 없던 옛 저장을 빈 기록으로 이어 받는다', () => {
    const old = { ...useGame.getState(), infra: undefined, money: 5 }
    expect(migrateSave(old).infra).toEqual(NO_INFRA)
  })
})

const PLATEAU_ID = (i: number) => PLATEAUS[i].id
