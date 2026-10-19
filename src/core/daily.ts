import { BUG_TABLE, FISH_TABLE, SHELL_TABLE, speciesFor, type Habitat } from './items'
import { PIER_LEN, PONDS, STREAM } from './waters'
import { byWater, heightAt, islandDist, ISLAND_R, isWalkable, normDist, radiusAt, TRIP, tripDist, tripRadiusAt } from './island'
import { bottleDay, parcelCount } from './bottle'
import { cliffFaceAt, inStepBlockAt, STEP_PAD } from './tiers'
import { hashString, mulberry32, pickWeighted } from './rng'
import { rainStoneSpawns } from './rainStones'
import { reservedByHomes } from './villagers'
import { seasonFor } from './season'
import { typhoonAftermath } from './wind'
import { weatherFor } from './weather'
import { blockedByProps, DOCK_TALK_R, DOCKS, nearDock } from './world'
import { blockedByScenery } from './scenery'
import { tideBugs, tidePosition, type TidePool } from './tidepool'

/** 날짜 키 하나로 그날의 조개·벌레 배치가 정해진다. 같은 날이면 새로고침해도 같다. */

export interface ShellSpawn {
  id: string
  itemId: string
  x: number
  z: number
}

export interface BugSpawn {
  id: string
  x: number
  z: number
  day: string
  night: string
  seed: number
  /** 물웅덩이 생물이면 자기 웅덩이. 이 안에서만 움직인다. */
  pool?: TidePool
}

/** 땅에 묻힌 보물. 반짝이는 금으로 표시되고 삽으로 판다. */
export interface DigSpot {
  id: string
  itemId: string
  x: number
  z: number
}

/** 바다를 헤엄치는 물고기 그림자. 낮과 밤에 다른 물고기다. 그림자 근처에 던져야 문다. */
export interface FishSpawn {
  id: string
  x: number
  z: number
  day: string
  night: string
  seed: number
  /** 맴도는 반경. 좁은 개울에선 작다 */
  wander?: number
}

export interface DayLayout {
  shells: ShellSpawn[]
  bugs: BugSpawn[]
  digs: DigSpot[]
  fish: FishSpawn[]
}

const DIG_TABLE = [
  { id: 'fossil', weight: 3 },
  // 나머지 화석 종은 흔한 화석보다 드물게 나온다
  { id: 'ammonite', weight: 1.2 },
  { id: 'trilobite', weight: 1 },
  { id: 'fern-fossil', weight: 1.5 },
  { id: 'dino-footprint', weight: 0.6 },
  { id: 'amber-bug', weight: 0.5 },
  { id: 'acorn-pouch', weight: 3 },
  { id: 'iron', weight: 2 },
  { id: 'gold', weight: 0.6 },
  { id: 'recipe-card', weight: 1.5 },
]

/** 조개를 두지 않는 부두 반경. 펠리와 말하는 거리보다 조금 넓다. */
const SHELL_DOCK_CLEAR = DOCK_TALK_R + 0.8

