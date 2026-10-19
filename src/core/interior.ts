/**
 * 주민 집 안. 여행 섬처럼 같은 좌표 공간의 아주 먼 곳(바다 바깥)에 방을 한 줄로 늘어놓는다.
 * 방마다 가구 자리는 같고 색과 장식만 주민마다 다르다. 이 파일은 다른 모듈을 import 하지 않아서
 * 섬 높이·충돌 판정이 순환 없이 가져다 쓸 수 있다.
 */

export const ROOM_W = 10
export const ROOM_D = 8
const ROOM_X = -700
const ROOM_GAP = 30

/** 방 크기(가로·세로, 방 가운데 기준 ±절반). */
export interface RoomSize {
  w: number
  d: number
}

/**
 * 플레이어 집 방 크기 표. 단계마다 벽·바닥·문 매트·카메라 자리·가구 칸이 여기서 정해진다.
 * 텐트 6×5 → 작은 집 8×6 → 큰 집 10×8 → 다락방 단계도 같은 10×8 바닥에 다락(ATTIC)을 한 층 더 얹는다.
 * 옆방·지하실 단계도 본채는 10×8 그대로다. 옆방과 지하실은 따로 있는 방이라 아래 SIDE_ROOM·CELLAR_ROOM 을 쓴다.
 */
export const HOME_ROOM_SIZES: readonly RoomSize[] = [
  { w: 6, d: 5 },
  { w: 8, d: 6 },
  { w: 10, d: 8 },
  { w: 10, d: 8 },
  { w: 10, d: 8 },
  { w: 10, d: 8 },
]

/**
 * 다락 2층(다락방 단계). 방 가운데 기준 좌표다. 다락 바닥은 방 바닥에서 floorY 만큼 높고,
 * 사다리는 앞쪽 난간(z1)의 x 자리에 기대어 선다. 사다리 아래(방바닥 쪽)와 위(다락 쪽) E 자리가 따로 있다.
 */
export const ATTIC = {
  floorY: 2.2,
  x0: 0.4,
  x1: 4.6,
  z0: -3.6,
  z1: -0.4,
  /** 사다리 자리(난간 앞, 방바닥 쪽 발끝과 다락 쪽 끝이 같은 x) */
  ladderX: 2.5,
  /** 방바닥에서 사다리 발끝 자리 */
  ladderFootZ: 0.6,
  /** 올라가면 서는 자리(다락 안쪽) */
  climbZ: -1.2,
  /** 내려오면 서는 자리(방바닥 쪽) */
  descendZ: 0.9,
  /** 다락 천장이 뒤쪽 벽에서 앞 난간까지 기울어지는 높이(벽 꼭대기와 난간 위) */
  ceilingBack: 4.2,
  ceilingFront: 3.4,
}

/** 다락 가구 칸 가로·세로(다락 안 정수 좌표). 4×3 이다. */
export const ATTIC_CELLS = { x0: 1, z0: -3, w: 4, h: 3 }

/**
 * 집 안에서 머무는 자리(층·방). 0 은 본채 방바닥, 1 은 다락, 2 는 옆방, 3 은 지하실이다.
 * 다락은 본채 위에 얹힌 층이라 본채 바닥과 같이 보인다. 옆방과 지하실은 따로 있는 방이라 한 번에 하나만 그린다.
 */
export type HomeFloor = 0 | 1 | 2 | 3

/** 자리마다 필요한 집 단계. 본채 0, 다락 3(다락방 증축), 옆방 4, 지하실 5 */
export const FLOOR_STAGE: Record<HomeFloor, number> = { 0: 0, 1: 3, 2: 4, 3: 5 }

/** 저장값을 자리 번호로 바꾼다. 모르는 값은 본채 방바닥이다. */
export function homeFloorOf(v: unknown): HomeFloor {
  return v === 1 || v === 2 || v === 3 ? v : 0
}

