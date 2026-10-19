/** 바깥 섬에서 실제 점광원을 켜 둘 등의 수. 나머지 등은 발광 재질로만 빛난다. */
export const OUTDOOR_LAMP_SLOTS = 5

/** 한 번 고른 등을 몇 칸까지 밀려날 때까지 유지할지. 카메라가 조금 움직여 순위가 바뀌어도 빛이 깜빡이지 않게 한다. */
export const LAMP_KEEP_MARGIN = 2

export interface LampCandidate {
  id: string
  /** 카메라 가로 거리의 제곱 */
  d2: number
}

/**
 * 가까운 등 순서로 칸을 고른다. 이미 칸을 가진 등은 순위가 slots + margin 안이면 같은 칸을 그대로 쓴다.
 * 칸 번호가 바뀌지 않으므로 빛이 다른 등 자리로 튀지 않는다. 빈 칸은 null 이다.
 */
export function pickLampSlots(cands: readonly LampCandidate[], prev: readonly (string | null)[], slots = OUTDOOR_LAMP_SLOTS, margin = LAMP_KEEP_MARGIN): (string | null)[] {
  const ranked = [...cands].sort((a, b) => a.d2 - b.d2)
  const rankOf = new Map(ranked.map((c, i) => [c.id, i]))
  const out: (string | null)[] = Array.from({ length: slots }, () => null)
  const taken = new Set<string>()
  // 이미 칸을 가진 등은 아직 가깝게 남아 있으면 같은 칸에 둔다
  for (let k = 0; k < slots; k++) {
    const id = prev[k] ?? null
    if (id === null || taken.has(id)) continue
    const r = rankOf.get(id)
    if (r === undefined || r >= slots + margin) continue
    out[k] = id
    taken.add(id)
  }
  // 나머지 빈 칸은 가까운 순서대로 채운다
  let next = 0
  for (const c of ranked) {
    if (taken.has(c.id)) continue
    while (next < slots && out[next] !== null) next++
    if (next >= slots) break
    out[next] = c.id
    taken.add(c.id)
  }
  return out
}
