import { homeDef, type HomeStage } from './home'

/** 집 바깥 세 부분. 텐트에는 칠할 수 없다. */
export type PaintPart = 'roof' | 'wall' | 'door'

/** 색 고른 칸. 0번은 항상 기본색이다. 지붕·벽 기본색은 단계마다 달라 color 가 null 이면 단계 색을 쓴다. */
export interface PaintOption {
  name: string
  color: string | null
}

export const PAINT_OPTIONS: Record<PaintPart, readonly PaintOption[]> = {
  roof: [
    { name: '기본', color: null },
    { name: '적갈', color: '#a4413a' },
    { name: '남색', color: '#3f5a7a' },
    { name: '소나무', color: '#3f6b4a' },
    { name: '자주', color: '#6d4c8a' },
    { name: '잿빛', color: '#5b6170' },
  ],
  // 벽은 주민 집의 크림색(#fff4e2)과 겹치지 않게 크림 계열을 뺐다
  wall: [
    { name: '기본', color: null },
    { name: '민트', color: '#bfe3d6' },
    { name: '하늘', color: '#bcd8ee' },
    { name: '살구', color: '#f6c9a0' },
    { name: '연보라', color: '#d9cbe8' },
  ],
  door: [
    { name: '밤나무', color: '#8a5a3b' },
    { name: '소나무', color: '#3f6b4a' },
    { name: '남색', color: '#3f5a7a' },
    { name: '노랑', color: '#e0a526' },
  ],
}

/** 한 번 바꿀 때 드는 도토리 */
export const PAINT_COST: Record<PaintPart, number> = { roof: 1000, wall: 600, door: 300 }

export const PAINT_PARTS: readonly PaintPart[] = ['roof', 'wall', 'door']

export const PAINT_PART_NAME: Record<PaintPart, string> = { roof: '지붕', wall: '벽', door: '문' }

/** 공사 판이 서 있는 시간(밀리초). 색을 고른 뒤 이 동안 비계가 집을 두른다. */
export const PAINT_SCAFFOLD_MS = 800

/** 저장되는 색 번호. 칸 번호가 바뀌거나 모르는 값이면 0(기본)으로 돌린다. */
export interface HomePaint {
  roof: number
  wall: number
  door: number
}

export const DEFAULT_PAINT: HomePaint = { roof: 0, wall: 0, door: 0 }

export function cleanPaint(raw: unknown): HomePaint {
  const p = (raw ?? {}) as Partial<Record<PaintPart, unknown>>
  const pick = (part: PaintPart): number => {
    const v = p[part]
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < PAINT_OPTIONS[part].length ? v : 0
  }
  return { roof: pick('roof'), wall: pick('wall'), door: pick('door') }
}

/** 단계와 색 번호로 실제로 그릴 세 색. */
export function paintColors(stage: HomeStage, paint: HomePaint): Record<PaintPart, string> {
  const look = homeDef(stage).look
  return {
    roof: PAINT_OPTIONS.roof[paint.roof].color ?? look.roof,
    wall: PAINT_OPTIONS.wall[paint.wall].color ?? look.wall,
    door: PAINT_OPTIONS.door[paint.door].color ?? '#8a5a3b',
  }
}

/**
 * 외관 꾸미기 맨 위 한 줄 안내. 도토리가 가장 싼 칸보다 모자라면 얼마나 더 모아야 하는지 말하고,
 * 아직 아무것도 안 칠했으면 가장 싼 문부터 권한다. 그 밖에는 칸별 가격을 보여 준다.
 */
export function paintHint(money: number, paint: HomePaint): string {
  const cheapest = Math.min(...PAINT_PARTS.map((part) => PAINT_COST[part]))
  if (money < cheapest) return `도토리 ${(cheapest - money).toLocaleString()}개만 더 모으면 문을 칠할 수 있어요`
  const untouched = PAINT_PARTS.every((part) => paint[part] === DEFAULT_PAINT[part])
  if (untouched) return `처음이라면 문(도토리 ${PAINT_COST.door.toLocaleString()}개)부터 칠해 보세요`
  return PAINT_PARTS.map((part) => `${PAINT_PART_NAME[part]} 🌰 ${PAINT_COST[part].toLocaleString()}`).join(' · ')
}

/**
 * 외관 칠하기를 알리는 편지를 오늘 보낼지. 어제 집을 짓거나 늘렸고(homeDay 가 어제), 아직 한 번도 칠하지 않았을 때만 참이다.
 * 한 번이라도 칠한 플레이어에게는 다시 알리지 않는다.
 */
export function paintTipDue(homeDay: string | null, yesterday: string, paint: HomePaint): boolean {
  return homeDay === yesterday && PAINT_PARTS.every((part) => paint[part] === DEFAULT_PAINT[part])
}

/** 이 칸을 고를 수 있는지: 지금 색이거나 도토리가 정가 이상이면 된다. 모자란 칸은 흐리게 보여 준다. */
export function paintAffordable(money: number, part: PaintPart, index: number, paint: HomePaint): boolean {
  return paint[part] === index || money >= PAINT_COST[part]
}

/**
 * 실내 벽지 칸. 0번은 기본 크림(#eadbc2)이다. 바닥·가구보다 한 톤 밝게 두고, 집 점수에는 넣지 않는다.
 * 외관 칠과 달리 색 값만 바뀐다.
 */
export const INTERIOR_WALLS: readonly { name: string; color: string }[] = [
  { name: '크림', color: '#eadbc2' },
  { name: '연두', color: '#d9e5c8' },
  { name: '하늘', color: '#d5e4ee' },
  { name: '분홍', color: '#efd6d0' },
  { name: '회색', color: '#dcdfe2' },
]

/** 벽지 한 번 바꿀 때 드는 도토리 */
export const INTERIOR_WALL_COST = 400

/** 저장되는 벽지 번호. 칸이 없거나 모르는 값이면 0(크림)으로 돌린다. */
export function cleanInteriorWall(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < INTERIOR_WALLS.length ? raw : 0
}

export function interiorWallColor(index: number): string {
  return INTERIOR_WALLS[cleanInteriorWall(index)].color
}

/** 벽지 칸을 고를 수 있는지: 지금 벽지이거나 도토리가 정가 이상이면 된다. */
export function interiorAffordable(money: number, index: number, current: number): boolean {
  return current === index || money >= INTERIOR_WALL_COST
}
