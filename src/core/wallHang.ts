/**
 * 벽에 거는 가구: 액자·현판·벽시계·선반처럼 벽에 붙는 것은 방 가장자리 칸에서 벽을 보고 서서 건다.
 * 자리는 칸 가장자리가 아니라 실제 방 벽 면(방 크기와 벽 두께)에 붙인다. 바닥 칸을 쓰지 않고, 회전하지 않는다(벽 방향이 곧 앞면 방향).
 * 판정은 모두 순수 함수다.
 */

import { floorOpen, hasAttic, hasSideRoom, homeCells, type HomeStage } from './home'
import { ATTIC, CELLAR_ROOM, HOME_ROOM_SIZES, MAIN_EAST_WALL_DOOR, ROOM_FLOOR, SIDE_ROOM, SIDE_WEST_WALL_DOOR, WALL_H, type HomeFloor, type RoomSize } from './interior'
import { snap, type Placed, type WallDir } from './placement'

/** 벽에 거는 가구 id. 마이 앨범의 벽 사진은 따로 뒤 벽에 걸린다(scene/PhotoWall.tsx). */
export const WALL_ITEMS: ReadonlySet<string> = new Set(['photo-frame', 'house-plaque', 'wall-clock', 'wall-shelf'])
export const isWallItem = (id: string): boolean => WALL_ITEMS.has(id)

/**
 * 벽걸이 자리로 쓰는 칸(방 가운데 기준 정수 좌표). 가구 격자(homeCells)는 방 가운데 일부만 덮어서 벽에 닿지 않으므로,
 * 본채·옆방·지하실은 방 전체를 정수 칸으로 나눈 것을 쓴다. 다락은 가구 칸(다락 바닥)이 곧 벽 자리다.
 */
export function wallCells(stage: HomeStage, floor: HomeFloor = 0): { x: number; z: number }[] {
  if (!floorOpen(stage, floor)) return []
  if (floor === 1) return homeCells(stage, 1)
  const r = roomFor(stage, floor)
  const span = (len: number) => {
    const out: number[] = []
    for (let c = Math.ceil(-len / 2 + 0.5); c <= Math.floor(len / 2 - 0.5); c++) out.push(c)
    return out
  }
  const cells: { x: number; z: number }[] = []
  for (const z of span(r.d)) for (const x of span(r.w)) cells.push({ x, z })
  return cells
}

/** 벽 방향별 바깥쪽 한 칸(방 밖으로 나가는 방향) */
const STEP: Record<WallDir, { dx: number; dz: number }> = {
  n: { dx: 0, dz: -1 },
  e: { dx: 1, dz: 0 },
  s: { dx: 0, dz: 1 },
  w: { dx: -1, dz: 0 },
}

/** 옆벽 가구를 카메라 쪽(+z)으로 돌리는 각도(약 18도). 앞면이 보이게 한다. */
const SIDE_TILT = (18 * Math.PI) / 180

/** 벽 면에서 방 안쪽으로 향하는 y 축 회전(라디안). 모델의 앞면은 +z 를 보는 것으로 친다. 옆벽은 카메라 쪽으로 살짝 돌린다. */
const FACE_IN: Record<WallDir, number> = { n: 0, s: Math.PI, e: -Math.PI / 2 + SIDE_TILT, w: Math.PI / 2 - SIDE_TILT }

/** 벽 위 높이(층 바닥 기준). 뒤 벽 창의 아래 선(창 밑 1.25, 바닥 0.1)에 모델 원점을 맞춘다. 벽이 낮으면 그만큼 내린다(wallHeightOf). */
export const WALL_HEIGHT = 1.15
/** 벽걸이 가구 가운데 가장 높은 윗변(층 바닥 기준, 크기 배율 포함). 벽 윗선 아래에 이만큼 여유를 둔다. */
export const WALL_ITEM_TOP = 1.1
/** 벽걸이 윗변과 벽 윗선 사이의 최소 여유 */
export const WALL_TOP_CLEARANCE = 0.3
/** 벽걸이 모델 크기 배율. 뒤 벽 창(1.1 x 0.9)과 비슷한 높이에 보이게 키운다. */
export const WALL_SCALE = 1.5
/** 벽 면(벽 상자의 방 쪽 면)에서 모델 원점까지의 거리. 모델 뒷면이 벽 안으로 들어가지 않을 만큼 띄운다. */
export const WALL_OFFSET = 0.06
/** 벽 상자의 절반 두께(0.12 / 2). 벽 면은 벽 중심에서 이만큼 방 쪽이다. */
const WALL_HALF = 0.06
/** 칸 가장자리에서 실제 벽 면까지 이 이내면 "벽에 닿은 가장자리 칸"으로 본다 */
const MAX_WALL_GAP = 1
/** 문 가운데에서 이 거리 안의 칸에는 걸 수 없다(문틀 폭 1.1의 절반 + 걸리는 가구 반폭) */
const DOOR_CLEAR = 0.9

