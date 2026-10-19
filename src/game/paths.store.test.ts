import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBank } from '../core/bank'
import { NO_INFRA, type Infra } from '../core/infra'
import { PERMIT_COST, PERMIT_MILES } from '../core/paths'
import { dateKey } from '../core/rng'
import { migrateSave, useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())

beforeEach(() => {
  useGame.setState({ money: 2000, miles: 100, day: today, infra: NO_INFRA, bank: createBank(today), panel: null, inventory: [], tools: [], letters: [] })
})

describe('길 공사 허가', () => {
  it('도토리로 사면 허가가 서고 돈이 빠진다', () => {
    expect(useGame.getState().buyPathPermit('acorn')).toBe(true)
    expect(useGame.getState().infra.permit).toBe(true)
    expect(useGame.getState().money).toBe(2000 - PERMIT_COST)
  })

  it('마일리지로 사면 마일이 빠진다', () => {
    expect(useGame.getState().buyPathPermit('miles')).toBe(true)
    expect(useGame.getState().miles).toBe(100 - PERMIT_MILES)
    expect(useGame.getState().money).toBe(2000)
  })

  it('두 번 사거나 돈이 모자라면 사지 않는다', () => {
    useGame.setState({ money: 10 })
    expect(useGame.getState().buyPathPermit('acorn')).toBe(false)
    useGame.setState({ money: 2000 })
    expect(useGame.getState().buyPathPermit('acorn')).toBe(true)
    expect(useGame.getState().buyPathPermit('acorn')).toBe(false)
  })
})

describe('길 깔기와 저장', () => {
  it('같은 칸을 두 번 누르면 놓았다가 걷는다', () => {
    useGame.getState().paintPath(4, -1, 'stone')
    expect(useGame.getState().infra.paths).toBe('4,-1s')
    useGame.getState().paintPath(4, -1, 'stone')
    expect(useGame.getState().infra.paths).toBe('')
  })

  it('철거해도 허가와 길은 남는다', () => {
    const infra: Infra = { ...NO_INFRA, permit: true, paths: '1,1d', bridges: [{ id: 'b', x: 0, z: 0, rot: 0, ordered: '2026-10-01' }] }
    useGame.setState({ infra })
    expect(useGame.getState().removeInfra('b')).toBe(true)
    expect(useGame.getState().infra.permit).toBe(true)
    expect(useGame.getState().infra.paths).toBe('1,1d')
  })
})

describe('길 저장 이주', () => {
  it('길 기록이 없던 저장은 허가 없이 빈 길로 받는다', () => {
    const old = { ...useGame.getState(), infra: { bridges: [], stairs: [] } }
    expect(migrateSave(old).infra).toEqual(NO_INFRA)
  })

  it('깨진 길 기록은 걸러서 받는다', () => {
    const old = { ...useGame.getState(), infra: { bridges: [], stairs: [], permit: 1, paths: '1,1d;bad' } }
    expect(migrateSave(old).infra).toEqual({ ...NO_INFRA, paths: '1,1d' })
  })
})
