import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOOM, type Plant } from '../core/garden'
import { canPlace } from '../core/placement'
import { useGame } from './store'

// 섬 위 풀밭에서 옆칸 쌍 자리를 찾는다. 같은 날짜 키에서는 교배 굴림이 항상 같다(날짜로 시드).
// 주황+보라 쌍을 많이 깔아 희귀색(하늘색)이 확실히 나오게 한다.
const pairs = (): Plant[] => {
  const out: Plant[] = []
  for (let x = -30; x < 30 && out.length < 56; x += 3) {
    for (let z = -30; z < 30 && out.length < 56; z++) {
      if (!canPlace(x, z, [], []) || !canPlace(x + 1, z, [], [])) continue
      const n = out.length / 2
      out.push({ id: `a${n}`, x, z, color: '#ff9f68', stage: BLOOM, watered: true })
      out.push({ id: `b${n}`, x: x + 1, z, color: '#c77dff', stage: BLOOM, watered: true })
    }
  }
  return out
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12))
  useGame.setState({ day: '2026-10-19', plants: pairs(), goldCan: true, dex: {}, letters: [], ground: [], placed: [], felled: {}, holes: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('꽃 교배 — 날이 바뀔 때', () => {
  it('물 준 쌍에서 희귀색이 피면 도감에 오르고 편지가 한 통 온다', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 6))
    useGame.getState().syncClock()
    const s = useGame.getState()
    expect(s.plants.some((p) => p.color === '#7fd3ff')).toBe(true)
    expect(s.dex['flower-sky']).toBeGreaterThan(0)
    expect(s.letters.filter((l) => l.id === 'breed-flower-sky').length).toBe(1)
  })

  it('두 번째로 피어도 편지는 다시 오지 않는다', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 6))
    useGame.getState().syncClock()
    const first = useGame.getState().dex['flower-sky']
    useGame.setState({ plants: pairs() })
    vi.setSystemTime(new Date(2026, 9, 21, 6))
    useGame.getState().syncClock()
    expect(useGame.getState().dex['flower-sky']).toBeGreaterThan(first)
    expect(useGame.getState().letters.filter((l) => l.id === 'breed-flower-sky').length).toBe(1)
  })

  it('물을 주지 않은 꽃끼리는 새 꽃이 나지 않는다', () => {
    useGame.setState({ plants: pairs().map((p) => ({ ...p, watered: false })) })
    vi.setSystemTime(new Date(2026, 9, 20, 6))
    useGame.getState().syncClock()
    expect(useGame.getState().plants.length).toBe(pairs().length)
    expect(useGame.getState().dex['flower-sky']).toBeUndefined()
  })
})
