import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBank } from '../core/bank'
import { DONATABLE, donationKind } from '../core/museum'
import { dateKey } from '../core/rng'
import { TOAST_QUEUE_MAX, useGame } from './store'

// 실행한 날에 기대지 않도록 날짜를 고정한다(요일·월말·날씨가 날마다 달라 테스트가 흔들리지 않게)
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-21T12:00:00'))

const today = dateKey(new Date())
const fossils = DONATABLE.filter((id) => donationKind(id) === 'fossil')
const last = fossils[fossils.length - 1]
const dexAll = Object.fromEntries(fossils.map((id) => [id, 1]))

beforeEach(() => {
  useGame.setState({
    panel: null,
    dex: dexAll,
    inventory: [{ id: last, count: 1 }],
    museum: fossils.slice(0, -1),
    miles: 0,
    bank: createBank(today),
    day: today,
    toast: null,
    toastQueue: [],
  })
})

describe('박물관 구역 완성 보너스 알림', () => {
  it('구역을 채우면 기증 알림 뒤에 보너스 알림이 큐에 붙는다', () => {
    useGame.getState().donate(last)
    const s = useGame.getState()
    const texts = [s.toast?.text, ...s.toastQueue.map((t) => t.text)]
    expect(texts[0]).toContain('구역을 다 채웠어요')
    expect(texts[0]).toContain('🏅 200마일')
  })

  it('큐가 가득 차 있어도 보너스 알림은 마지막에 붙어 밀려나지 않는다', () => {
    const filler = Array.from({ length: TOAST_QUEUE_MAX }, (_, i) => ({ id: 900 + i, text: `대기 ${i}` }))
    useGame.setState({ toast: { id: 899, text: '먼저 뜬 알림' }, toastQueue: filler })
    useGame.getState().donate(last)
    const queue = useGame.getState().toastQueue.map((t) => t.text)
    expect(queue.length).toBe(TOAST_QUEUE_MAX)
    expect(queue[queue.length - 1]).toContain('구역을 다 채웠어요')
  })
})
