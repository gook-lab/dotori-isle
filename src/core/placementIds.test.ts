import { describe, expect, it } from 'vitest'
import * as D from './daily'
import { inStepBlockAt, STEP_PAD } from './tiers'
import { ROCKS, TREES } from './world'
import { SCENERY } from './scenery'
import { PLACEMENT_HEAD } from './__fixtures__/placementHead'

/** HEAD 에서 뽑은 id→좌표 표(목록 이름:개수:id@x,z|…). 나무·바위·통나무·낮 줍기 목록의 기준이다. */
const HEAD = new Map(
  PLACEMENT_HEAD.split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, , items] = line.split(':', 3)
      return [name, items ? items.split('|') : []] as [string, string[]]
    }),
)
const rows = (list: { id?: string; x: number; z: number }[]) => list.map((t) => `${t.id ?? ''}@${t.x.toFixed(2)},${t.z.toFixed(2)}`)

/** 현재 목록은 HEAD 에서 계단 블록 자리 항목만 빠진 것이어야 한다. id 와 좌표는 그대로다. */
function expectSameExceptSteps(name: string, now: string[]) {
  const head = HEAD.get(name) ?? []
  const headSet = new Set(head)
  const nowSet = new Set(now)
  for (const row of now) expect(headSet.has(row), `${name} 새 항목 ${row}`).toBe(true)
  for (const row of head) {
    if (nowSet.has(row)) continue
    const [, xz] = row.split('@')
    const [x, z] = xz.split(',').map(Number)
    expect(inStepBlockAt(x, z, STEP_PAD), `${name} 제거된 ${row} 는 계단 자리여야 한다`).toBe(true)
  }
}

describe('배치 id 는 HEAD 와 같다(계단 자리 제거분 외)', () => {
  it('나무', () => expectSameExceptSteps('TREES', rows(TREES)))
  it('바위', () => expectSameExceptSteps('ROCKS', rows(ROCKS)))
  it('통나무·돌', () => expectSameExceptSteps('SCENERY', rows(SCENERY)))
  it('낮 줍기 조개·벌레·땅파기(첫 날, 다음 날)', () => {
    for (const key of ['2026-10-19', '2026-10-20']) {
      const L = D.generateDay(key)
      for (const k of ['shells', 'bugs', 'digs'] as const) {
        // 비 오는 날의 반짝이는 조약돌(core/rainStones.ts)은 HEAD 뒤에 생긴 항목이라 이 기준에서 뺀다. 나머지 id 와 좌표는 그대로다.
        const list = (L[k] as { id: string; x: number; z: number }[]).filter((t) => !t.id.includes('-rain-'))
        expectSameExceptSteps(`${key}${k}`, rows(list))
      }
    }
  })
})
