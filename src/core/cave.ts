/**
 * 해안 동굴. 광석 캐기, 하루 캐는 횟수, 밀물 판정, 일주일에 한 번 여는 상자를 순수 함수로 둔다.
 * 저장은 호출하는 쪽(store)이 한다. 여기서는 값만 계산한다.
 */
import { radiusAt } from './island'
import { FOSSIL_SPECIES } from './items'
import { hashString, mulberry32 } from './rng'
import { RECIPES } from './recipes'

export interface Ore {
  id: string
  name: string
  icon: string
  /** 상점에 파는 값 */
  price: number
  /** 캘 때 나오는 비율 */
  weight: number
}

/** 동굴 벽에서 캘 수 있는 광석 세 종 */
export const ORES: Ore[] = [
  { id: 'amber-stone', name: '호박석', icon: '🟠', price: 150, weight: 0.45 },
  { id: 'amethyst', name: '자수정', icon: '🟣', price: 240, weight: 0.35 },
  { id: 'moonstone', name: '월장석', icon: '⚪', price: 340, weight: 0.2 },
]

export const ORE_IDS = ORES.map((o) => o.id)

/** 하루에 벽을 캘 수 있는 횟수 */
export const MINE_PER_DAY = 3

/** 오늘 남은 캐기 횟수. 날짜가 바뀌면 다시 세 번이다. */
export function minesLeft(day: string, cave: { day: string; mined: number }): number {
  const used = cave.day === day ? cave.mined : 0
  return Math.max(0, MINE_PER_DAY - used)
}

/** 시드에 따라 광석 하나를 고른다. 같은 시드면 늘 같다. */
export function oreFor(seed: number): Ore {
  const r = mulberry32(seed >>> 0)()
  let acc = 0
  for (const o of ORES) {
    acc += o.weight
    if (r < acc) return o
  }
  return ORES[ORES.length - 1]
}

/** 밀물 때는 동굴 입구가 물에 잠긴다. 하루 두 번, 6시와 18시 전후 약 세 시간씩이다. */
export function tideHigh(hour: number): boolean {
  return Math.cos((2 * Math.PI * (hour - 6)) / 12) > 0.7 || Math.cos((2 * Math.PI * (hour - 18)) / 12) > 0.7
}

/** 지금 들어갈 수 있는지: 밀물이 아니어야 한다 */
export const caveOpen = (hour: number) => !tideHigh(hour)

/** 상자는 일주일에 한 번 연다. 날짜 번호를 7로 나눈 몫이 주 번호다. */
export const CHEST_EVERY = 7

export function chestWeek(dayIndex: number): number {
  return Math.floor(dayIndex / CHEST_EVERY)
}

/** 이번 주 상자를 아직 안 열었는지 */
export function chestDue(dayIndex: number, lastWeek: number): boolean {
  return chestWeek(dayIndex) > lastWeek
}

/**
 * 상자 속 물건. 아직 배우지 않은 레시피가 남아 있으면 절반쯤 레시피, 나머지는 화석이다.
 * 주 번호가 같으면 늘 같은 물건이 나온다. 배울 레시피가 없으면 화석만 나온다.
 */
export function chestItem(week: number, learned: readonly string[]): { kind: 'recipe' | 'fossil'; id: string } {
  const rng = mulberry32(hashString(`cave-chest:${week}`))
  const open = RECIPES.map((r) => r.id).filter((id) => !learned.includes(id))
  if (open.length && rng() < 0.5) return { kind: 'recipe', id: open[Math.floor(rng() * open.length)] }
  return { kind: 'fossil', id: FOSSIL_SPECIES[Math.floor(rng() * FOSSIL_SPECIES.length)] }
}

/** 저장되는 동굴 기록. day 는 오늘 캔 날짜, mined 는 그날 캔 횟수, chestWeek 는 마지막으로 연 상자의 주 번호다. */
export interface CaveState {
  day: string
  mined: number
  chestWeek: number
}

export const EMPTY_CAVE: CaveState = { day: '', mined: 0, chestWeek: -1 }

/** 저장된 동굴 기록을 검증한다. 값이 망가졌으면 빈 기록으로 둔다. */
export function sanitizeCave(raw: unknown): CaveState {
  const c = (raw ?? {}) as Partial<CaveState>
  const ok =
    typeof c.day === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.day) &&
    Number.isInteger(c.mined) &&
    c.mined! >= 0 &&
    c.mined! <= MINE_PER_DAY &&
    Number.isInteger(c.chestWeek) &&
    c.chestWeek! >= -1
  if (!ok) return { ...EMPTY_CAVE }
  return { day: c.day!, mined: c.mined!, chestWeek: c.chestWeek! }
}

/** 동굴 입구 자리: 서쪽 해안, 물가에서 조금 안쪽의 바위 턱. 입구는 섬 가운데를 향한다. */
export function caveSpot(): { x: number; z: number } {
  const r = radiusAt(Math.PI) * 0.88
  return { x: -r, z: 0 }
}
