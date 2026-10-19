/**
 * 도감 화면을 위한 순수 계산. 탭마다 진행도와 "지금 기증할 수 있는 종"을 구한다.
 */

import { canDonate } from './museum'

export interface DexProgress {
  found: number
  total: number
  /** 0~100 정수 */
  pct: number
}

/** 도감에 오른 종 수와 비율. 빈 목록이면 0% 다. */
export function dexProgress(ids: readonly string[], dex: Record<string, number>): DexProgress {
  const total = ids.length
  const found = ids.filter((id) => dex[id] > 0).length
  return { found, total, pct: total ? Math.round((found / total) * 100) : 0 }
}

/** 지금 기증할 수 있는 종만 고른다: 도감에 오르고, 주머니에 있고, 아직 전시관에 없는 것. */
export function donorIds(ids: readonly string[], dex: Record<string, number>, donated: readonly string[], inventory: readonly { id: string; count: number }[]): string[] {
  return ids.filter((id) => canDonate(id, dex, donated, inventory.find((i) => i.id === id)?.count ?? 0).ok)
}
