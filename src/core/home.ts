/**
 * 내 집 — 텐트에서 시작해 대출로 집을 짓고, 빚을 갚아야 다음 집을 짓는다.
 *
 * 흐름: 텐트(무료) → 작은 집 → 큰 집 → 다락방 증축 → 옆방 → 지하실. 집을 지으면 값이 빚(loan)으로 잡히고
 * 다음날 아침 완성된다. 빚이 0 이 되어야 다음 단계를 맡길 수 있다. 이자는 없다(마을 느낌을 살리려고).
 *
 * 숫자 근거:
 * - 작은 집 2500 은 중반 하루 수입 1000 안팎의 2~3일 치다. 상점 1단계(1500)보다 조금 비싸 순서가 맞는다.
 * - 큰 집 8000 은 상점 2단계 6000 보다 크다. 집이 가장 큰 지출이라는 뜻.
 * - 다락방 5000 은 "방 하나 더"라 큰 집보다 싸다. 증축은 이미 있는 집에 붙이는 값이다.
 * - 옆방 7000, 지하실 9000 은 방이 하나씩 늘 때마다 값이 오르는 순서다. 지하실이 가장 큰 증축이다.
 * - 보관 칸(storage)은 주머니 최대 40칸과 맞춘다. 집 보관은 주머니를 넘는 여분 자리다.
 * - 가구 격자는 주민 집 방(ROOM_W 10 × ROOM_D 8)보다 작게 둬서 주민 방 배치와 어긋나지 않게 한다.
 */

import { BAD_AMOUNT, dayDiff, dayIndex, isNonNegativeAmount, isWholeAmount, type Result, BAD_DAY } from './economy'
import { byWater, isWalkable, normDist } from './island'
import type { Placed } from './placement'
import { ATTIC, ATTIC_CELLS, bedOf, CELLAR_CELLS, chestOf, FLOOR_STAGE, HOME_ROOM_SIZES, type HomeFloor, SIDE_CELLS, type RoomSolid } from './interior'
import { HOUSE_R, reservedByHomes } from './villagers'
import { flatWithin } from './tiers'
import { doorOrder, pickDoorRot } from './doorFacing'
import { blockedByFixedProps, SHOP, SHOP_MAX, SPAWN } from './world'

export type HomeStage = 0 | 1 | 2 | 3 | 4 | 5

export interface HomeStageDef {
  stage: HomeStage
  name: string
  icon: string
  /** 이 단계를 짓는 데 잡히는 빚(도토리). 텐트는 0. */
  loan: number
  /** 방 안 가구 격자 칸 수(가로×세로) */
  grid: { w: number; h: number }
  /** 집 보관 칸 수. 주머니와 별도다. */
  storage: number
  look: { roof: string; wall: string; label: string }
}

export const HOME_STAGES: readonly HomeStageDef[] = [
  { stage: 0, name: '텐트', icon: '⛺', loan: 0, grid: { w: 3, h: 3 }, storage: 10, look: { roof: '#f2c14e', wall: '#fbf3e4', label: '줄무늬 텐트' } },
  { stage: 1, name: '작은 집', icon: '🏠', loan: 2500, grid: { w: 4, h: 4 }, storage: 20, look: { roof: '#b5653b', wall: '#f6e7c8', label: '판자 집' } },
  { stage: 2, name: '큰 집', icon: '🏡', loan: 8000, grid: { w: 5, h: 5 }, storage: 30, look: { roof: '#7a4a2e', wall: '#fff3dc', label: '기와 두 채 집' } },
  { stage: 3, name: '다락방 증축', icon: '🪜', loan: 5000, grid: { w: 6, h: 5 }, storage: 40, look: { roof: '#4f7a5a', wall: '#fff3dc', label: '다락창 달린 집' } },
  // 옆방·지하실은 본채 가구 칸(6×5)을 그대로 두고, 자리마다 따로 있는 가구 칸을 더한다(FLOOR_STAGE·AREA_CELLS)
  { stage: 4, name: '옆방 증축', icon: '🏘️', loan: 7000, grid: { w: 6, h: 5 }, storage: 40, look: { roof: '#4f7a5a', wall: '#fff3dc', label: '별채가 붙은 집' } },
  { stage: 5, name: '지하실 증축', icon: '🕳️', loan: 9000, grid: { w: 6, h: 5 }, storage: 40, look: { roof: '#4f7a5a', wall: '#fff3dc', label: '지하창 있는 집' } },
]

