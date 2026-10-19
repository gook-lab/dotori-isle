import { describe, expect, it } from 'vitest'
import { addDays } from './economy'
import { newlyOpened, type UnlockCtx } from './unlocks'

// 기본 퀘스트를 순서대로 하루에 하나씩 끝낸다고 가정한 진행 시뮬레이션.
// 도감은 하루에 한 종씩, 번 도토리는 하루 150씩 쌓는다고 본다.
const START = '2026-03-10' // 화요일 — 토요일 장날은 나흘째
const ORDER = ['welcome', 'dig', 'garden', 'materials', 'blossom', 'newcomer-guriguri', 'newcomer-dongri']

function simulate(days: number) {
  const introduced: string[] = []
  const opened: { day: number; ids: string[] }[] = []
  for (let d = 0; d < days; d++) {
    const ctx: UnlockCtx = {
      day: addDays(START, d) as string,
      islandStart: START,
      questsDone: ORDER.slice(0, d + 1),
      dexCount: d + 1,
      stats: { sold: 150 * (d + 1), spent: 0, questsDone: ORDER.slice(0, d + 1) },
    }
    const fresh = newlyOpened(ctx, introduced)
    fresh.forEach((f) => introduced.push(f.id))
    opened.push({ day: d, ids: fresh.map((f) => f.id) })
  }
  return opened
}

describe('첫 2주 열림 시뮬레이션', () => {
  const run = simulate(14)

  it('never opens more than two systems on the same day', () => {
    for (const { day, ids } of run) expect({ day, n: ids.length }.n, `day ${day}: ${ids.join(',')}`).toBeLessThanOrEqual(2)
  })

  it('opens nothing on the first day', () => {
    expect(run[0].ids).toEqual([])
  })

  it('opens the basic systems within the first two weeks, and leaves the big shop for later', () => {
    const all = new Set(run.flatMap((r) => r.ids))
    expect(all.size).toBe(8)
    // 큰 가게는 도토리 1만 개를 팔아야 해서 이 속도로는 두 주 안에 열리지 않는다
    expect(all.has('shop-2')).toBe(false)
  })
})
