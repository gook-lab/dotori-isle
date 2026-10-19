import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUG_TABLE, FISH_TABLE, ITEMS } from '../core/items'
import { DEX_BONUS } from '../core/dexReward'
import { migrateSave, useGame } from './store'

const fishIds = FISH_TABLE.filter((f) => ITEMS[f.id].kind === 'fish').map((f) => f.id)
const bugIds = BUG_TABLE.map((b) => b.id)
const all = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, 1]))

describe('도감 완성 보상 지급', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ dex: {}, furnitureSeen: [], dexRewarded: [], miles: 0, toast: null, toastQueue: [] })
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('물고기를 다 채우면 마일리지를 한 번 주고 토스트를 띄운다', () => {
    useGame.setState({ dex: all(fishIds) })
    const s = useGame.getState()
    expect(s.dexRewarded).toEqual(['fish'])
    expect(s.miles).toBe(DEX_BONUS)
    // 마일 토스트는 1.5초 창이 지나야 뜬다(전시관 편지 알림이 먼저 올 수 있어 큐 전체를 본다)
    vi.advanceTimersByTime(1500)
    const shown = [useGame.getState().toast, ...useGame.getState().toastQueue].map((t) => t?.text)
    expect(shown).toContain(`🏅 +${DEX_BONUS}마일 · 도감 완성`)
  })

  it('한 번 받은 분류는 도감을 다시 건드려도 또 주지 않는다', () => {
    useGame.setState({ dex: all(fishIds) })
    useGame.setState({ dex: { ...all(fishIds), extra: 1 } })
    expect(useGame.getState().miles).toBe(DEX_BONUS)
    expect(useGame.getState().dexRewarded).toEqual(['fish'])
  })

  it('아직 덜 채웠으면 주지 않는다', () => {
    const dex = all(fishIds)
    delete dex[fishIds[0]]
    useGame.setState({ dex })
    expect(useGame.getState().miles).toBe(0)
    expect(useGame.getState().dexRewarded).toEqual([])
  })

  it('벌레 도감을 채우면 벌레 보상을 따로 준다', () => {
    useGame.setState({ dex: all(bugIds) })
    expect(useGame.getState().dexRewarded).toEqual(['bug'])
    expect(useGame.getState().miles).toBe(DEX_BONUS)
  })
})

describe('도감 보상 예전 저장 옮기기', () => {
  it('저장 칸이 없으면 지금 채워진 분류를 보상 없이 받은 것으로 채운다', () => {
    const s = migrateSave({ dex: { ...all(fishIds), ...all(bugIds) }, miles: 10, day: '2026-10-19', inventory: [] })
    expect(s.dexRewarded).toEqual(['fish', 'bug'])
    expect(s.miles).toBe(10)
  })

  it('저장 칸이 있으면 그대로 옮긴다(깨진 값은 버린다)', () => {
    const s = migrateSave({ dex: {}, dexRewarded: ['furniture', 'nope'], day: '2026-10-19', inventory: [] })
    expect(s.dexRewarded).toEqual(['furniture'])
  })
})
