/**
 * 새 집이 완성된 아침의 안내와 연출 판정. 날짜와 거리만 보고, 그리기와 토스트는 scene 과 store 가 한다.
 * 완성된 날 하루 동안 현관 옆에 깃발이 서고, 문 앞에서 처음 들어갈 때 한 번 안내한다.
 */

import { dayIndex } from './economy'
import { josa } from './items'
import { hasAttic, hasCellar, hasSideRoom, homeDef, isHomeStage, type HomeStage } from './home'
import { ATTIC, MAIN_EAST_WALL_DOOR, MAIN_STAIR, type HomeFloor } from './interior'

/** 완성된 날, 안내를 했는지, 완성 전 단계. 저장 칸은 선택이라 예전 저장에는 없다. */
export interface HomeNew {
  day: string
  greeted: boolean
  from: HomeStage
  /** 가 본 새 방(1 다락, 2 옆방, 3 지하실). 저장 칸은 선택이라 예전 저장에는 없다. */
  visited?: HomeFloor[]
}

/** 집 근처로 볼 반경(칸). 이 안에 처음 들어오면 깃발이 선다. */
export const HOME_NEAR_R = 8

/** 불러온 값을 검증한다. 날짜나 단계가 잘못됐거나 객체가 아니면 연출이 없다(null). */
export function cleanHomeNew(v: unknown): HomeNew | null {
  if (!v || typeof v !== 'object') return null
  const { day, greeted, from } = v as Partial<HomeNew>
  if (typeof day !== 'string' || dayIndex(day) === null || !isHomeStage(from)) return null
  const seen = Array.isArray((v as Partial<HomeNew>).visited) ? (v as HomeNew).visited!.filter(isNewFloor) : []
  const visited = [...new Set(seen)]
  return visited.length ? { day, greeted: greeted === true, from, visited } : { day, greeted: greeted === true, from }
}

/**
 * 이전 단계와 비교해 늘어난 것만 적는다. 가구 칸은 격자(가로×세로), 보관은 보관 칸 수다.
 * 둘 다 그대로면 방이 새로 늘었다는 말만 한다(옆방·지하실처럼 격자가 같은 단계).
 */
export function homeGrowthText(from: HomeStage, to: HomeStage): string {
  const parts = gridGrowthParts(from, to)
  return parts.length ? `${josa(parts.join(' · '), '이', '가')} 됐어요` : '방이 새로 늘었어요'
}

/** 가구 격자와 보관 칸이 늘었는지 나눠 적는다. 늘지 않았으면 빈 배열이다. */
export function gridGrowthParts(from: HomeStage, to: HomeStage): string[] {
  const a = homeDef(from)
  const b = homeDef(to)
  const parts: string[] = []
  if (a.grid.w !== b.grid.w || a.grid.h !== b.grid.h) parts.push(`가구 칸 ${b.grid.w}×${b.grid.h}`)
  if (a.storage !== b.storage) parts.push(`보관 ${b.storage}칸`)
  return parts
}

/**
 * 이번 증축으로 새로 열린 방과 가는 길. 본채 방 안에서 다락은 사다리, 옆방은 오른쪽 벽 문, 지하실은 구석 계단으로 간다.
 * 새로 생긴 방이 없으면 빈 배열이다.
 */
export function newRoomNotes(from: HomeStage, to: HomeStage): string[] {
  const out: string[] = []
  if (newRoomFloors(from, to).includes(1)) out.push('다락이 생겼어요. 방 안 사다리로 올라가요')
  if (newRoomFloors(from, to).includes(2)) out.push('옆방이 생겼어요. 오른쪽 벽 문으로 가요')
  if (newRoomFloors(from, to).includes(3)) out.push('지하실이 생겼어요. 구석 계단으로 내려가요')
  return out
}

/** 새 방 층 목록(다락 1, 옆방 2, 지하실 3). 이번 증축으로 처음 열린 것만 든다. */
export function newRoomFloors(from: HomeStage, to: HomeStage): HomeFloor[] {
  const out: HomeFloor[] = []
  if (hasAttic(to) && !hasAttic(from)) out.push(1)
  if (hasSideRoom(to) && !hasSideRoom(from)) out.push(2)
  if (hasCellar(to) && !hasCellar(from)) out.push(3)
  return out
}

const isNewFloor = (v: unknown): v is HomeFloor => v === 1 || v === 2 || v === 3

/** 새 방 가운데 아직 안 가 본 첫 방(사다리 → 옆문 → 계단 순). 완성된 날에만 가리키고, 없으면 null 이다. */
export function pointerFloor(homeNew: HomeNew | null, day: string, to: HomeStage): HomeFloor | null {
  if (!homeNew || homeNew.day !== day) return null
  const seen = homeNew.visited ?? []
  return newRoomFloors(homeNew.from, to).find((f) => !seen.includes(f)) ?? null
}

/** 새 방에 들어가면 기록한다. 바뀌지 않으면 같은 객체를 돌려준다. 본채(0)는 기록하지 않는다. */
export function markRoomVisited(homeNew: HomeNew, floor: HomeFloor): HomeNew {
  if (!isNewFloor(floor)) return homeNew
  const seen = homeNew.visited ?? []
  if (seen.includes(floor)) return homeNew
  return { ...homeNew, visited: [...seen, floor] }
}