export function generateDay(key: string): DayLayout {
  const rng = mulberry32(hashString(`day:${key}`))

  const shells: ShellSpawn[] = []
  for (let attempt = 0; attempt < 80 && shells.length < 16; attempt++) {
    const theta = rng() * Math.PI * 2
    const d = 0.87 + rng() * 0.08
    const r = radiusAt(theta) * d
    const itemId = pickWeighted(SHELL_TABLE, rng).id
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    // 모래사장을 지나는 개울 물속엔 두지 않는다. 부두 앞은 펠리와 말하는 자리라 비워 둔다.
    if (byWater(x, z, 0.5) || nearDock(x, z, SHELL_DOCK_CLEAR) || cliffFaceAt(x, z)) continue
    shells.push({ id: `${key}-shell-${shells.length}`, itemId, x, z })
  }

  // 비 오는 날엔 달팽이가 기어 나온다.
  const rain = weatherFor(key) === 'rain'
  const season = seasonFor(key)
  const dayBugs = speciesFor(BUG_TABLE, false, rain, season)
  const nightBugs = speciesFor(BUG_TABLE, true, rain, season)
  const bugs: BugSpawn[] = []
  for (let attempt = 0; attempt < 2000 && bugs.length < 16; attempt++) {
    const x = (rng() * 2 - 1) * ISLAND_R * 0.8
    const z = (rng() * 2 - 1) * ISLAND_R * 0.8
    if (normDist(x, z) > 0.68 || cliffFaceAt(x, z) || blockedByProps(x, z, 1.5) || blockedByScenery(x, z, 1.2) || byWater(x, z, 1)) continue
    bugs.push({
      id: `${key}-bug-${bugs.length}`,
      x,
      z,
      day: pickWeighted(dayBugs, rng).id,
      night: pickWeighted(nightBugs, rng).id,
      seed: rng() * 100,
    })
  }

  const digs: DigSpot[] = []
  for (let attempt = 0; attempt < 4000 && digs.length < 9; attempt++) {
    const x = (rng() * 2 - 1) * ISLAND_R
    const z = (rng() * 2 - 1) * ISLAND_R
    // 여덟은 잔디, 하나는 모래사장에 묻는다. 절벽 면과 언덕 위 평지 가장자리는 파지 않는다.
    const d = normDist(x, z)
    const onSand = digs.length === 8
    if (onSand ? d < 0.86 || d > 0.95 : d > 0.74) continue
    if (cliffFaceAt(x, z) || !isWalkable(x, z)) continue
    if (blockedByProps(x, z, 1) || blockedByScenery(x, z, 0.8) || reservedByHomes(x, z, 0.5) || byWater(x, z, 0.8)) continue
    if (digs.some((g) => Math.hypot(g.x - x, g.z - z) < 6)) continue
    digs.push({ id: `${key}-dig-${digs.length}`, itemId: pickWeighted(DIG_TABLE, rng).id, x, z })
  }

  // 물웅덩이 생물은 따로 뽑는다(섬 벌레의 난수 순서를 바꾸지 않게)
  bugs.push(...tideBugs(key))
  // 태풍이 지나간 다음 날 아침: 떠밀려 온 목재·조개와 희귀 가구 하나가 해변에 많다
  if (typhoonAftermath(key)) {
    for (let i = 0; i < 8; i++) {
      const theta = rng() * Math.PI * 2
      const r = radiusAt(theta) * (0.9 + rng() * 0.06)
      const itemId = i === 0 ? 'paper-lantern' : i < 4 ? 'wood' : pickWeighted(SHELL_TABLE, rng).id
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      if (byWater(x, z, 0.5) || nearDock(x, z, SHELL_DOCK_CLEAR) || cliffFaceAt(x, z)) continue
      shells.push({ id: `${key}-wash-${i}`, itemId, x, z })
    }
  }
  // 사흘에 한 번 해변에 유리병이 떠밀려 온다. 따로 시드를 써서 위의 난수 순서를 바꾸지 않는다.
  if (bottleDay(key)) {
    const b = bottleSpot(key)
    if (b) shells.push({ id: `${key}-bottle`, itemId: 'bottle', x: b.x, z: b.z })
  }
  // 가끔(하루 0~2개) 표류 소포가 밀물선 근처에 떠밀려 온다. 시드를 따로 써서 위의 난수 순서를 바꾸지 않는다.
  for (let i = 0; i < parcelCount(key); i++) {
    const p = parcelSpot(key, i)
    if (p) shells.push({ id: `${key}-parcel-${i}`, itemId: 'parcel', x: p.x, z: p.z })
  }
  // 비 오는 날 해변에는 반짝이는 조약돌이 씻겨 온다(조개와 같은 자리 규칙). 시드를 따로 써서 위의 난수 순서를 바꾸지 않는다.
  shells.push(
    ...rainStoneSpawns(key, rain, (theta, d) => {
      const r = radiusAt(theta) * d
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      if (byWater(x, z, 0.5) || nearDock(x, z, SHELL_DOCK_CLEAR) || cliffFaceAt(x, z)) return null
      return { x, z }
    }),
  )
  addTripSpots(key, shells, bugs, digs)
  // 계단 블록 자리(여유 포함)의 조개·벌레·땅파기는 뺀다. 남은 항목의 id 는 그대로다.
  const out = (list: { x: number; z: number }[]) => list.filter((t) => !inStepBlockAt(t.x, t.z, STEP_PAD))
  return { shells: out(shells) as typeof shells, bugs: out(bugs) as typeof bugs, digs: out(digs) as typeof digs, fish: generateFish(key) }
}

/** 병이 떠밀려 온 모래 띠 자리(섬 둘레, 물 없는 곳) */
function bottleSpot(key: string): { x: number; z: number } | null {
  const rng = mulberry32(hashString(`bottle-spot:${key}`))
  for (let i = 0; i < 400; i++) {
    const theta = rng() * Math.PI * 2
    const r = radiusAt(theta) * (0.97 + rng() * 0.03)
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const d = islandDist(x, z)
    if (d < 0.9 || d >= 1 || heightAt(x, z) > 0.3 || byWater(x, z, 0.5)) continue
    return { x, z }
  }
  return null
}

