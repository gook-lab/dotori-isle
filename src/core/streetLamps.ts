/**
 * 밤 가로등 자리. 광장 → 상점 → 마을회관 길을 따라 구간마다 몇 개씩, 길에서 옆으로 떨어진 자리에 세운다.
 * 순수 함수다. 길의 점들과 "비어 있는지"만 받아서 같은 입력이면 늘 같은 자리를 준다.
 * 길 위는 피하고(옆으로 LAMP_OFFSET 만큼 띄움), 건물·소품·물가 판정은 호출하는 쪽의 `clear` 가 맡는다.
 */

export interface LampPoint {
  x: number
  z: number
}

/** 구간마다 세우는 가로등 수. 구간이 두 개면 최대 여섯 개다. */
export const LAMP_PER_SEG = 3
/** 길 중심선에서 옆으로 띄우는 거리 */
export const LAMP_OFFSET = 2
/** 가로등 수 상한. 밤 조명 비용을 여섯 개 안에 묶는다. */
export const LAMP_MAX = 6

/**
 * 길(점들을 이은 선)을 따라 가로등 자리를 고른다. 구간 안에서 등분 자리마다 길 왼쪽, 그다음 오른쪽 순으로 본다.
 * 둘 다 막히면 그 자리는 건너뛴다.
 */
export function streetLampSpots(route: readonly LampPoint[], clear: (x: number, z: number) => boolean, max = LAMP_MAX): LampPoint[] {
  const out: LampPoint[] = []
  for (let i = 0; i + 1 < route.length && out.length < max; i++) {
    const a = route[i]
    const b = route[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 1e-6) continue
    // 길의 수직 방향 단위벡터
    const nx = -dz / len
    const nz = dx / len
    for (let k = 1; k <= LAMP_PER_SEG && out.length < max; k++) {
      const t = k / (LAMP_PER_SEG + 1)
      const cx = a.x + dx * t
      const cz = a.z + dz * t
      for (const side of [1, -1]) {
        const x = cx + nx * LAMP_OFFSET * side
        const z = cz + nz * LAMP_OFFSET * side
        if (clear(x, z)) {
          out.push({ x, z })
          break
        }
      }
    }
  }
  return out
}