/**
 * 가리킴 자리(방 가운데 기준 x·z, 바닥 위 높이). 화살표 끝이 대상 바로 위에 오도록 대상의 맨 위보다 높게 잡는다.
 * 사다리는 다락 바닥(ATTIC.floorY) 위, 옆문은 문틀(1.6) 위, 계단은 디딤판 위다.
 */
export const POINTER_SPOT: Record<1 | 2 | 3, { x: number; z: number; h: number }> = {
  1: { x: ATTIC.ladderX, z: ATTIC.ladderFootZ, h: ATTIC.floorY + 0.4 },
  2: { x: MAIN_EAST_WALL_DOOR.x - 0.5, z: MAIN_EAST_WALL_DOOR.z, h: 2.1 },
  3: { x: MAIN_STAIR.x, z: MAIN_STAIR.z, h: 1.6 },
}

/** 플레이어가 집 현관 자리에서 반경 안에 있는지 */
export function nearHome(px: number, pz: number, site: { x: number; z: number } | null): boolean {
  if (!site) return false
  return Math.hypot(px - site.x, pz - site.z) <= HOME_NEAR_R
}

/** 깃발은 완성된 날에만, 플레이어가 한 번이라도 집 근처에 온 뒤에 선다. */
export function homeRibbonShown(homeNew: HomeNew | null, day: string, nearSeen: boolean): boolean {
  return !!homeNew && homeNew.day === day && nearSeen
}

/** 문 앞에서 처음 들어갈 때 한 번만 하는 안내. 완성된 날에만 주고, 다음 상태를 함께 돌려준다. */
export function newHomeGreeting(homeNew: HomeNew | null, day: string, to: HomeStage): { text: string; next: HomeNew } | null {
  if (!homeNew || homeNew.day !== day || homeNew.greeted) return null
  // 새 방이 생겼으면 방 이름과 가는 길을 적고, 같은 말(방이 늘었다)은 빼서 한 줄로 줄인다
  const rooms = newRoomNotes(homeNew.from, to)
  const grid = gridGrowthParts(homeNew.from, to)
  // 방 이름이 뒤에 붙을 때만 문장을 끊는다
  const gridLine = grid.length ? `${josa(grid.join(' · '), '이', '가')} 됐어요${rooms.length ? '.' : ''}` : ''
  const roomLine = rooms.join(' ')
  const body = [gridLine, roomLine].filter(Boolean).join(' ') || '방이 새로 늘었어요'
  return { text: `🏡 새 집에 들어왔어요! ${body}`, next: { ...homeNew, greeted: true } }
}

/** 새 방에 처음 들어갔는지. 아직 안 가 본 새 방이면 참이다(본채와 예전 방은 늘 거짓). 들어가기 전에 불러야 한다. */
export function isFirstRoomVisit(homeNew: HomeNew | null, floor: HomeFloor): boolean {
  if (!homeNew || !isNewFloor(floor)) return false
  return !(homeNew.visited ?? []).includes(floor)
}

/**
 * 집 안에서 층을 옮겼을 때 알리는 한 줄. 처음 들어간 새 방이면 주머니에서 가구를 꺼내 놓는 법을 한 줄 붙인다.
 * 다시 들어간 방이나 본채로 돌아오는 알림에는 붙이지 않는다.
 */
export function floorArrivalText(from: HomeFloor, to: HomeFloor, first: boolean): string {
  const base = to === 1 ? '다락에 올라왔어요' : to === 2 ? '옆방으로 왔어요' : to === 3 ? '지하실로 내려왔어요' : from === 1 ? '방바닥으로 내려왔어요' : from === 3 ? '본채로 올라왔어요' : '본채로 돌아왔어요'
  return first && to !== 0 ? `${base}. 주머니에서 가구를 꺼내 놓아요` : base
}

/** 새 방마다 어울리는 선물 가구. 이미 있는 가구 가운데 고르고, 상점에는 올리지 않는다. 편지 id 는 방 이름(key)으로 정한다. */
export const ROOM_GIFT: Partial<Record<HomeFloor, { key: string; label: string; item: string }>> = {
  1: { key: 'attic', label: '다락', item: 'wind-chime' },
  2: { key: 'side', label: '옆방', item: 'reading-chair' },
  3: { key: 'cellar', label: '지하실', item: 'storage-shelf' },
}

/** 어제 새 방이 열렸으면 오늘 아침 선물을 보낼 방 층 목록. 집을 지은 다음 날 한 번만 돌려준다. */
export function roomGiftFloors(homeNew: HomeNew | null, yesterday: string, stage: HomeStage): HomeFloor[] {
  if (!homeNew || homeNew.day !== yesterday) return []
  return newRoomFloors(homeNew.from, stage)
}

/** 방 옮김 알림인지. 새 이동이 뜨면 줄에 남은 옛 이동 알림을 지울 때 쓴다. 문구 뒤에 설명이 붙어도 같은 종류로 본다. */
const AREA_ARRIVAL_STEMS = ['옆방으로 왔어요', '지하실로 내려왔어요', '본채로 올라왔어요', '본채로 돌아왔어요']
export function isAreaArrivalText(text: string): boolean {
  return AREA_ARRIVAL_STEMS.some((stem) => text.startsWith(stem))
}
