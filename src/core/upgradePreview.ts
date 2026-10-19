/**
 * 집 상담의 "증축하면 이렇게 바뀌어요" 미리보기. 지금 단계와 다음 단계의 가구 칸, 벽걸이 자리, 새로 생기는 방을 센다.
 * 칸 수는 homeCells·wallSlots 를 그대로 쓰므로 실제 배치 규칙과 어긋나지 않는다. 모든 함수는 순수하다.
 */

import { floorOpen, homeCells, nextStage, type HomeStage } from './home'
import type { HomeFloor } from './interior'
import { wallSlots } from './wallHang'
import { josa } from './items'

/** 층 이름(새로 생기는 방 줄에 쓴다). 본채는 늘 있으니 빼고 센다. */
const ROOM_NAME: Record<Exclude<HomeFloor, 0>, string> = { 1: '다락', 2: '옆방', 3: '지하실' }
const FLOORS: readonly HomeFloor[] = [0, 1, 2, 3]

/** 한 단계의 자리 수 */
export interface StageSpace {
  /** 가구를 놓을 칸(모든 열린 층 합계) */
  cells: number
  /** 벽걸이 자리(모든 열린 층 합계, 방향별) */
  walls: { n: number; e: number; w: number }
  /** 열린 층 번호 목록 */
  floors: HomeFloor[]
}

/** 단계의 자리 수. 열리지 않은 층은 칸이 0이라 세지 않는다. */
export function stageSpace(stage: HomeStage): StageSpace {
  const walls = { n: 0, e: 0, w: 0 }
  let cells = 0
  const floors: HomeFloor[] = []
  for (const f of FLOORS) {
    if (!floorOpen(stage, f)) continue
    floors.push(f)
    cells += homeCells(stage, f).length
    for (const slot of wallSlots(stage, f)) {
      if (slot.dir === 'n' || slot.dir === 'e' || slot.dir === 'w') walls[slot.dir]++
    }
  }
  return { cells, walls, floors }
}

/** 증축 미리보기. 다음 단계가 없으면 null 이다. */
export interface UpgradePreview {
  from: StageSpace
  to: StageSpace
  /** 새로 열리는 방 이름(다락·옆방·지하실) */
  newRooms: string[]
}

export function upgradePreview(stage: HomeStage): UpgradePreview | null {
  const next = nextStage(stage)
  if (!next) return null
  const from = stageSpace(stage)
  const to = stageSpace(next.stage)
  const newRooms = to.floors.filter((f) => f !== 0 && !from.floors.includes(f)).map((f) => ROOM_NAME[f as Exclude<HomeFloor, 0>])
  return { from, to, newRooms }
}

/** 미리보기 줄(해요체). 가구 칸, 벽걸이 자리 합계, 새 방 순서로 세 줄이다. 숫자가 같으면 그대로라고 쓴다. */
export function upgradeLines(p: UpgradePreview): string[] {
  const wallsOf = (s: StageSpace['walls']) => s.n + s.e + s.w
  const cellsLine = p.from.cells === p.to.cells
    ? '가구 칸은 그대로예요'
    : `가구 칸이 ${p.from.cells}칸에서 ${p.to.cells}칸으로 늘어나요`
  const fromWalls = wallsOf(p.from.walls)
  const toWalls = wallsOf(p.to.walls)
  const wallsLine = fromWalls === toWalls
    ? '벽걸이 자리는 그대로예요'
    : `벽걸이 자리가 ${fromWalls}곳에서 ${toWalls}곳으로 늘어나요`
  return [
    cellsLine,
    wallsLine,
    p.newRooms.length ? `${josa(p.newRooms.join(', '), '이', '가')} 새로 생겨요` : '새로 생기는 방은 없어요',
  ]
}
