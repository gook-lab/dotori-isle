/**
 * 도감 완성 보상: 물고기·벌레·가구 분류를 처음 다 채우면 마일리지를 분류마다 한 번 준다.
 * 다 채웠는지는 도감 칸으로 본다(물고기·벌레는 잡아서 도감에 오른 종, 가구는 본 가구 목록).
 * 받은 분류는 `dexRewarded` 에 남긴다. 이 파일은 순수 판정만 하고, 지급과 저장은 store 가 맡는다.
 */
import { BUG_TABLE, FISH_TABLE, ITEMS } from './items'
import { FURNITURE_IDS } from './furnitureCatalog'

export type DexKind = 'fish' | 'bug' | 'furniture'

export const DEX_KINDS: readonly DexKind[] = ['fish', 'bug', 'furniture']
/** 분류를 처음 다 채우면 주는 마일리지 */
export const DEX_BONUS = 500
export const DEX_KIND_NAME: Record<DexKind, string> = { fish: '물고기', bug: '벌레', furniture: '가구' }

const KIND_IDS: Record<DexKind, readonly string[]> = {
  fish: FISH_TABLE.filter((f) => ITEMS[f.id].kind === 'fish').map((f) => f.id),
  bug: BUG_TABLE.map((b) => b.id),
  furniture: FURNITURE_IDS,
}

/** 분류의 모든 칸이 채워졌는지. 물고기·벌레는 도감 수가 0보다 커야 하고, 가구는 본 목록에 있어야 한다. */
export function dexKindDone(kind: DexKind, dex: Readonly<Record<string, number>>, seen: readonly string[]): boolean {
  const ids = KIND_IDS[kind]
  if (!ids.length) return false
  if (kind === 'furniture') return ids.every((id) => seen.includes(id))
  return ids.every((id) => (dex[id] ?? 0) > 0)
}

/** 지금 채워져 있지만 아직 보상을 받지 않은 분류 */
export function newDexRewards(rewarded: readonly DexKind[], dex: Readonly<Record<string, number>>, seen: readonly string[]): DexKind[] {
  return DEX_KINDS.filter((k) => !rewarded.includes(k) && dexKindDone(k, dex, seen))
}

/** 지금 다 채워진 분류 전부. 예전 저장을 옮길 때 보상 없이 채워 두는 데 쓴다. */
export function doneDexKinds(dex: Readonly<Record<string, number>>, seen: readonly string[]): DexKind[] {
  return DEX_KINDS.filter((k) => dexKindDone(k, dex, seen))
}

/** 저장 칸에서 알 수 있는 분류 이름만 남긴다. 깨진 값과 중복은 버린다. */
export function sanitizeDexRewards(raw: unknown): DexKind[] {
  if (!Array.isArray(raw)) return []
  return DEX_KINDS.filter((k) => raw.includes(k))
}