/** 이 층이 쓰는 방 크기. 옆방·지하실은 따로 있는 방이고, 본채와 다락은 본채 방 크기를 쓴다. */
export function roomFor(stage: HomeStage, floor: HomeFloor = 0): RoomSize {
  if (floor === 2) return SIDE_ROOM
  if (floor === 3) return CELLAR_ROOM
  return HOME_ROOM_SIZES[stage] ?? HOME_ROOM_SIZES[0]
}

/** 벽 윗선(층 바닥 기준). 뒤 벽은 다락 단계(본채 3단계 이상, 다락 층)에서 높아진다. 앞(s)은 잘린 벽이다. */
export function wallTopOf(stage: HomeStage, floor: HomeFloor, dir: WallDir): number {
  const base = floor === 1 ? ROOM_FLOOR + ATTIC.floorY : ROOM_FLOOR
  const tall = floor === 1 || (floor === 0 && hasAttic(stage))
  const top = dir === 'n' && tall ? ATTIC.ceilingBack : WALL_H
  return top - base
}

/** 이 자리에 건 벽걸이의 원점 높이(층 바닥 기준). 윗변이 벽 윗선보다 WALL_TOP_CLEARANCE 아래에 오도록 WALL_HEIGHT 이하로 정한다. 0 보다 낮으면 걸 수 없다. */
export function wallHeightOf(stage: HomeStage, floor: HomeFloor, dir: WallDir): number {
  return Math.min(WALL_HEIGHT, wallTopOf(stage, floor, dir) - WALL_TOP_CLEARANCE - WALL_ITEM_TOP)
}

/**
 * 그 층에서 벽걸이를 걸 수 있는 벽 방향. 앞(s)은 카메라 쪽이라 잘린 벽이고,
 * 다락의 옆벽은 바닥에서 0.5 밖에 안 남아 벽걸이가 들어가지 않는다.
 */
export function drawnWalls(stage: HomeStage, floor: HomeFloor = 0): readonly WallDir[] {
  return (['n', 'e', 'w'] as WallDir[]).filter((d) => wallHeightOf(stage, floor, d) >= 0)
}

/** 방 가운데 기준, 벽 상자의 방 쪽 면 좌표(n·s 는 z, e·w 는 x) */
export function wallFace(dir: WallDir, room: RoomSize): number {
  if (dir === 'n') return -room.d / 2 + WALL_HALF
  if (dir === 's') return room.d / 2 - WALL_HALF
  if (dir === 'e') return room.w / 2 - WALL_HALF
  return -room.w / 2 + WALL_HALF
}

/** 칸 가장자리(바깥쪽 변)에서 실제 벽 면까지의 거리. 벽 쪽 칸이면 작다. */
function wallGap(x: number, z: number, dir: WallDir, room: RoomSize): number {
  const s = STEP[dir]
  const edge = dir === 'n' || dir === 's' ? z + (s.dz * 0.5) : x + (s.dx * 0.5)
  return Math.abs(edge - wallFace(dir, room))
}

/** 이 칸의 이 벽 면에 문이 있으면 그 문의 가운데 좌표(벽 쪽 방향 축) */
function doorAt(stage: HomeStage, floor: HomeFloor, dir: WallDir): number | null {
  if (floor === 0 && dir === 'e' && hasSideRoom(stage)) return MAIN_EAST_WALL_DOOR.z
  if (floor === 2 && dir === 'w') return SIDE_WEST_WALL_DOOR.z
  return null
}

/** 벽걸이를 "벽 칸"으로 고를 수 있는지. 못 고르면 까닭을 주고, 고를 수 있으면 null 이다. */
function wallOpen(x: number, z: number, dir: WallDir, stage: HomeStage, floor: HomeFloor): string | null {
  const cells = wallCells(stage, floor)
  if (!cells.some((c) => c.x === x && c.z === z)) return '벽 앞에 서서 벽 쪽을 봐 주세요'
  if (!drawnWalls(stage, floor).includes(dir)) return dir === 's' ? '이쪽 벽에는 걸 수 없어요' : '이쪽 벽은 너무 낮아서 걸 수 없어요'
  const s = STEP[dir]
  if (cells.some((c) => c.x === x + s.dx && c.z === z + s.dz)) return '여기는 벽이 아니에요. 벽 쪽을 봐 주세요'
  const room = roomFor(stage, floor)
  if (wallGap(x, z, dir, room) > MAX_WALL_GAP) return '벽에서 멀어요. 벽 가까이 서 주세요'
  const door = doorAt(stage, floor, dir)
  if (door !== null && Math.abs((dir === 'n' || dir === 's' ? x : z) - door) < DOOR_CLEAR) return '문이 있는 벽이라 걸 수 없어요'
  return null
}