/** 옆방 방 크기. 본채 동쪽 벽의 문으로 들어간다. 방 가운데 기준 ±절반. */
export const SIDE_ROOM: RoomSize = { w: 7, d: 6 }
/** 지하실 방 크기. 본채 바닥 구석의 계단으로 내려간다. */
export const CELLAR_ROOM: RoomSize = { w: 9, d: 7 }

/** 옆방 가구 칸(방 가운데 기준 정수 좌표). 5×4 이고 문 쪽 빈 줄은 비워 둔다. */
export const SIDE_CELLS = { x0: -1, z0: -2, w: 5, h: 4 }
/** 지하실 가구 칸. 6×5 이고 계단 쪽은 비워 둔다. */
export const CELLAR_CELLS = { x0: -2, z0: -2, w: 6, h: 5 }

/** 본채 동쪽 벽 문 앞(방 가운데 기준). 문은 x = 5 벽에 있고 여기서 E 로 옆방에 든다. */
export const MAIN_EAST_DOOR = { x: 4, z: -1 }
/** 옆방 서쪽 벽 문 앞. 여기서 E 로 본채로 돌아간다. */
export const SIDE_WEST_DOOR = { x: -2.6, z: 0 }
/** 본채 바닥 구석의 지하 계단 입구(앞왼쪽 구석). */
export const MAIN_STAIR = { x: -3.9, z: 2.8 }
/** 지하실에서 올라와 서는 자리(본채 계단 옆) */
const MAIN_STAIR_STAND = { x: -3, z: 2 }
/** 지하실 안의 계단(위로 올라가는 자리). 본채 계단과 같은 구석이다. */
export const CELLAR_STAIR = { x: -3.4, z: 2.3 }
/** 본채에서 내려와 서는 자리(지하 계단 옆) */
const CELLAR_STAIR_STAND = { x: -2.5, z: 1.4 }

/** 집 안 층·방 이동. E 를 누르면 `at` 근처에서 `arrive` 로 옮겨 간다. 방 가운데 기준. */
export interface HomeMove {
  from: HomeFloor
  to: HomeFloor
  label: string
  at: { x: number; z: number }
  arrive: { x: number; z: number }
}

export const HOME_MOVES: readonly HomeMove[] = [
  { from: 0, to: 2, label: '옆방으로 가기', at: MAIN_EAST_DOOR, arrive: SIDE_WEST_DOOR },
  { from: 2, to: 0, label: '본채로 돌아가기', at: SIDE_WEST_DOOR, arrive: MAIN_EAST_DOOR },
  { from: 0, to: 3, label: '지하실로 내려가기', at: MAIN_STAIR, arrive: CELLAR_STAIR_STAND },
  { from: 3, to: 0, label: '위로 올라가기', at: CELLAR_STAIR, arrive: MAIN_STAIR_STAND },
]

/** 벽에 붙은 문 자리(방 가운데 기준). 문짝을 그리는 쪽이 이 값을 쓴다. 본채 동쪽 벽, 옆방 서쪽 벽. */
export const MAIN_EAST_WALL_DOOR = { x: HOME_ROOM_SIZES[3].w / 2, z: -1 }
export const SIDE_WEST_WALL_DOOR = { x: -SIDE_ROOM.w / 2, z: 0 }

/** 지금 보고 있는 집 방의 단계와 층. store 가 바꾼다(저장하지 않는다). */
export const homeRoom: { stage: number; floor: HomeFloor } = { stage: 0, floor: 0 }

/** 방 크기. 집 방이면 지금 자리의 크기(옆방·지하실이면 그 방), 나머지 방은 기본 크기다. */
export function roomSizeAt(index: number): RoomSize {
  if (index === HOME_ROOM) {
    if (homeRoom.floor === 2) return SIDE_ROOM
    if (homeRoom.floor === 3) return CELLAR_ROOM
    return HOME_ROOM_SIZES[homeRoom.stage] ?? HOME_ROOM_SIZES[0]
  }
  return { w: ROOM_W, d: ROOM_D }
}

