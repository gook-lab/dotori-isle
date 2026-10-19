/**
 * 처음 여는 기능의 한 줄 안내. 기능마다 처음 한 번만 토스트로 알려 주고, 본 목록을 저장해 다시 띄우지 않는다.
 * 목록은 선택 저장 필드(seenHints)에 두고, 불러올 때 알 수 없는 값은 버린다.
 */

export const FIRST_HINTS = {
  atm: '🏧 도토리 ATM이에요. 처음이면 입출금 탭에서 통장에 넣어 보세요. 달마다 이자가 붙어요.',
  phone: '📱 휴대폰이에요. 앱을 누르면 그 창이 열리고, ` 키로 닫아요.',
  songi: '🍄 송이 상인이 왔어요. 송이는 10개 묶음(도토리 400개)으로 사고, 시세가 좋을 때 팔아요. 한 주에 세 묶음까지예요.',
  hall: '📻 마을회관이에요. 게시판에서 오늘 할 일을 보고, 마이크 책상에서 아침 마을 방송을 다시 들을 수 있어요.',
  bottle: '🍾 병 속에 편지나 지도 조각이 들어 있어요. 편지는 바로 읽고, 지도는 주머니에서 펼쳐요.',
  stow: '📦 가구를 넣을 때는 📦 버튼(키보드는 R)을 눌러요. 방금 놓은 가구는 3초 동안 조금 떨어져 있어도 바로 넣을 수 있어요.',
  // 정기 예금 첫 만기 때만 붙이는 꼬리 문장(deposit.ts depositMaturedLine)
  deposit: '입출금 탭에서 꺼내요.',
} as const

export type FirstHint = keyof typeof FIRST_HINTS

export function isFirstHint(v: unknown): v is FirstHint {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(FIRST_HINTS, v)
}

/** 불러온 본 목록을 검증한다. 배열이 아니거나 모르는 값은 버리고, 같은 값은 한 번만 남긴다. */
export function cleanSeenHints(v: unknown): FirstHint[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter(isFirstHint))]
}

/** 아직 안 본 안내면 문구와 갱신된 목록을 돌려준다. 이미 봤으면 null. */
export function firstHintOnce(seen: readonly FirstHint[], id: FirstHint): { text: string; seen: FirstHint[] } | null {
  if (seen.includes(id)) return null
  return { text: FIRST_HINTS[id], seen: [...seen, id] }
}
