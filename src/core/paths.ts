/**
 * 길 깔기: 평지 한 칸씩 흙길·돌길·벽돌길을 놓는다. 저장은 한 줄 문자열로 하고(칸마다 `x,z` + 종류 한 글자),
 * 그리는 쪽은 이웃 칸 네 방향을 보고 모서리를 둥글린다. 순수 함수만 둔다.
 */
import { canPlace, flatAt, type Placed } from './placement'

export { flatAt }

export type PathKind = 'dirt' | 'stone' | 'brick'
export const PATH_KINDS: PathKind[] = ['dirt', 'stone', 'brick']
export const PATH_NAME: Record<PathKind, string> = { dirt: '흙길', stone: '돌길', brick: '벽돌길' }
/** 한 섬에 깔 수 있는 길 칸 수 */
export const PATH_MAX = 400
/** 길 공사 허가: 도토리 또는 마일리지로 한 번 산다 */
export const PERMIT_COST = 1000
export const PERMIT_MILES = 100

export interface PathTile {
  x: number
  z: number
  kind: PathKind
}

const CODE: Record<PathKind, string> = { dirt: 'd', stone: 's', brick: 'b' }
const KIND_OF: Record<string, PathKind> = { d: 'dirt', s: 'stone', b: 'brick' }

/** 칸 목록을 `x,zk;x,zk` 로 적는다. 칸마다 열 자 남짓이라 400칸도 4킬로바이트를 넘지 않는다. */
export function encodePaths(tiles: readonly PathTile[]): string {
  return tiles.map((t) => `${t.x},${t.z}${CODE[t.kind]}`).join(';')
}

/** 저장된 문자열을 칸 목록으로 되살린다. 깨진 조각·겹친 칸은 버리고 PATH_MAX 까지만 받는다. */
export function decodePaths(raw: unknown): PathTile[] {
  if (typeof raw !== 'string' || !raw) return []
  const seen = new Set<string>()
  const out: PathTile[] = []
  for (const part of raw.split(';')) {
    const m = /^(-?\d+),(-?\d+)([dsb])$/.exec(part)
    if (!m) continue
    const x = Number(m[1])
    const z = Number(m[2])
    const key = `${x},${z}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ x, z, kind: KIND_OF[m[3]] })
    if (out.length >= PATH_MAX) break
  }
  return out
}

/** 같은 칸에 길이 있으면 걷어내고, 없으면 놓는다(가득 찼으면 놓지 않는다). */
export function paintTiles(tiles: readonly PathTile[], x: number, z: number, kind: PathKind): { tiles: PathTile[]; done: 'added' | 'removed' | 'full' } {
  const i = tiles.findIndex((t) => t.x === x && t.z === z)
  if (i >= 0) return { tiles: tiles.filter((_, k) => k !== i), done: 'removed' }
  if (tiles.length >= PATH_MAX) return { tiles: [...tiles], done: 'full' }
  return { tiles: [...tiles, { x, z, kind }], done: 'added' }
}

/** 별점 '정돈' 항목이 세는 길 칸 수 */
export function pathCount(raw: unknown): number {
  return decodePaths(raw).length
}

let rawMemo: { raw: string; keys: Set<string> } = { raw: '', keys: new Set() }
/** 저장된 길 문자열을 "x,z" 키 집합으로. 같은 문자열이면 다시 풀지 않는다(매 프레임 가구 판정에 쓰인다). */
export function pathCellsOf(raw: string): Set<string> {
  if (raw !== rawMemo.raw) rawMemo = { raw, keys: pathKeys(decodePaths(raw)) }
  return rawMemo.keys
}

/** 이 칸에 길을 놓을 수 있는지: 풀밭 평지이고 물건·물이 없어야 한다(판정은 canPlace 기준을 그대로 쓴다). */
export function pathSpotOk(x: number, z: number, placed: readonly Placed[], live: NonNullable<Parameters<typeof canPlace>[4]> = {}): boolean {
  return canPlace(x, z, placed, [], live) && flatAt(x, z)
}

/** 바깥선과 안쪽 채움선의 여백·둥근 반지름 */
export const PATH_INSET = 0.04
export const PATH_RING = 0.07
export const PATH_CORNER = 0.22

/** 칸 한 개의 선을 [x,z] 점 목록으로 만든다(반시계). t 는 0(바깥선)~1(안쪽 채움선) 사이의 안쪽 정도다.
 * 이웃이 있는 변은 여백 없이 옆 칸까지 이어지고, 이웃이 동서남북 둘 다 없는 모서리만 둥글린다.
 * 두 선은 같은 모서리 규칙을 써서 점 개수가 같으므로 짝지어 이을 수 있다. */
export function tileOutline(t: number, nE: boolean, nN: boolean, nW: boolean, nS: boolean): [number, number][] {
  const inset = (has: boolean) => (has ? 0 : PATH_INSET + t * PATH_RING)
  const rr = PATH_CORNER - t * PATH_RING
  // [부호 x, 부호 z, x 변에 이웃, z 변에 이웃, 시작 각도]: 북동 → 북서 → 남서 → 남동 순서로 돈다
  const corners: [number, number, boolean, boolean, number][] = [
    [1, 1, nE, nN, 0],
    [-1, 1, nW, nN, Math.PI / 2],
    [-1, -1, nW, nS, Math.PI],
    [1, -1, nE, nS, (3 * Math.PI) / 2],
  ]
  const pts: [number, number][] = []
  for (const [sx, sz, hx, hz, base] of corners) {
    const px = sx * (0.5 - inset(hx))
    const pz = sz * (0.5 - inset(hz))
    if (hx || hz) {
      pts.push([px, pz])
      continue
    }
    // 둥근 모서리: 중심을 안쪽으로 반지름만큼 물린 호를 네 조각으로 나눈다
    const cx = px - sx * rr
    const cz = pz - sz * rr
    for (let k = 0; k <= 4; k++) {
      const a = base + (k * Math.PI) / 8
      pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr])
    }
  }
  return pts
}

/** 길 칸 좌표 모음: 주변 칸을 빨리 찾으려고 `x,z` 문자열로 담는다 */
export function pathKeys(tiles: readonly PathTile[]): Set<string> {
  return new Set(tiles.map((t) => `${t.x},${t.z}`))
}

/** (x,z) 가 길 칸 위(또는 pad 안쪽 가장자리)인지. 꽃·풀·조약돌이 길 밑으로 뚫고 나오지 않게 거른다. */
export function nearPath(x: number, z: number, keys: ReadonlySet<string>, pad = 0.15): boolean {
  const cx = Math.round(x)
  const cz = Math.round(z)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const tx = cx + dx
      const tz = cz + dz
      if (keys.has(`${tx},${tz}`) && Math.abs(x - tx) < 0.5 + pad && Math.abs(z - tz) < 0.5 + pad) return true
    }
  }
  return false
}
