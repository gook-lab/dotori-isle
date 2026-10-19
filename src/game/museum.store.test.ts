import { beforeEach, describe, expect, it, vi } from 'vitest'
import { roomSolids } from '../core/interior'
import { createBank } from '../core/bank'
import { dateKey } from '../core/rng'
import { museumLayout, museumSolids, MUSEUM_SITE } from '../core/museum'
import { migrateSave, useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())
const dexOf = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]))
const TEN = ['sea-bass', 'mackerel', 'carp', 'catfish', 'dace', 'ladybug', 'honeybee', 'cicada', 'fossil', 'squid']

beforeEach(() => {
  useGame.setState({
    panel: null,
    inMuseum: false,
    dex: dexOf(...TEN),
    inventory: [{ id: 'sea-bass', count: 1 }],
    museum: [],
    miles: 0,
    money: 0,
    letters: [],
    bank: createBank(today),
    day: today,
    doorFade: false,
  })
})

describe('전시관 기증', () => {
  it('donates one fish out of the pocket, pays the miles, and shows it on the exhibit', () => {
    useGame.getState().donate('sea-bass')
    const s = useGame.getState()
    expect(s.museum).toEqual(['sea-bass'])
    expect(s.inventory).toEqual([])
    expect(s.miles).toBe(20)
    expect(roomSolids.museum).toEqual(museumSolids(museumLayout(['sea-bass'])))
  })

  it('refuses a second donation of the same species, and a species not in the pocket', () => {
    useGame.getState().donate('sea-bass')
    useGame.getState().donate('sea-bass')
    expect(useGame.getState().museum).toEqual(['sea-bass'])
    expect(useGame.getState().miles).toBe(20)
    useGame.getState().donate('mackerel')
    expect(useGame.getState().museum).toEqual(['sea-bass'])
  })

  it('the door opens only once the museum is open, and the room is entered with the fade', () => {
    if (!MUSEUM_SITE) return
    useGame.setState({ dex: dexOf(...TEN.slice(0, 3)) })
    useGame.getState().enterMuseum()
    expect(useGame.getState().doorFade).toBe(false)
    useGame.setState({ dex: dexOf(...TEN) })
    useGame.getState().enterMuseum()
    expect(useGame.getState().doorFade).toBe(true)
  })
})

describe('저장 v7 마이그레이션', () => {
  it('an old save without the museum gets an empty list', () => {
    expect(migrateSave({ day: today, money: 5 }).museum).toEqual([])
  })

  it('keeps only known donated ids', () => {
    expect(migrateSave({ day: today, museum: ['sea-bass', 'peach', 'sea-bass', 'fossil'] }).museum).toEqual(['sea-bass', 'fossil'])
  })

  it('keeps tide-pool creatures in a saved donation list', () => {
    expect(migrateSave({ day: today, museum: ['tide-crab', 'tide-starfish'] }).museum).toEqual(['tide-crab', 'tide-starfish'])
  })
})