/** 방 입구(들어오면 서는 자리)와 나가는 문 앞. 방 가운데 기준. */
export const entryOf = (size: RoomSize) => ({ x: 0, z: size.d / 2 - 1.1 })
export const exitOf = (size: RoomSize) => ({ x: 0, z: size.d / 2 - 0.5 })

/** 침대는 왼쪽 뒤, 보관함은 오른쪽 뒤 모서리에 붙는다. 방이 커지면 같이 벌어진다. */
export const bedOf = (size: RoomSize) => ({ x: -size.w / 2 + 1.3, z: -size.d / 2 + 1.4, r: 0.9 })
export const chestOf = (size: RoomSize) => ({ x: size.w / 2 - 1.3, z: -size.d / 2 + 1.4, r: 0.6 })

/** 다락 바닥 높이 판정: 집 방의 다락 자리 안이면 다락 바닥 높이를 준다. */
export function roomFloorY(x: number, z: number): number {
  const i = roomIndexAt(x, z)
  if (i !== HOME_ROOM || homeRoom.floor !== 1) return ROOM_FLOOR
  const c = roomCenter(i)
  const lx = x - c.x
  const lz = z - c.z
  return lx >= ATTIC.x0 && lx <= ATTIC.x1 && lz >= ATTIC.z0 && lz <= ATTIC.z1 ? ROOM_FLOOR + ATTIC.floorY : ROOM_FLOOR
}

/** n 번째 방의 가운데 */
export function roomCenter(index: number): { x: number; z: number } {
  return { x: ROOM_X, z: index * ROOM_GAP }
}

/** 방 안이면 몇 번째 방인지, 아니면 -1 */
export function roomIndexAt(x: number, z: number): number {
  if (Math.abs(x - ROOM_X) > ROOM_W) return -1
  const i = Math.round(z / ROOM_GAP)
  return i >= 0 && Math.abs(z - i * ROOM_GAP) < ROOM_D ? i : -1
}

export const inRoomArea = (x: number) => x < ROOM_X / 2

/** 방 바닥 높이 */
export const ROOM_FLOOR = 0.1
/** 방 벽 높이(방 바닥 기준 절대값). 뒤 벽은 다락 단계에서 ATTIC.ceilingBack 까지 올라간다. */
export const WALL_H = 2.8

/** 방 가구 자리(방 가운데 기준). 부딪히는 원으로 쓴다. 문은 +z 벽 가운데다. */
export const ROOM_FURNITURE = [
  { id: 'bed', x: -3.2, z: -2.2, r: 1.25 },
  { id: 'table', x: 1.6, z: -0.6, r: 0.75 },
  { id: 'dresser', x: 3.6, z: -3.1, r: 0.8 },
  { id: 'shelf', x: -0.6, z: -3.4, r: 0.65 },
  { id: 'plant', x: 4.3, z: 2.9, r: 0.45 },
  { id: 'gift0', x: -4.2, z: 1.6, r: 0.5 },
  { id: 'gift1', x: 4.2, z: 0.4, r: 0.5 },
  { id: 'gift2', x: -1.6, z: 1.2, r: 0.5 },
]

/**
 * 들어오면 서는 자리와 나가는 문 앞(방 가운데 기준). 입장 자리는 문에서 2.1 떨어진 안쪽이라,
 * 들어온 직후 E 가 '밖으로 나가기'로 잡히지 않는다(나가기 판정 거리 1.3 밖).
 */
export const ROOM_ENTRY = { x: 0, z: ROOM_D / 2 - 2.6 }
export const ROOM_EXIT = { x: 0, z: ROOM_D / 2 - 0.5 }

/** 집에 있는 주민이 서성이는 자리(방 가운데 기준) */
export const ROOM_HOST = { x: 0.2, z: 0.6 }

/** 플레이어 집 방의 칸 번호. 주민 방(0 ~ 주민 수-1) 뒤쪽에 둔다. */
export const HOME_ROOM = 20

