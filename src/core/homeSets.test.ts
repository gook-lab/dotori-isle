import { describe, expect, it } from 'vitest'
import { completedSetIds, HOME_SETS, newlyCompletedSets, setGainIfDone, setProgress } from './homeScore'

const pieces = (ids: string[]) => ids.map((itemId) => ({ itemId }))
const tea = HOME_SETS.find((s) => s.id === 'tea')!

describe('가구 세트 진행', () => {
  it('counts owned pieces per set, across floors (no floor field needed)', () => {
    const p = setProgress(pieces(['table', 'chair']))
    const t = p.find((x) => x.id === 'tea')!
    expect(t.owned).toBe(2)
    expect(t.total).toBe(3)
    expect(t.done).toBe(false)
  })

  it('names the pieces still missing, and none once the set is done', () => {
    const t = setProgress(pieces(['table'])).find((x) => x.id === 'tea')!
    expect(t.missing).toEqual(['chair', 'flowerpot'])
    expect(setProgress(pieces([...tea.items])).find((x) => x.id === 'tea')!.missing).toEqual([])
  })

  it('lists a set as complete once every piece is placed', () => {
    expect(completedSetIds(pieces([...tea.items]))).toEqual(['tea'])
  })

  it('reports only sets that were not announced yet as newly complete', () => {
    const furniture = pieces([...tea.items])
    expect(newlyCompletedSets([], furniture)).toEqual(['tea'])
    expect(newlyCompletedSets(['tea'], furniture)).toEqual([])
  })

  it('does not announce a set that is only partly placed', () => {
    expect(newlyCompletedSets([], pieces(['table', 'chair']))).toEqual([])
  })
})

describe('서재·지하 작업실 세트', () => {
  const study = HOME_SETS.find((s) => s.id === 'study')!
  const workshop = HOME_SETS.find((s) => s.id === 'workshop')!

  it('서재는 책장·독서 의자·스탠드·지구본 네 가지를 다 놓아야 완성된다', () => {
    expect(study.items).toEqual(['bookshelf', 'reading-chair', 'floor-lamp', 'globe'])
    expect(newlyCompletedSets([], pieces(study.items.slice(0, 3)))).toEqual([])
    expect(newlyCompletedSets([], pieces([...study.items]))).toEqual(['study'])
  })

  it('지하 작업실은 작업대·공구 벽걸이·저장 선반·보일러를 다 놓아야 완성된다', () => {
    expect(workshop.items).toEqual(['workbench', 'tool-rack', 'storage-shelf', 'boiler'])
    expect(completedSetIds(pieces([...workshop.items]))).toEqual(['workshop'])
  })
})

describe('세트 완성 점수 — 칸이 실제로 오르는 만큼만', () => {
  const cabin = HOME_SETS.find((s) => s.id === 'cabin')!

  it('첫 세트는 8점을 더한다', () => {
    expect(setGainIfDone([], 'tea')).toBe(8)
  })

  it('세 번째 세트는 칸 상한 20에 막혀 같은 색이 없으면 4점만 더한다', () => {
    const furniture = pieces([...tea.items, ...cabin.items])
    expect(setGainIfDone(furniture, 'festival')).toBe(4)
  })

  it('같은 색까지 채운 상태에서 세 번째 세트를 완성하면 0점이다', () => {
    const furniture = [...pieces([...tea.items, ...cabin.items]), ...[0, 1, 2].map(() => ({ itemId: 'table', variant: 'red' }))]
    expect(setGainIfDone(furniture, 'festival')).toBe(0)
  })

  it('이미 완성한 세트는 0점이다', () => {
    expect(setGainIfDone(pieces([...tea.items]), 'tea')).toBe(0)
  })
})
