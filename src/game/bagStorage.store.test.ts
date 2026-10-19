import { beforeEach, describe, expect, it } from 'vitest'
import { INVENTORY_SIZE } from '../core/inventory'
import { storageSlots } from '../core/home'
import { useGame } from './store'

/** 주머니를 꽉 채운다. 서로 다른 변형을 달아 칸이 합쳐지지 않게 한다. */
function fillBag() {
  useGame.setState({
    inventory: Array.from({ length: INVENTORY_SIZE }, (_, i) => ({ id: 'chair', count: 1, variant: `v${i}` })),
    pocket: INVENTORY_SIZE,
  })
}

/** 알림 문구만 모은다(토스트는 줄 세워져 이전 테스트 문구가 남을 수 있다) */
let texts: string[] = []
function capture() {
  texts = []
  useGame.setState({ notify: (t: string) => { texts.push(t) } } as never)
}

describe('주머니가 가득 찼을 때 보관함 안내', () => {
  beforeEach(() => {
    useGame.setState({ panel: null, inHome: false, homeStorage: [] })
    capture()
  })

  it('보관함에 빈 칸이 있으면 보관함에 넣을 수 있다고 알린다', () => {
    fillBag()
    useGame.getState().collectShell({ id: 'bag-full-1', itemId: 'conch', x: 0, z: 0 })
    expect(texts).toContain('주머니가 가득 찼어요. 집에 가면 보관함에 넣을 수 있어요')
    expect(useGame.getState().bagFullAt).toBeGreaterThan(0)
    // 집 밖이면 패널은 열리지 않는다
    expect(useGame.getState().panel).toBeNull()
  })

  it('집 안이면 보관함 패널을 바로 연다', () => {
    fillBag()
    useGame.setState({ inHome: true })
    useGame.getState().collectShell({ id: 'bag-full-2', itemId: 'conch', x: 0, z: 0 })
    expect(texts).toContain('주머니가 가득 찼어요. 집 보관함에 넣을 수 있어요')
    expect(useGame.getState().panel).toBe('storage')
  })

  it('보관함도 꽉 찼으면 기존 안내를 그대로 쓴다', () => {
    fillBag()
    const { home } = useGame.getState()
    const full = Array.from({ length: storageSlots(home.stage) }, (_, i) => ({ id: 'chair', count: 1, variant: `s${i}` }))
    useGame.setState({ homeStorage: full, inHome: true })
    useGame.getState().collectShell({ id: 'bag-full-3', itemId: 'conch', x: 0, z: 0 })
    expect(texts.some((t) => t.startsWith('주머니가 가득 찼어요'))).toBe(true)
    expect(texts.some((t) => t.includes('집 보관함에 넣을 수 있어요'))).toBe(false)
    expect(useGame.getState().panel).toBeNull()
  })
})