export interface HomeState {
  stage: HomeStage
  /** 남은 빚. 새로 짓는 중에도 빚은 바로 잡힌다. */
  loan: number
  /** 짓기를 맡긴 날과 목표 단계. 없으면 짓는 중이 아니다. */
  order: { to: HomeStage; day: string } | null
}

export const NEW_HOME: HomeState = { stage: 0, loan: 0, order: null }

export function isHomeStage(n: unknown): n is HomeStage {
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5
}

export function homeDef(stage: HomeStage): HomeStageDef {
  return HOME_STAGES[stage]
}

/** 다음 단계 정의. 마지막 단계면 null. */
export function nextStage(stage: HomeStage): HomeStageDef | null {
  return isHomeStage(stage + 1) ? HOME_STAGES[stage + 1] : null
}

/** 보관 칸 수. 씬과 보관 패널이 함께 쓴다. */
export function storageSlots(stage: HomeStage): number {
  return homeDef(stage).storage
}

/**
 * 다음 단계를 맡길 수 있는지. 빚이 0 이어야 한다(갚아야 다음 집).
 * 성공이면 짓게 될 단계와 새로 잡힐 빚을 준다.
 */
export function canUpgrade(stage: number, loanBalance: number): Result<{ to: HomeStage; loan: number }> {
  if (!isHomeStage(stage)) return { ok: false, reason: '알 수 없는 집이에요' }
  if (!isNonNegativeAmount(loanBalance)) return { ok: false, reason: '대출 금액이 잘못됐어요' }
  const next = nextStage(stage)
  if (!next) return { ok: false, reason: '이미 가장 큰 집이에요' }
  if (loanBalance > 0) return { ok: false, reason: `대출을 다 갚아야 다음 집을 지을 수 있어요 (남은 대출 ${loanBalance.toLocaleString()})` }
  return { ok: true, to: next.stage, loan: next.loan }
}

/**
 * 빚 갚기(금액 계산만). 남은 빚보다 많이 내면 빚만큼만 받는다.
 * `paid` 가 실제로 빠져나갈 도토리다. 호출하는 쪽은 그만큼만 뺀다.
 */
export function applyPayment(balance: number, amount: number): Result<{ balance: number; paid: number }> {
  if (!isNonNegativeAmount(balance)) return { ok: false, reason: '대출 금액이 잘못됐어요' }
  if (!isWholeAmount(amount)) return { ok: false, reason: BAD_AMOUNT }
  if (balance === 0) return { ok: false, reason: '갚을 대출이 없어요' }
  const paid = Math.min(amount, balance)
  return { ok: true, balance: balance - paid, paid }
}

/** 가진 도토리로 빚 갚기. 돈이 모자라면 실패한다. */
export function payLoan(money: number, balance: number, amount: number): Result<{ money: number; balance: number; paid: number }> {
  if (!isNonNegativeAmount(money)) return { ok: false, reason: '도토리 금액이 잘못됐어요' }
  const r = applyPayment(balance, amount)
  if (!r.ok) return r
  if (money < r.paid) return { ok: false, reason: '도토리가 모자라요' }
  return { ok: true, money: money - r.paid, balance: r.balance, paid: r.paid }
}

/**
 * 다음 집 짓기를 맡긴다. 빚이 잡히고, 다음날 `settleHome` 에서 완성된다.
 * 공사 중이면 실패한다.
 */
