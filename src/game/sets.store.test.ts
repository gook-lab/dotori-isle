import { beforeEach, describe, expect, it } from 'vitest'
import { formatMiles } from '../core/miles'
import { HOME_SETS, SET_MILES } from '../core/homeScore'
import { NEW_HOME } from '../core/home'
import { migrateSave, useGame } from './store'

const fresh = useGame.getState()
const tea = HOME_SETS.find((s) => s.id === 'tea')!
const toasts = () => useGame.getState().toast?.text ?? null

beforeEach(() => {
  useGame.setState({ ...fresh, homeFurniture: [], setsDone: [], home: NEW_HOME, inHome: true, toast: null })
})

describe('세트 완성 알림', () => {
  it('announces a set once, when its last piece is placed', () => {
    const ids = [...tea.items]
    useGame.setState({ homeFurniture: ids.slice(0, 2).map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) })
    expect(useGame.getState().setsDone).toEqual([])
    useGame.setState({ homeFurniture: [...useGame.getState().homeFurniture, { id: 't2', itemId: ids[2], x: 0, z: 0, rot: 0 }] })
    expect(useGame.getState().setsDone).toEqual(['tea'])
    expect(toasts()).toContain(`'${tea.name}' 세트를 완성했어요`)
  })

  it('does not announce again after the set is kept or re-placed', () => {
    useGame.setState({ setsDone: ['tea'], homeFurniture: [...tea.items].map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) })
    useGame.setState({ homeFurniture: [...useGame.getState().homeFurniture] })
    expect(useGame.getState().setsDone).toEqual(['tea'])
    expect(toasts()).toBeNull()
  })

  it('old saves start with the sets already complete, so nothing is announced at once', () => {
    const save = { homeFurniture: [...tea.items].map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) }
    expect(migrateSave(save).setsDone).toEqual(['tea'])
  })
})

describe('세트 완성 마일', () => {
  it('pays the set mile once, when the set is first completed', () => {
    const before = useGame.getState().miles
    useGame.setState({ homeFurniture: [...tea.items].map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) })
    expect(useGame.getState().miles).toBe(before + SET_MILES)
    expect(toasts()).toContain(`'${tea.name}' 세트를 완성했어요 · 🏅 ${formatMiles(SET_MILES)}`)
  })

  it('does not pay again when the same set is re-placed', () => {
    useGame.setState({ setsDone: ['tea'], miles: 100, homeFurniture: [] })
    useGame.setState({ homeFurniture: [...tea.items].map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) })
    expect(useGame.getState().miles).toBe(100)
  })

  it('old saves with a finished set do not get a retroactive mile', () => {
    expect(migrateSave({ homeFurniture: [...tea.items].map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) }).setsDone).toEqual(['tea'])
  })
})
