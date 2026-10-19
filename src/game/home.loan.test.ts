import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dateKey } from '../core/rng'
import { HOME_ROOM, roomCenter } from '../core/interior'
import { findAction, runAction } from './actions'
import { runtime } from './runtime'
import { useGame } from './store'
import { NEW_SHOP } from '../core/shopTiers'
import { createBank } from '../core/bank'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())
const c = roomCenter(HOME_ROOM)

beforeEach(() => {
  runtime.seat = null
  runtime.fishing = { phase: 'idle' }
  runtime.act = null
  useGame.setState({
    panel: null,
    placing: null,
    homePlacing: null,
    inHome: false,
    money: 500,
    inventory: [],
    letters: [],
    home: { stage: 0, loan: 100, order: null },
    homeFurniture: [],
    bank: createBank(today),
    day: today,
    // 섬 시작일이 남아 있으면 2일차 조개 편지가 끼어든다. 대출 테스트에는 필요 없으니 비운다.
    islandStart: null,
    shop: NEW_SHOP,
    stats: {},
  })
})

describe('repaying the home loan', () => {
  it('a partial payment keeps the loan and sends no letter', () => {
    useGame.getState().repayFromPocket(40)
    const s = useGame.getState()
    expect(s.home.loan).toBe(60)
    expect(s.letters).toEqual([])
  })

  it('paying the last of it sends a next-home letter once', () => {
    useGame.getState().repayFromPocket(100)
    let s = useGame.getState()
    expect(s.home.loan).toBe(0)
    expect(s.letters.map((l) => l.id)).toEqual([`loan-paid-${today}`])
    expect(s.letters[0].text).toContain('작은 집')
    // 같은 날 다시 불러도 편지는 한 통이다
    useGame.getState().loanCleared()
    s = useGame.getState()
    expect(s.letters).toHaveLength(1)
  })
})

describe('home furniture is used from inside the room', () => {
  it('a placed chair offers 앉기 with R to put it away, and E sits in world coordinates', () => {
    useGame.setState({ inHome: true, homeFurniture: [{ id: 'h1', itemId: 'chair', x: 0, z: 0, rot: 0 }] })
    runtime.player.x = c.x + 0.4
    runtime.player.z = c.z + 0.2
    const a = findAction()
    expect(a?.kind).toBe('home-use')
    expect(a?.label).toBe('나무 의자에 앉기 · R 넣기')
    if (a?.kind !== 'home-use') throw new Error('no home-use')
    runAction(a)
    expect(runtime.seat?.id).toBe('h1')
    expect(runtime.seat?.x).toBeCloseTo(c.x)
    expect(runtime.seat?.z).toBeCloseTo(c.z)
  })

  it('a placed lamp toggles on and off', () => {
    useGame.setState({ inHome: true, homeFurniture: [{ id: 'h2', itemId: 'lamp', x: 0, z: 0, rot: 0 }] })
    runtime.player.x = c.x
    runtime.player.z = c.z
    const a = findAction()
    if (a?.kind !== 'home-use') throw new Error('no home-use')
    expect(a.use).toBe('light')
    runAction(a)
    expect(useGame.getState().homeFurniture[0].off).toBe(true)
    runAction(a)
    expect(useGame.getState().homeFurniture[0].off).toBeFalsy()
  })

  it('a flowerpot is patted with E, and R still puts it away', () => {
    useGame.setState({ inHome: true, homeFurniture: [{ id: 'h3', itemId: 'flowerpot', x: 0, z: 0, rot: 0 }] })
    runtime.player.x = c.x
    runtime.player.z = c.z
    expect(findAction()?.kind).toBe('home-act')
    useGame.getState().pickUpHome('h3')
    expect(useGame.getState().homeFurniture).toEqual([])
  })
})
