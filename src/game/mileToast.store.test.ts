import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUG_TABLE, FISH_TABLE, ITEMS } from '../core/items'
import { DONATABLE, DONATION_MILES, MUSEUM_DEX } from '../core/museum'
import { gainMileToast, useGame } from './store'

// 짧은 사이에 쌓인 마일은 한 토스트로 합쳐 뜬다. 0 이하는 토스트를 띄우지 않는다.
describe('마일 토스트 묶음', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ toast: null, toastQueue: [], inHome: false, dialog: null, panel: null })
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('1.5초 안에 쌓인 같은 이유는 횟수를 더해 한 줄로 띄운다', () => {
    gainMileToast(10, '할 일', '개', 1)
    gainMileToast(20, '할 일', '개', 2)
    expect(useGame.getState().toast).toBeNull()
    vi.advanceTimersByTime(1500)
    expect(useGame.getState().toast?.text).toBe('🏅 +30마일 · 할 일 3개')
  })

  it('다른 이유도 같은 창 안이면 한 줄에 함께 적는다', () => {
    gainMileToast(50, '집 꾸미기 점수')
    gainMileToast(150, '섬 평가 보상')
    vi.advanceTimersByTime(1500)
    expect(useGame.getState().toast?.text).toBe('🏅 +200마일 · 집 꾸미기 점수 · 섬 평가 보상')
  })

  it('창이 끝난 뒤의 마일은 새 토스트가 된다', () => {
    gainMileToast(10, '할 일')
    vi.advanceTimersByTime(1500)
    useGame.setState({ toast: null })
    gainMileToast(40, '섬 평가 보상')
    vi.advanceTimersByTime(1500)
    expect(useGame.getState().toast?.text).toBe('🏅 +40마일 · 섬 평가 보상')
  })

  it('0 이하의 마일은 토스트를 띄우지 않는다', () => {
    gainMileToast(0, '할 일')
    gainMileToast(-5, '할 일')
    vi.advanceTimersByTime(1500)
    expect(useGame.getState().toast).toBeNull()
  })
})

// 실제 자리에서 몰리는 경우: 전시관 기증 여러 건과 도감 분류 연달아 채우기가 한 줄로 합쳐진다
describe('마일 토스트 실제 흐름', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGame.setState({ toast: null, toastQueue: [], inHome: false, dialog: null, panel: null })
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('전시관 기증 3건은 한 줄에 건수와 합계로 합친다', () => {
    // 도감이 열려 있어야 기증할 수 있다
    const ids = DONATABLE.slice(0, 3)
    const dex = Object.fromEntries([...ids, ...Array.from({ length: MUSEUM_DEX }, (_, i) => `dex-${i}`)].map((id) => [id, 1]))
    useGame.setState({ dex, museum: [], inventory: ids.map((id) => ({ id, count: 1 })), miles: 0, toast: null, toastQueue: [] })
    for (const id of ids) useGame.getState().donate(id)
    vi.advanceTimersByTime(1500)
    // 전시관 편지 알림이 먼저 뜨므로 화면 줄과 큐를 함께 본다
    const shown = [useGame.getState().toast, ...useGame.getState().toastQueue].map((t) => t?.text)
    expect(shown).toContain(`🏅 +${DONATION_MILES * 3}마일 · 박물관 기증 3건`)
  })

  it('도감 분류를 연달아 채우면 분류 수를 합쳐서 보여 준다', () => {
    const fish = Object.fromEntries(FISH_TABLE.filter((f) => ITEMS[f.id].kind === 'fish').map((f) => [f.id, 1]))
    useGame.setState({ dex: fish, dexRewarded: [], furnitureSeen: [], miles: 0, toast: null, toastQueue: [] })
    expect(useGame.getState().dexRewarded).toEqual(['fish'])
    const bug = Object.fromEntries(BUG_TABLE.map((b) => [b.id, 1]))
    useGame.setState({ dex: { ...fish, ...bug } })
    expect(useGame.getState().dexRewarded).toEqual(['fish', 'bug'])
    vi.advanceTimersByTime(1500)
    const shown = [useGame.getState().toast, ...useGame.getState().toastQueue].map((t) => t?.text)
    expect(shown).toContain('🏅 +1,000마일 · 도감 완성 2분류')
  })
})
