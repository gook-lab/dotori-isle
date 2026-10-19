/**
 * 아침 알림 정리. 날이 넘어갈 때 한꺼번에 쌓이는 알림 중 토스트로 띄울 것과
 * 휴대폰 알림 목록으로만 보낼 것을 가른다. 순수 함수라 화면 없이 세 수 있다.
 */

/** 아침에 한 번에 띄우는 토스트 최대 개수. 나머지는 휴대폰 알림 목록에만 남는다. */
export const MORNING_TOAST_MAX = 3

/** 아침 알림 한 줄. 입력 배열은 이야기 순서(상점 재개장 → 집 완성 → 편지 …)대로 넣는다. */
export interface MorningNotice {
  text: string
  /** 낮을수록 중요하다. 같으면 먼저 넣은 쪽이 앞선다. */
  rank: number
  /** 공사·완성 갈래 알림: 옛 공사 알림을 지우고 바로 띄운다 */
  build?: boolean
  /** 우선 알림: 큐를 건너뛰고 바로 뜬다 */
  front?: boolean
}

/** 넘친 1순위 이하 알림을 마지막 토스트에 이어 붙일 때 넘지 않는 글자 수(넘으면 휴대폰 목록으로 보낸다) */
export const MERGE_MAX_CHARS = 60

/**
 * 중요한 알림 max 개만 토스트로 고른다. 토스트는 입력 순서를 지키고(상점 → 집 → 편지),
 * 밀려난 알림도 입력 순서대로 휴대폰 목록에 간다.
 * 밀려난 알림 중 순위 0·1(상점·집·섬 완성)은 마지막 토스트 뒤에 " · "로 이어 붙인다. 글이 MERGE_MAX_CHARS 를 넘으면 합치지 않는다.
 */
export function planMorningToasts(
  notices: readonly MorningNotice[],
  max: number = MORNING_TOAST_MAX,
): { toasts: MorningNotice[]; phone: MorningNotice[] } {
  const picked = new Set(
    notices
      .map((notice, index) => ({ notice, index }))
      .sort((a, b) => a.notice.rank - b.notice.rank || a.index - b.index)
      .slice(0, Math.max(0, max))
      .map((x) => x.index),
  )
  const toasts = notices.filter((_, i) => picked.has(i)).map((x) => ({ ...x }))
  const merged = new Set<number>()
  if (toasts.length > 0) {
    const last = toasts[toasts.length - 1]
    notices.forEach((notice, i) => {
      if (picked.has(i) || notice.rank > 1) return
      const text = `${last.text} · ${notice.text}`
      if (Array.from(text).length > MERGE_MAX_CHARS) return
      last.text = text
      merged.add(i)
    })
  }
  return {
    toasts,
    phone: notices.filter((_, i) => !picked.has(i) && !merged.has(i)),
  }
}
