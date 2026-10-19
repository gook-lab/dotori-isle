/** 꽃밭. 꽃씨를 심고 물을 준 날 밤을 넘기면 한 단계 자란다. */

export interface Plant {
  id: string
  x: number
  z: number
  color: string
  /** 0 씨앗 · 1 새싹 · 2 꽃봉오리 · 3 활짝 */
  stage: number
  watered: boolean
}

export const BLOOM = 3
export const FLOWER_COLORS = ['#ff8fa3', '#ffd166', '#b8c0ff', '#ffffff', '#ff9f68', '#c77dff']

/** 날이 바뀔 때 부른다. 새로 활짝 핀 꽃 수도 함께 돌려준다. */
export function growOvernight(plants: readonly Plant[]): { plants: Plant[]; bloomed: number } {
  let bloomed = 0
  const next = plants.map((p) => {
    if (!p.watered || p.stage >= BLOOM) return { ...p, watered: false }
    const stage = p.stage + 1
    if (stage === BLOOM) bloomed++
    return { ...p, stage, watered: false }
  })
  return { plants: next, bloomed }
}