/** 자연사 전시관 방의 칸 번호. 주민 방과 집 방 뒤쪽에 둔다. */
export const MUSEUM_ROOM = 40

/** 해안 동굴 방의 칸 번호. 주민 방과 집, 전시관 뒤쪽에 둔다. */
export const CAVE_ROOM = 60

/** 마을회관(방송센터) 방의 칸 번호. 동굴 방 뒤쪽에 둔다. */
export const HALL_ROOM = 80

/** 도토리 상점 방의 칸 번호. 마을회관 방 뒤쪽에 둔다. */
export const SHOP_ROOM = 100

/**
 * 도토리 상점 방 안의 자리(방 가운데 기준). 부딪힘 원이다. 계산대는 앞쪽 가운데, 점원 두 마리는 계산대 뒤에 선다.
 * 진열대는 왼쪽 벽, ATM 은 오른쪽 벽에 붙는다. ATM 은 +x 쪽 벽을 본다.
 */
export const SHOP_OBJECTS = {
  counter: [
    { x: -1.2, z: -1.2, r: 0.6 },
    { x: 0, z: -1.2, r: 0.6 },
    { x: 1.2, z: -1.2, r: 0.6 },
  ],
  /** 점원은 계산대 뒤 한 칸 높은 단에 선다(단 높이 SHOP_STEP_H) */
  clerks: [
    { id: 'garam', x: -1.2, z: -2.4, r: 0.45 },
    { id: 'narl', x: 1.2, z: -2.4, r: 0.45 },
  ],
  atm: { x: 3.9, z: 0.4, r: 0.6 },
}
/** 점원이 서는 단의 높이와 가로·세로(방 가운데 기준) */
export const SHOP_STEP = { x: 0, z: -2.4, w: 3.2, d: 1.0, h: 0.4 }
/** 진열대 자리. 상점 단계가 오를수록 앞에서부터 한 칸씩 늘어난다(처음 두 칸). */
export const SHOP_SHELVES = [
  { x: -3.8, z: -2.4, r: 0.6 },
  { x: -3.8, z: -0.4, r: 0.6 },
  { x: 3.8, z: -2.4, r: 0.6 },
  { x: -3.8, z: 1.6, r: 0.6 },
  { x: 3.8, z: 2.2, r: 0.6 },
]
/** 상점 단계(0~3)에 따른 진열대 수 */
export const shopRoom = { tier: 0 }
export const shopShelvesNow = () => SHOP_SHELVES.slice(0, 2 + Math.min(3, Math.max(0, shopRoom.tier)))
export const shopSolidsNow = (): RoomSolid[] => [...SHOP_OBJECTS.counter, ...SHOP_OBJECTS.clerks, ...shopShelvesNow(), SHOP_OBJECTS.atm]

/** 마을회관 방 안의 자리(방 가운데 기준). 부딪힘 원이고 E 로 쓴다. 접수대는 왼쪽, 마이크 책상은 오른쪽, 게시판은 뒷벽이다. */
export const HALL_OBJECTS = {
  reception: { x: -3, z: -1.4, r: 0.9 },
  mic: { x: 3, z: -1.4, r: 0.9 },
  board: { x: 0, z: -3.2, r: 0.7 },
}
export const HALL_SOLIDS: RoomSolid[] = [HALL_OBJECTS.reception, HALL_OBJECTS.mic, HALL_OBJECTS.board]

/** 동굴 방 안 광석 벽 자리(방 가운데 기준). 벽 쪽에 붙어 서서 E 로 캔다. */
export const CAVE_NODES = [
  { x: -3, z: -3.5 },
  { x: 0, z: -3.6 },
  { x: 3, z: -3.5 },
]

/** 동굴 깊은 곳 상자 자리 */
export const CAVE_CHEST = { x: 3.9, z: -2.4 }

/** 웅덩이 두 곳. 물이라 걸을 수 없다. */
export const CAVE_POOLS: RoomSolid[] = [
  { x: -2.6, z: 0.9, r: 0.9 },
  { x: 2.8, z: 1.4, r: 0.75 },
]