/** 표류 소포가 떠밀려 온 밀물선 자리: 바다 쪽 모래 띠, 물 위는 피한다. 병과 같은 띠지만 다른 씨앗을 쓴다. */
function parcelSpot(key: string, i: number): { x: number; z: number } | null {
  const rng = mulberry32(hashString(`parcel-spot:${key}:${i}`))
  for (let k = 0; k < 400; k++) {
    const theta = rng() * Math.PI * 2
    const r = radiusAt(theta) * (0.95 + rng() * 0.04)
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const d = islandDist(x, z)
    if (d < 0.9 || d >= 1 || heightAt(x, z) > 0.3 || byWater(x, z, 0.5)) continue
    return { x, z }
  }
  return null
}

/** 여행 섬 몫. 집 섬 배치가 바뀌지 않도록 따로 시드를 쓴다. */
function addTripSpots(key: string, shells: ShellSpawn[], bugs: BugSpawn[], digs: DigSpot[]) {
  const rng = mulberry32(hashString(`trip:${key}`))
  // 여행 섬 부두(펠리 자리) 근처는 건너뛰고 다시 뽑는다. 조개가 펠리 말하기를 가리지 않게.
  for (let i = 0, attempt = 0; i < 5 && attempt < 60; attempt++) {
    const theta = rng() * Math.PI * 2
    const r = tripRadiusAt(theta) * (0.87 + rng() * 0.07)
    const x = TRIP.x + Math.cos(theta) * r
    const z = TRIP.z + Math.sin(theta) * r
    const itemId = pickWeighted(SHELL_TABLE, rng).id
    if (nearDock(x, z, SHELL_DOCK_CLEAR)) continue
    shells.push({ id: `${key}-tshell-${i}`, itemId, x, z })
    i++
  }
  // 여행 섬은 늘 여름이다.
  const rain = weatherFor(key) === 'rain'
  const dayBugs = speciesFor(BUG_TABLE, false, rain, 'summer')
  const nightBugs = speciesFor(BUG_TABLE, true, rain, 'summer')
  let n = 0
  for (let attempt = 0; attempt < 300 && n < 3; attempt++) {
    const x = TRIP.x + (rng() * 2 - 1) * 12
    const z = TRIP.z + (rng() * 2 - 1) * 12
    if (tripDist(x, z) > 0.62 || blockedByProps(x, z, 1.5)) continue
    bugs.push({ id: `${key}-tbug-${n++}`, x, z, day: pickWeighted(dayBugs, rng).id, night: pickWeighted(nightBugs, rng).id, seed: rng() * 100 })
  }
  n = 0
  for (let attempt = 0; attempt < 300 && n < 2; attempt++) {
    const x = TRIP.x + (rng() * 2 - 1) * 13
    const z = TRIP.z + (rng() * 2 - 1) * 13
    if (tripDist(x, z) > 0.72 || blockedByProps(x, z, 1)) continue
    if (digs.some((g) => Math.hypot(g.x - x, g.z - z) < 5)) continue
    digs.push({ id: `${key}-tdig-${n++}`, itemId: pickWeighted(DIG_TABLE, rng).id, x, z })
  }
}

const HOME_FISH = 16
const TRIP_FISH = 4

