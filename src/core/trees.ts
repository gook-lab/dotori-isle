/**
 * 베어 넘긴 나무의 상태. 그루터기는 파내기 전까지 남고, 파낸 자리에 싹이 나서 며칠 뒤 다시 나무가 된다.
 * 날짜 키로만 정하므로 새로고침해도 같은 날엔 같은 모습이다.
 */

export type TreeState = 'tree' | 'stump' | 'sapling'

export interface Felling {
  state: 'stump' | 'sapling'
  /** 넘어간 날(그루터기) 또는 싹을 심은 날(싹) */
  day: string
}

export type Felled = Record<string, Felling>

/** 싹이 나무로 자라기까지 걸리는 날 수 */
export const REGROW_DAYS = 3

const toDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/** from 에서 to 까지 며칠 지났는지. 날짜 키가 없으면 NaN. */
export function dayGap(from: string, to: string): number {
  return toDay(to) - toDay(from)
}

export function treeState(id: string, felled: Felled, day: string): TreeState {
  const f = felled[id]
  if (!f) return 'tree'
  if (f.state === 'stump') return 'stump'
  return dayGap(f.day, day) >= REGROW_DAYS ? 'tree' : 'sapling'
}

/** 싹이 다 자라 다시 나무가 된 기록을 지운다(날이 바뀔 때 부른다). */
export function pruneRegrown(felled: Felled, day: string): Felled {
  const out: Felled = {}
  for (const [id, f] of Object.entries(felled)) if (treeState(id, felled, day) !== 'tree') out[id] = f
  return out
}