/** 한 층에서 벽걸이를 걸 수 있는 칸과 벽 방향 목록. 모서리 칸은 두 면을 가진다. */
export function wallSlots(stage: HomeStage, floor: HomeFloor = 0): { x: number; z: number; dir: WallDir }[] {
  const out: { x: number; z: number; dir: WallDir }[] = []
  for (const c of wallCells(stage, floor)) {
    for (const dir of drawnWalls(stage, floor)) {
      if (wallOpen(c.x, c.z, dir, stage, floor) === null) out.push({ x: c.x, z: c.z, dir })
    }
  }
  return out
}

/** 이 칸의 이 벽 면에 걸 수 있는지. 걸 수 없으면 까닭을 주고, 걸 수 있으면 null 이다. */
export function wallBlocker(x: number, z: number, dir: WallDir, stage: HomeStage, floor: HomeFloor, placed: readonly Placed[]): string | null {
  const open = wallOpen(x, z, dir, stage, floor)
  if (open) return open
  if (placed.some((p) => p.wall === dir && p.x === x && p.z === z && (p.floor ?? 0) === floor)) return '이미 걸린 벽이에요'
  return null
}

/** 저장된 벽 방향인지(잘못된 값은 버린다) */
export const isWallDir = (v: unknown): v is WallDir => v === 'n' || v === 'e' || v === 's' || v === 'w'

/** 보는 방향(facing, placementCell 과 같은 식)을 가장 가까운 벽 방향으로 바꾼다 */
export function wallDirOf(facing: number): WallDir {
  const sx = Math.sin(facing)
  const sz = Math.cos(facing)
  if (Math.abs(sz) >= Math.abs(sx)) return sz >= 0 ? 's' : 'n'
  return sx >= 0 ? 'e' : 'w'
}

/** 서 있는 칸(방 가운데 기준 좌표)과 보는 방향으로 고른 벽 자리. why 가 있으면 걸 수 없는 까닭이다. */
export interface WallSpot {
  x: number
  z: number
  dir: WallDir
  why: string | null
}

/**
 * 플레이어 위치(방 가운데 기준)와 보는 방향으로 벽 자리를 고른다.
 * 방 칸이 아니거나, 바라보는 쪽이 방 안 칸이면 벽이 아니라고 알려 준다.
 */
export function wallSpot(lx: number, lz: number, facing: number, stage: HomeStage, floor: HomeFloor, placed: readonly Placed[]): WallSpot {
  const x = snap(lx)
  const z = snap(lz)
  const dir = wallDirOf(facing)
  return { x, z, dir, why: wallBlocker(x, z, dir, stage, floor, placed) }
}

/**
 * 벽에 건 가구가 놓일 자리와 회전(방 가운데 기준 좌표, 라디안). 원점은 실제 벽 면에서 WALL_OFFSET 만큼 방 쪽이고,
 * 칸 가운데 선의 높이와 좌우 위치를 쓴다. 방 크기는 roomFor 가 준다.
 */
export function wallPose(x: number, z: number, dir: WallDir, stage: HomeStage, floor: HomeFloor = 0): { x: number; z: number; y: number; rot: number; scale: number } {
  const face = wallFace(dir, roomFor(stage, floor))
  const y = wallHeightOf(stage, floor, dir)
  const inward = dir === 'n' ? WALL_OFFSET : dir === 's' ? -WALL_OFFSET : 0
  if (dir === 'n' || dir === 's') return { x, z: face + inward, y, rot: FACE_IN[dir], scale: WALL_SCALE }
  const side = dir === 'e' ? -WALL_OFFSET : WALL_OFFSET
  return { x: face + side, z, y, rot: FACE_IN[dir], scale: WALL_SCALE }
}

/**
 * 저장된 벽걸이 가운데 카메라 쪽(s) 벽에 걸린 것을 옮긴다. 같은 칸의 다른 벽(n, e, w)이 비어 있으면 거기로 옮기고,
 * 없으면 가방으로 돌려준다. 그 밖의 가구는 그대로 둔다.
 */
export function rehomeSouthWalls(items: readonly Placed[], stage: HomeStage): { items: Placed[]; bag: Placed[] } {
  const kept: Placed[] = []
  const bag: Placed[] = []
  for (const p of items) {
    if (p.wall !== 's') {
      kept.push(p)
      continue
    }
    const floor = (p.floor ?? 0) as HomeFloor
    const dir = drawnWalls(stage, floor).find((d) => wallBlocker(p.x, p.z, d, stage, floor, kept) === null)
    if (dir) kept.push({ ...p, wall: dir })
    else bag.push(p)
  }
  return { items: kept, bag }
}