/** 물가에서 조금 떨어진 바다에 그림자를 띄운다. 집 섬 배치가 흔들리지 않게 시드를 따로 쓴다. */
function generateFish(key: string): FishSpawn[] {
  const rng = mulberry32(hashString(`fish:${key}`))
  const rain = weatherFor(key) === 'rain'
  const season = seasonFor(key)
  const fish: FishSpawn[] = []
  const spawn = (x: number, z: number, s: typeof season) =>
    fish.push({
      id: `${key}-fish-${fish.length}`,
      x,
      z,
      day: pickWeighted(speciesFor(FISH_TABLE, false, rain, s), rng).id,
      night: pickWeighted(speciesFor(FISH_TABLE, true, rain, s), rng).id,
      seed: rng() * 100,
    })
  for (let attempt = 0; attempt < 400 && fish.length < HOME_FISH; attempt++) {
    const theta = rng() * Math.PI * 2
    // 물가에서 1.5~3.5 정도 떨어진 곳: 모래사장 끝에서 던진 찌가 닿는 거리다.
    const r = radiusAt(theta) * (1.03 + rng() * 0.035)
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    // 부두 아래나 다른 그림자와 겹치지 않게
    if (DOCKS.some((d) => Math.hypot(d.x - x, d.z - z) < 6)) continue
    if (fish.some((f) => Math.hypot(f.x - x, f.z - z) < 7)) continue
    spawn(x, z, season)
  }
  // 집 섬 부두 끝 바다에는 두 마리씩 모여 있어서 판자 끝에서 그림자가 보인다
  for (const d of DOCKS.filter((x) => x.id === 'home')) {
    for (const [f, s] of [[PIER_LEN + 1.8, -1.1], [PIER_LEN + 3.2, 1.1]] as const) {
      spawn(d.x + Math.cos(d.angle) * f + Math.sin(d.angle) * s, d.z + Math.sin(d.angle) * f - Math.cos(d.angle) * s, season)
    }
  }
  // 연못과 개울 물고기. 사는 물에 맞는 종만 나온다.
  const fresh = (x: number, z: number, habitat: Habitat, wander: number) =>
    fish.push({
      id: `${key}-fish-${fish.length}`,
      x,
      z,
      day: pickWeighted(speciesFor(FISH_TABLE, false, rain, season, habitat), rng).id,
      night: pickWeighted(speciesFor(FISH_TABLE, true, rain, season, habitat), rng).id,
      seed: rng() * 100,
      wander,
    })
  PONDS.forEach((p, i) => {
    for (let k = 0; k < (i === 0 ? 2 : 1); k++) {
      const a = rng() * Math.PI * 2
      // 작은 연못(반지름 2 안팎)은 2.2 를 빼면 음수가 되므로 반지름의 0.4 배 이상을 쓴다.
      const r = rng() * Math.max(p.r - 2.2, p.r * 0.4)
      fresh(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 'pond', 0.9)
    }
  })
  // 개울은 잔디 구간(폭포 위)에만, 다리 밑(마디 2.5 언저리)은 피해서 둔다.
  for (const t of [1.2, 1.9, 3.3]) {
    const i = Math.floor(t)
    const [ax, az] = STREAM[i]
    const [bx, bz] = STREAM[i + 1]
    fresh(ax + (bx - ax) * (t - i), az + (bz - az) * (t - i), 'river', 0.3)
  }
  // 여행 섬은 늘 여름이다.
  for (let i = 0; i < TRIP_FISH; i++) {
    const theta = (i / TRIP_FISH) * Math.PI * 2 + rng() * 0.8
    const r = tripRadiusAt(theta) * (1.13 + rng() * 0.08)
    spawn(TRIP.x + Math.cos(theta) * r, TRIP.z + Math.sin(theta) * r, 'summer')
  }
  return fish
}

/** 그림자는 제자리 주변을 느릿느릿 맴돈다. 렌더와 판정이 같은 값을 본다. */
export function fishPosition(f: FishSpawn, t: number): { x: number; z: number; facing: number } {
  const s = f.seed
  const w = f.wander ?? 1
  const x = f.x + Math.sin(t * 0.22 + s) * w
  const z = f.z + Math.cos(t * 0.17 + s * 1.3) * w
  const dx = Math.cos(t * 0.22 + s) * 0.22
  const dz = -Math.sin(t * 0.17 + s * 1.3) * 0.17
  return { x, z, facing: Math.atan2(dx, dz) }
}

/** 찌가 떨어진 곳에서 이만큼 안에 있는 그림자가 다가온다. */
export const LURE_R = 3

export function nearestFish(fish: FishSpawn[], gone: string[], x: number, z: number, t: number): { f: FishSpawn; x: number; z: number } | null {
  let best: { f: FishSpawn; x: number; z: number } | null = null
  let bestD = LURE_R
  for (const f of fish) {
    if (gone.includes(f.id)) continue
    const p = fishPosition(f, t)
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < bestD) {
      bestD = d
      best = { f, x: p.x, z: p.z }
    }
  }
  return best
}

let cached: { key: string; layout: DayLayout } | null = null

export function getLayout(key: string): DayLayout {
  if (cached?.key !== key) cached = { key, layout: generateDay(key) }
  return cached.layout
}

/** 벌레는 상태 없이 시간의 함수로 날아다닌다. 렌더와 판정이 같은 값을 본다. */
const CRAWLERS = new Set(BUG_TABLE.filter((s) => s.crawl).map((s) => s.id))

export function bugPosition(b: BugSpawn, t: number, night: boolean): [number, number, number] {
  const s = b.seed
  if (b.pool) return tidePosition(b.pool, s, t)
  if (CRAWLERS.has(night ? b.night : b.day)) {
    // 기어 다니는 벌레는 땅 위를 아주 천천히 맴돈다.
    const x = b.x + Math.sin(t * 0.08 + s) * 1.2
    const z = b.z + Math.cos(t * 0.06 + s * 1.3) * 1.2
    return [x, heightAt(x, z) + 0.05, z]
  }
  const x = b.x + Math.sin(t * 0.6 + s) * 1.6 + Math.sin(t * 1.7 + s * 2) * 0.3
  const z = b.z + Math.cos(t * 0.45 + s * 1.3) * 1.6
  const y = heightAt(b.x, b.z) + (night ? 0.7 : 1) + Math.sin(t * 2.3 + s) * 0.25
  return [x, y, z]
}
