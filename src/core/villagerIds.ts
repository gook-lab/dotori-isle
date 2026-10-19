/**
 * 예전 저장의 주민 id 를 새 id 로 옮긴다. 꼬마 주민 여섯의 이름과 id 를 바꾸면서,
 * 저장 곳곳(집 목록·우정·편지·증축 기록 등)에 남은 옛 id 를 새 id 로 바꾼다.
 * 글자 값과 객체 키를 모두 훑고, `birthday-chiikawa-2026` 처럼 id 가 섞인 글도 단어 경계로 바꾼다.
 * 이미 새 id 인 저장은 그대로 돌려준다.
 */

export const LEGACY_VILLAGER_IDS: Readonly<Record<string, string>> = {
  chiikawa: 'somi',
  hachiware: 'soda',
  usagi: 'yuja',
  momonga: 'bori',
  kurimanju: 'maro',
  rakko: 'coco',
}

const LEGACY_RE = new RegExp(`\\b(${Object.keys(LEGACY_VILLAGER_IDS).join('|')})\\b`, 'g')

function renameText(s: string): string {
  return s.replace(LEGACY_RE, (m) => LEGACY_VILLAGER_IDS[m])
}

/** 저장 값 전체를 훑어 옛 주민 id 를 새 id 로 바꾼 사본을 돌려준다. */
export function migrateVillagerIds(v: unknown): unknown {
  if (typeof v === 'string') return renameText(v)
  if (Array.isArray(v)) return v.map(migrateVillagerIds)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[renameText(k)] = migrateVillagerIds(x)
    return out
  }
  return v
}