export function startHomeUpgrade(state: HomeState, day: string): Result<{ state: HomeState; to: HomeStage }> {
  if (dayIndex(day) === null) return { ok: false, reason: BAD_DAY }
  if (state.order) return { ok: false, reason: '이미 짓는 중이에요. 내일 아침에 완성돼요' }
  const r = canUpgrade(state.stage, state.loan)
  if (!r.ok) return r
  return { ok: true, to: r.to, state: { stage: state.stage, loan: r.loan, order: { to: r.to, day } } }
}

/** 맡긴 날 다음 날부터 완성된 것으로 본다. 완성됐으면 단계를 올리고 기록을 지운다. */
export function settleHome(state: HomeState, day: string): HomeState {
  const diff = state.order ? dayDiff(state.order.day, day) : null
  if (!state.order || diff === null || diff < 1) return state
  return { stage: state.order.to, loan: state.loan, order: null }
}

/** 빚 상환 후 화면에 띄울 한 줄 요약. */
export function loanLabel(balance: number): string {
  return balance > 0 ? `대출 도토리 ${balance.toLocaleString()}개 남았어요` : '대출이 없어요'
}

export interface HomePlot {
  x: number
  z: number
  /** 현관이 바라보는 방향(남·동·서 중 하나). */
  rot: number
}

/** 현관 자리(문 앞 DOOR_D)가 걸을 수 있는 평평한 땅이고 소품에 막히지 않는지 */
function doorOpen(x: number, z: number, rot: number): boolean {
  const dx = x + Math.sin(rot) * DOOR_D
  const dz = z + Math.cos(rot) * DOOR_D
  return isWalkable(dx, dz) && flatWithin(dx, dz, 0.5) && !blockedByFixedProps(dx, dz, 0.5)
}

/**
 * 집 자리 고르기. 스폰에서 9~15 거리의 둥근 띠를 방향 16개로 훑어 처음 맞는 곳을 쓴다.
 * 걸러내는 것: 걸을 수 없는 땅, 물가(둑 포함), 나무·바위·상점 등 소품, 주민 집터·산책 마당, 문 앞이 막힌 자리.
 * 현관은 남쪽을 먼저 보고, 막히면 동쪽·서쪽으로 돌린다. 훑는 순서가 고정이라 같은 섬이면 늘 같은 자리다. 맞는 곳이 없으면 null.
 */
export function pickHomePlot(): HomePlot | null {
  const rings = [9, 11, 13, 15]
  for (const r of rings) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const x = SPAWN.x + Math.cos(a) * r
      const z = SPAWN.z + Math.sin(a) * r
      if (normDist(x, z) > 0.6) continue
      if (!isWalkable(x, z) || !flatWithin(x, z, HOUSE_R)) continue
      // 상점은 단계가 올라가면 가장 큰 크기까지 자란다. 현재 크기와 무관하게 늘 비워 둔다.
      if (Math.abs(x - SHOP.x) < SHOP_MAX.w / 2 + HOUSE_R && Math.abs(z - SHOP.z) < SHOP_MAX.d / 2 + HOUSE_R) continue
      // 집 반지름만큼은 물·소품·주민 자리와 떨어뜨린다.
      if (byWater(x, z, HOUSE_R)) continue
      if (blockedByFixedProps(x, z, HOUSE_R)) continue
      if (reservedByHomes(x, z, HOUSE_R + 0.5)) continue
      // 현관은 남→동→서 순으로 보고, 문 앞이 걸을 수 있는 첫 방향을 쓴다(doorFacing.ts)
      const rot = pickDoorRot(doorOrder(), (r) => doorOpen(x, z, r))
      if (rot === null) continue
      return { x, z, rot }
    }
  }
  return null
}

/** 집 안 가구 칸의 반지름. 배치 충돌과 방 부딪힘 원에 같이 쓴다. */
const ROOM_FURNITURE_R = 0.45

/** 집 단계별 몸체 반지름. 섬 충돌 원으로 쓴다. 텐트는 작고 다락방 증축 집은 큰 집과 같다. */
const BODY_R = [1.1, 1.5, 1.75, 1.75, 2.4, 2.4] as const

