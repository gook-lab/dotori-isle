import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HOME_SETS } from '../core/homeScore'
import { NEW_HOME } from '../core/home'
import { play } from './sfx'
import { useGame } from './store'

// 효과음 호출만 본다. 실제 소리는 내지 않는다.
vi.mock('./sfx', async (orig) => ({ ...(await orig<typeof import('./sfx')>()), play: vi.fn() }))

const fresh = useGame.getState()
const tea = HOME_SETS.find((s) => s.id === 'tea')!

beforeEach(() => {
  vi.mocked(play).mockClear()
  useGame.setState({ ...fresh, homeFurniture: [], setsDone: [], home: NEW_HOME, inHome: true, toast: null })
})

describe('세트 완성 효과음', () => {
  it('세트를 처음 완성하면 success 효과음을 한 번 낸다', () => {
    const ids = [...tea.items]
    useGame.setState({ homeFurniture: ids.slice(0, 2).map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) })
    expect(play).not.toHaveBeenCalled()
    useGame.setState({ homeFurniture: [...useGame.getState().homeFurniture, { id: 't2', itemId: ids[2], x: 0, z: 0, rot: 0 }] })
    expect(play).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledWith('success')
  })

  it('이미 완성된 세트를 다시 놓아도 소리를 내지 않는다', () => {
    useGame.setState({ setsDone: ['tea'], homeFurniture: [...tea.items].map((itemId, i) => ({ id: `t${i}`, itemId, x: 0, z: 0, rot: 0 })) })
    useGame.setState({ homeFurniture: [...useGame.getState().homeFurniture] })
    expect(play).not.toHaveBeenCalled()
  })
})
