import { beforeEach, describe, expect, it } from 'vitest'
import { letterFor, letterId, mapId, parseMapId, TREASURE_MONEY } from '../core/bottle'
import { useGame } from './store'

const shellFor = (id: string) => ({ id, itemId: 'bottle', x: 60, z: 0 }) as never
const findSeed = (wantMap: boolean) => {
  for (let i = 0; i < 500; i++) {
    const seed = `bottle-${i}`
    if (letterFor(seed).map === wantMap) return seed
  }
  throw new Error('no seed')
}

beforeEach(() => {
  useGame.setState({ inventory: [], collected: [], money: 100 })
})

describe('유리병과 보물 지도', () => {
  it('편지 병은 편지를 주고 편지 글을 자막으로 띄운다', () => {
    const seed = findSeed(false)
    useGame.getState().collectShell(shellFor(seed))
    const s = useGame.getState()
    expect(s.inventory.map((x) => x.id)).toEqual([letterId(letterFor(seed).index)])
    expect(s.caption?.text).toBe(letterFor(seed).text)
    expect(s.collected).toContain(seed)
  })

  it('지도 조각 병은 목표 칸이 적힌 지도를 준다', () => {
    const seed = findSeed(true)
    useGame.getState().collectShell(shellFor(seed))
    const ids = useGame.getState().inventory.map((x) => x.id)
    expect(ids.length).toBe(1)
    expect(parseMapId(ids[0])).not.toBeNull()
  })

  it('보물 지도로 파면 지도가 없어지고 도토리나 가구가 나온다', () => {
    useGame.setState({ inventory: [{ id: mapId(10, 10), count: 1 }] })
    useGame.getState().digTreasure(mapId(10, 10))
    const s = useGame.getState()
    expect(s.inventory.some((x) => x.id === mapId(10, 10))).toBe(false)
    const gained = s.money - 100
    const gotItem = s.inventory.length > 0
    expect(gained === TREASURE_MONEY || gotItem).toBe(true)
  })
})