export const homeRadius = (stage: HomeStage): number => BODY_R[stage]

/** 자리마다 따로 있는 가구 칸. 본채(0)는 단계 격자를 쓰고 나머지는 여기서 정한다. */
const AREA_CELLS: Record<Exclude<HomeFloor, 0>, { x0: number; z0: number; w: number; h: number }> = { 1: ATTIC_CELLS, 2: SIDE_CELLS, 3: CELLAR_CELLS }

/** 이 단계에서 그 자리(층·방)가 열려 있는지. 다락은 3단계, 옆방은 4단계, 지하실은 5단계부터다. */
export function floorOpen(stage: HomeStage, floor: HomeFloor): boolean {
  return stage >= FLOOR_STAGE[floor]
}

/** 다락이 있는 단계(3 이상). 다락 바닥 표시, 사다리, 다락 가구 칸, 집 외형이 모두 이 판정을 쓴다. */
export const hasAttic = (stage: HomeStage) => floorOpen(stage, 1)
/** 옆방이 있는 단계(4 이상) */
export const hasSideRoom = (stage: HomeStage) => floorOpen(stage, 2)
/** 지하실이 있는 단계(5 이상) */
export const hasCellar = (stage: HomeStage) => floorOpen(stage, 3)

/**
 * 방 안에서 가구를 놓을 수 있는 칸(방 가운데 기준 정수 좌표). 단계마다 방 크기에 맞춰 뒷벽 쪽부터 채운다.
 * 다락(1)·옆방(2)·지하실(3)은 자리마다 따로 있는 칸을 쓴다.
 */
export function homeCells(stage: HomeStage, floor: HomeFloor = 0): { x: number; z: number }[] {
  const cells: { x: number; z: number }[] = []
  if (!floorOpen(stage, floor)) return cells
  if (floor !== 0) {
    const a = AREA_CELLS[floor]
    for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) cells.push({ x: a.x0 + i, z: a.z0 + j })
    return cells
  }
  const { w, h } = homeDef(stage).grid
  const size = HOME_ROOM_SIZES[stage]
  const x0 = -Math.floor(w / 2)
  // 뒷벽 쪽에서 시작해 앞(문 쪽)을 비워 둔다. 방이 작을수록 뒷벽 쪽 줄도 얕아진다.
  const z0 = -Math.floor(size.d / 2) + 1
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.push({ x: x0 + i, z: z0 + j })
  return cells
}

/**
 * 방 가구 칸 하나에 못 놓는 까닭 한 줄. 놓을 수 있으면 null. 칸 밖, 같은 층의 다른 가구, 고정 물건과 겹치면 안 된다.
 * 놓기 안내 글과 빨간 칸 설명이 이 문장을 같이 쓴다.
 */
export function homePlaceBlocker(x: number, z: number, stage: HomeStage, placed: readonly Placed[], floor: HomeFloor = 0): string | null {
  if (!homeCells(stage, floor).some((c) => c.x === x && c.z === z)) return '방 안쪽 칸에만 놓을 수 있어요'
  // 벽에 건 가구는 벽 면에 붙어 있어 바닥 칸을 막지 않는다
  if (placed.some((p) => !p.wall && (p.floor ?? 0) === floor && p.x === x && p.z === z)) return '이미 가구가 있는 칸이에요'
  // 다락에서는 사다리를 올라와 서는 자리(난간 앞)를 비워 둔다. 가구가 거기 있으면 내려갈 곳이 없다.
  if (floor === ATTIC_FLOOR) return Math.hypot(ATTIC.ladderX - x, ATTIC.climbZ - z) < ATTIC_CLIMB_CLEAR ? '사다리 앞이라 놓을 수 없어요' : null
  if (floor !== 0) return null
  // homeFixed 는 침대, 보관함 순서다
  const [bed, chest] = homeFixed(stage)
  if (Math.hypot(bed.x - x, bed.z - z) < bed.r + ROOM_FURNITURE_R) return '침대 자리라 놓을 수 없어요'
  if (Math.hypot(chest.x - x, chest.z - z) < chest.r + ROOM_FURNITURE_R) return '보관함 앞이라 놓을 수 없어요'
  return null
}

