/**
 * 막힌 자리에 서 있을 때 가장 가까운 걸을 수 있는 자리를 고른다.
 * 상점이 커지거나 집이 생기면 서 있던 자리가 새 몸체 안에 들어갈 수 있어서, 그때 한 번 밀어낸다.
 * 가까운 원부터 넓히며 16 방향을 훑으므로 몸체 가장자리 쪽으로 자연스럽게 빠진다.
 */
export function nearestFreeSpot(x: number, z: number, free: (x: number, z: number) => boolean, maxR = 4, step = 0.25): { x: number; z: number } | null {
  if (free(x, z)) return { x, z }
  for (let r = step; r <= maxR + 1e-9; r += step) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const nx = x + Math.cos(a) * r
      const nz = z + Math.sin(a) * r
      if (free(nx, nz)) return { x: nx, z: nz }
    }
  }
  return null
}