/** 동굴 방 안에서 부딪히는 원 전부(광석 벽·상자·웅덩이) */
export const CAVE_SOLIDS: RoomSolid[] = [
  ...CAVE_NODES.map((n) => ({ ...n, r: 0.55 })),
  { ...CAVE_CHEST, r: 0.6 },
  ...CAVE_POOLS,
]

/** 방 가운데 기준 부딪힘 원 */
export interface RoomSolid {
  x: number
  z: number
  r: number
}

/**
 * 플레이어 방에 있는 가구 원. 침대·보관함과 놓은 가구가 들어간다. store 가 가구가 바뀔 때 채운다.
 * 주민 방은 ROOM_FURNITURE 를 쓰므로 이 목록은 HOME_ROOM 에서만 읽는다.
 */
export const roomSolids: { home: RoomSolid[]; museum: RoomSolid[] } = { home: [], museum: [] }

export function roomWalkable(x: number, z: number, pad = 0.3): boolean {
  const i = roomIndexAt(x, z)
  if (i < 0) return false
  const c = roomCenter(i)
  const lx = x - c.x
  const lz = z - c.z
  if (i === HOME_ROOM && homeRoom.floor === 1) {
    // 다락 위: 다락 바닥 안에서만 걸을 수 있다. 가장자리 난간 밖으로는 나갈 수 없다.
    if (lx < ATTIC.x0 + pad || lx > ATTIC.x1 - pad || lz < ATTIC.z0 + pad || lz > ATTIC.z1 - pad) return false
    return !roomSolids.home.some((f) => Math.hypot(lx - f.x, lz - f.z) < f.r + pad)
  }
  const size = roomSizeAt(i)
  if (Math.abs(lx) > size.w / 2 - 0.35 - pad || Math.abs(lz) > size.d / 2 - 0.35 - pad) return false
  const solids: readonly RoomSolid[] = i === HOME_ROOM ? roomSolids.home : i === MUSEUM_ROOM ? roomSolids.museum : i === CAVE_ROOM ? CAVE_SOLIDS : i === HALL_ROOM ? HALL_SOLIDS : i === SHOP_ROOM ? shopSolidsNow() : ROOM_FURNITURE
  return !solids.some((f) => Math.hypot(lx - f.x, lz - f.z) < f.r + pad)
}

/** 키 큰 가구. 대화 카메라 시선을 가린다. */
const TALL = new Set(['dresser', 'shelf'])

/**
 * 방 안에서 카메라 자리·시선이 가리는지. 옆·뒤 벽 밖이면 벽에 가리고, 문 쪽(+z)은 벽이 없어 열려 있다.
 * 키 큰 가구도 시선을 막는다.
 */
export function roomViewBlocked(x: number, z: number): boolean {
  const i = Math.round(z / ROOM_GAP)
  const c = roomCenter(i)
  const lx = x - c.x
  const lz = z - c.z
  const size = roomSizeAt(i)
  if (Math.abs(lx) > size.w / 2 - 0.3 || lz < -size.d / 2 + 0.3) return true
  return ROOM_FURNITURE.some((f) => TALL.has(f.id) && Math.hypot(lx - f.x, lz - f.z) < f.r)
}

/**
 * 집 방이 화면 가로에 다 들어오도록 카메라를 뒤로 빼는 배율. 가로가 좁은 화면(세로 폰)에서 방이 잘리지 않게 한다.
 * halfExtent 는 플레이어에서 방 가장자리까지 가로 거리(다락에서는 사다리 위치만큼 더 멀다), baseDist 는 기본 카메라와 플레이어 사이 거리,
 * margin 은 벽 바깥 여백이다. 넓은 화면은 1 이다.
 */
export function roomCamPull(width: number, height: number, fovDeg: number, halfExtent: number, baseDist: number, margin = 0.9): number {
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * (width / height)
  const need = (halfExtent + margin) / tanH
  return Math.max(1, need / baseDist)
}