/** 방 가구 칸 하나에 놓을 수 있는지. homePlaceBlocker 가 까닭을 주지 않을 때만 true 다. */
export function canPlaceInHome(x: number, z: number, stage: HomeStage, placed: readonly Placed[], floor: HomeFloor = 0): boolean {
  return homePlaceBlocker(x, z, stage, placed, floor) === null
}

/** 다락 층 번호와, 사다리 앞 자리에서 이 거리(칸) 안의 칸은 가구를 두지 않는다 */
const ATTIC_FLOOR: HomeFloor = 1
const ATTIC_CLIMB_CLEAR = 0.6

/** 이 층에 놓을 수 있는 칸이 하나도 없는지. 칸이 있는데 전부 막혔을 때만 '방이 가득 찼어요'라고 알린다. */
export function homeRoomFull(stage: HomeStage, placed: readonly Placed[], floor: HomeFloor = 0): boolean {
  const cells = homeCells(stage, floor)
  return cells.length > 0 && cells.every((c) => !canPlaceInHome(c.x, c.z, stage, placed, floor))
}

/** 단계 방의 침대와 보관함 자리(방 가운데 기준). 방 크기를 따라 벌어진다. */
export const homeBed = (stage: HomeStage) => bedOf(HOME_ROOM_SIZES[stage])
export const homeChest = (stage: HomeStage) => chestOf(HOME_ROOM_SIZES[stage])

/** 지금 단계 방의 고정 물건(침대·보관함). 본채 방바닥에만 있다. */
export function homeFixed(stage: HomeStage): readonly RoomSolid[] {
  const size = HOME_ROOM_SIZES[stage]
  return [bedOf(size), chestOf(size)]
}

/** 방 부딪힘 원: 지금 층의 고정 물건과 놓인 가구. 플레이어가 가구를 통과하지 못하게 한다. */
export function homeSolids(placed: readonly Placed[], stage: HomeStage, floor: HomeFloor = 0): RoomSolid[] {
  const here = placed.filter((p) => (p.floor ?? 0) === floor)
  const fixed = floor === 0 ? homeFixed(stage) : []
  return [...fixed, ...here.map((p) => ({ x: p.x, z: p.z, r: ROOM_FURNITURE_R }))]
}

/** 집 현관과 집 상담 간판의 자리. 현관은 스폰 쪽을 본다. */
export interface HomeSite extends HomePlot {
  door: { x: number; z: number }
  sign: { x: number; z: number }
}

/** 현관 앞 자리까지의 거리. 가장 큰 몸체(1.75)와 충돌 여유 0.3 밖에 서도록 둔다. */
const DOOR_D = 2.3

export function homeSite(plot: HomePlot): HomeSite {
  const fx = Math.sin(plot.rot)
  const fz = Math.cos(plot.rot)
  // 간판은 현관에서 옆으로 비껴 세운다. 현관 앞에 서면 두 안내가 겹치지 않게 거리를 둔다.
  return {
    ...plot,
    door: { x: plot.x + fx * DOOR_D, z: plot.z + fz * DOOR_D },
    sign: { x: plot.x + fx * 2.4 - fz * 2, z: plot.z + fz * 2.4 + fx * 2 },
  }
}

/**
 * 이 모듈이 로드될 때 한 번 고른 집 자리. 마을·산책길 배치보다 뒤에 정하고, 상점은 가장 큰 크기로 본다.
 * 그래서 저장 상태와 상관없이 같은 자리다. 집 자리를 찾지 못하면 null.
 */
export const HOME_SITE: HomeSite | null = (() => {
  const plot = pickHomePlot()
  return plot ? homeSite(plot) : null
})()
