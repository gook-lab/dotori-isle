import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { baseHeightAt, byWater, GRASS_EDGE, heightAt, ISLAND_R, islandDist, isWalkable, nearWaters, radiusAt, TRIP, tripRadiusAt } from '../core/island'
import { CLIFF_W, flatRing, inStepBlockAt, PLATEAUS, plateauRimAt, rampBandAt, rampsOf, RAMP_STEPS, RAMP_W, STEP_PAD, stepHalfWidth, stepSectorAt, tierHeightAt, tierSlopeAt, type Plateau } from '../core/tiers'
import {PONDS, SPOUT, spoutDist, onPier} from '../core/waters'
import { Viewpoint } from './Viewpoint'
import { RampSteps } from './RampSteps'
import { InfraBoard, InfraGhost } from './Infra'
import { Paths } from './Paths'
import { GardenFloor } from './GardenFloor'
import { Driftwood, Tide } from './Beach'
import { TidePools } from './TidePools'
import { BlossomPetals, GroundLeaves, LeafPiles } from './Seasonal'
import { withCameraCut, withPlayerHole } from './occlusion'
import { hashString, mulberry32 } from '../core/rng'
import { autumnTone, paletteFor, SEASON_INFO, seasonFor, type Season, type SeasonPalette } from '../core/season'
import { reservedByHomes } from '../core/villagers'
import { blockedByProps } from '../core/world'
import { blockedByScenery } from '../core/scenery'
import { useGame } from '../game/store'
import { useQuality } from '../game/quality'
import { decodePaths, nearPath, pathKeys } from '../core/paths'
import { builtStairs } from '../core/infra'
import { bakeDepth, makeWaterMaterial } from './waterMaterial'
import { withCloudShadows, withNightTone, withWind } from './worldFx'
import { Lighthouse } from './Lighthouse'
import { Telescope } from './Telescope'
import { CaveEntrance } from './Cave'

const DIRT = new THREE.Color('#d9a877')
const SAND = new THREE.Color('#f6e4b0')
const WET = new THREE.Color('#d9c48e')
const BANK = new THREE.Color('#b9925f')
const SNOW = new THREE.Color('#f3f7fa')
const MUD = new THREE.Color('#8f7a52')
// 물 밑 땅 틴트: waterMaterial 의 바다 얕은 쪽(#6fe0da)과 깊은 쪽(#2f8fc4) 사이
const SEA_TINT = new THREE.Color('#4fb8c8')
/** 절벽 면: 흙보다 회색이 돌아서 잔디 윗면과 확실히 갈린다. */
const CLIFF = new THREE.Color('#8b7459')
/** 경사로 길: 밟아 다진 흙색 */
const PATH = new THREE.Color('#cfa872')

/** 잔디에 얼룩덜룩한 패치를 만드는 낮은 주파수 무늬 */
/** 언덕 가장자리 바로 곁(바깥쪽 0.9 안)인지. 밑동 치마 바깥의 격자 정점도 함께 내린다. */
const nearRimAt = (x: number, z: number) =>
  PLATEAUS.some((p) => {
    const dx = x - p.x
    const dz = z - p.z
    return Math.abs(Math.hypot(dx, dz) - plateauRimAt(p, Math.atan2(dz, dx))) < 0.9
  })

/** 그 자리에서 가장 높은 언덕의 평지 높이(언덕 밖이면 0) */
const plateauTopAt = (x: number, z: number) => Math.max(0, ...PLATEAUS.map((p) => (tierHeightAt(x, z) > 0 ? p.top : 0)))

const smooth01 = (e0: number, e1: number, v: number) => {
  const k = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)))
  return k * k * (3 - 2 * k)
}

const patch = (x: number, z: number) => 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.19 - x * 0.05)

function buildTerrain(cx: number, cz: number, size: number, seg: number, season: Season, pal: SeasonPalette): THREE.BufferGeometry {
  const grassA = new THREE.Color(pal.grass[0])
  const grassB = new THREE.Color(pal.grass[1])
  // 정점을 공유하는 매끈한 지형 + 셀 셰이딩으로 동글동글한 언덕처럼 보이게 한다.
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  geo.translate(cx, 0, cz)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  // 셰이더가 잔디·흙·모래 경계를 픽셀마다 높이로 다시 칠할 때 쓰는 값:
  // 그 자리 잔디 색(높이와 상관없이)과, 연못·개울로 파여서 정점 색을 그대로 써야 하는지.
  const grass = new Float32Array(pos.count * 3)
  const keep = new Float32Array(pos.count)
  const c = new THREE.Color()
  const g = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    // 바다 쪽 판자 밑 정점은 물속으로 내린다. 판자 높이(0.42)로 두면 옆 물속 정점과 이어지는 삼각형이 물 위로 모래 조각을 띄운다.
    // 판자는 따로 그려지고 걸을 높이는 heightAt 이 정하므로 지형 메시만 낮춘다.
    const seaDeck = onPier(x, z) && baseHeightAt(x, z) < 0.6
    const y = seaDeck ? Math.min(baseHeightAt(x, z), -0.6) : heightAt(x, z)
    // 절벽 띠 안의 격자 정점은 살짝 아래로 내린다. 거친 격자의 톱니는 그 위에 얹힌 매끈한 벽·치마 메시가 가린다.
    const tier = tierHeightAt(x, z)
    const band = (tierSlopeAt(x, z) > 0.002 || nearRimAt(x, z)) && tier < plateauTopAt(x, z) - 0.02
    // 평평한 윗면 격자도 아래로 내려 두면, 그 위에 얹힌 윗면 덮개(buildCliffs 의 cap)가 격자 톱니를 가린다.
    const flatTop = tier > 0.05 && tierSlopeAt(x, z) <= 0.002
    // 경사로 띠(절벽 바깥 계단)는 지형을 누르지 않는다. 그 위를 계단 칸 블록이 덮는다.
    const ramp = rampBandAt(x, z)
    // 계단 블록이 덮는 자리의 지형은 아래층으로 누른다(블록 옆 0.15 여유 밖은 그대로 둬 쐐기가 다시 생기지 않게 한다)
    const yv = inStepBlockAt(x, z) ? Math.min(y, baseHeightAt(x, z) - 0.5) : y
    pos.setY(i, (band && !ramp) || flatTop ? yv - 0.5 : yv)
    // 연못·개울: 파인 만큼 둑은 흙색, 물 밑은 진흙색
    const dug = nearWaters(x, z) ? baseHeightAt(x, z) - y : 0
    g.copy(grassB).lerp(grassA, patch(x, z)).toArray(grass, i * 3)
    // 픽셀 높이로 칠하는 셰이더가 덮지 않게 정점 색을 그대로 쓰는 자리: 연못·개울 둑, 절벽 면, 경사로 길
    // 가파른 띠(절벽·경사로 둘 다)는 정점 색을 그대로 쓴다. 높이 셰이더가 덮으면 잔디 색 뾰족 조각이 생긴다.
    // 언덕 근처만 기울기를 본다(바다 물결 기울기는 제외). 경계가 정점마다 튀면 톱니가 생기므로 색은 기울기로 부드럽게 섞는다.
    const steep = tierSlopeAt(x, z)
    // 둑은 물까지 깊이로 색을 이어 섞는다(계단식으로 끊으면 격자 톱니가 드러난다). 둑 구역 전체를 정점 색으로 칠한다.
    const bank = dug > 0.02 && islandDist(x, z) < GRASS_EDGE + 0.03
    // 부두 판자 밑 모래는 정점 색을 그대로 써야 그늘이 보이므로 keep 으로 빼 둔다
    const under = y < 0.5 && onPier(x, z, 0.3)
    // 겨울: 평평한 윗면과 절벽 턱에 눈이 덮인다(경사가 급한 벽은 그대로)
    const snow = season === 'winter' && tierHeightAt(x, z) > 0.05 && steep < 0.6
    keep[i] = bank || steep > 0.002 || under || snow ? 1 : 0
    if (bank) {
      c.copy(grassB).lerp(grassA, patch(x, z))
      c.lerp(BANK, smooth01(0.02, 0.3, dug))
      c.lerp(MUD, smooth01(0.3, 0.7, dug))
    }
    else if (steep > 0.002) {
      // 풀밭 색에서 길 색, 절벽 색으로 기울기에 따라 이어 섞는다.
      c.copy(grassB).lerp(grassA, patch(x, z))
      c.lerp(PATH, smooth01(0.1, 0.3, steep) * (tierHeightAt(x, z) > 0.05 ? 1 : 0))
      c.lerp(CLIFF, smooth01(0.9, 1.2, steep))
    }
    else if (islandDist(x, z) < GRASS_EDGE && y > 0.85) c.copy(grassB).lerp(grassA, patch(x, z))
    else if (y > 0.5) c.copy(DIRT)
    else if (y > 0.02) c.copy(SAND)
    else c.copy(WET).multiplyScalar(Math.max(0.6, 1 + y * 0.16))
    // 부두 판자 밑의 모래는 그늘져서 어둡게 칠한다(판자 밑 모래턱이 떠 보이지 않게)
    if (snow) c.lerp(SNOW, 0.92)
    if (under) c.multiplyScalar(0.5)
    // 물 밑 땅은 깊이만큼 바다 색(얕은 물 쪽 청록)으로 물들인다. 모래색이 물 위로 비쳐 보이지 않게 한다.
    if (y < 0) c.lerp(SEA_TINT, smooth01(0, -0.6, y) * 0.85)
    c.toArray(colors, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aGrass', new THREE.BufferAttribute(grass, 3))
  geo.setAttribute('aKeep', new THREE.BufferAttribute(keep, 1))
  geo.computeVertexNormals()
  return geo
}

/** 계절은 날짜로 정해지니 날이 바뀔 때만 다시 계산한다. */
export const useSeason = () => seasonFor(useGame((s) => s.day))
/** 지금 날짜의 땅 색. 가을은 날짜마다 조금씩 달라서 색이 바뀔 때만 새 묶음을 만든다. */
export function usePalette(): SeasonPalette {
  const day = useGame((s) => s.day)
  const season = seasonFor(day)
  const key = `${season}:${season === 'autumn' ? Math.round(autumnTone(day) * 20) : ''}`
  // key 가 같으면 같은 묶음을 쓴다(day 는 key 에 이미 담겼다)
  return useMemo(() => paletteFor(season, day), [key])
}

export function Terrain() {
  const season = useSeason()
  // 지어진 계단이 바뀌면 지형 격자와 절벽을 새로 굳힌다(섬 정비, infra.ts)
  const stairKey = useGame((s) => builtStairs(s.infra, s.day).map((x) => x.id).join(','))
  const pal = usePalette()
  const home = useMemo(() => buildTerrain(0, 0, ISLAND_R * 2.7, 380, season, pal), [season, pal, stairKey])
  // 여행 섬은 늘 여름인 남쪽 섬이다.
  const trip = useMemo(() => buildTerrain(TRIP.x, TRIP.z, 48, 68, 'summer', paletteFor('summer', '')), [])
  // 계절이 바뀌면 새 지형을 만들고 옛것은 GPU 에서 내린다.
  useEffect(() => () => home.dispose(), [home])
  // 땅 위로 구름 그림자가 흘러간다.
  const mat = useMemo(() => withCloudShadows(new THREE.MeshToonMaterial({ vertexColors: true })), [])
  return (
    <>
      <mesh geometry={home} material={mat} receiveShadow />
      <mesh geometry={trip} material={mat} receiveShadow />
      <Cliffs pal={pal} mat={mat} stairKey={stairKey} />
      <RampSteps season={season} />
      <Viewpoint />
      <InfraBoard />
      <InfraGhost />
      <Paths />
      <GardenFloor />
      <Tide />
      <Driftwood />
      <TidePools />
      <LeafPiles />
      <GroundLeaves />
      <Lighthouse />
      <Telescope />
      <CaveEntrance />
      <BlossomPetals />
    </>
  )
}

/** 절벽 한 줄(언덕 가장자리 한 바퀴)의 샘플 수. 많을수록 곡선이 매끈하다. */
const CLIFF_N = 160
/** 벽 줄무늬 띠: 밑에서 위로 진한 흙 → 중간 돌 → 밝은 돌 */
const STRATA = ['#7f6a52', '#9c8468', '#b09a7c'].map((c) => new THREE.Color(c))
/** 언덕 윗면에 판 연못 안인지(덮개를 비운다). 잔디 연못은 덮개 밖이라 해당 없음. */
const inHilltopPond = (x: number, z: number) =>
  PONDS.some((q) => q.level !== undefined && Math.hypot(x - q.x, z - q.z) < q.r * 1.2) || spoutDist(x, z) < SPOUT.w * 1.2
/** 윗면 물길이 벽을 넘는 각도 구간. 그 자리는 벽·윗자락을 그리지 않고 폭포 면이 채운다. */
const spoutSkip = (p: Plateau, a: number) => {
  const bx = SPOUT.b[0] - p.x
  const bz = SPOUT.b[1] - p.z
  if (Math.abs(Math.hypot(bx, bz) - plateauRimAt(p, Math.atan2(bz, bx)) + CLIFF_W) > 0.3) return false
  return Math.abs(Math.atan2(Math.sin(a - Math.atan2(bz, bx)), Math.cos(a - Math.atan2(bz, bx)))) < 0.1
}
/** 밑동 치마: 벽 밑의 짙은 그림자 → 풀밭 색으로 옅어진다 */
const SKIRT_DARK = new THREE.Color('#4a3b2a')
/** 윗자락이 절벽 위로 내민 길이 */
const LIP_OUT = 0.22
/** 벽을 지형보다 살짝 바깥으로 띄워 z-파이팅을 막는다 */
const WALL_OFF = 0.03

type Pt = [number, number, number]

/**
 * 절벽 재료를 한 번에 짠다. 벽은 밑(평지와 맞닿는 선)에서 윗가장자리까지 세 줄무늬로 칠하고,
 * 윗자락은 풀색으로 절벽 위로 내밀며, 밑동엔 그림자 띠를 깐다. 경사로 자리는 비워 걸어 오르게 한다.
 */
function buildCliffs(pal: SeasonPalette): {
  cap: THREE.BufferGeometry
  wall: THREE.BufferGeometry
  lip: THREE.BufferGeometry
  outline: THREE.BufferGeometry
  contact: THREE.BufferGeometry
  rocks: [number, number, number, number, number][]
  stones: [number, number, number, number][]
} {
  const wallPos: number[] = []
  const wallCol: number[] = []
  const lipPos: number[] = []
  const lipCol: number[] = []
  const linePos: number[] = []
  // 겨울엔 윗자락 잔디도 눈으로 덮인다
  const lipTone = new THREE.Color(pal.lip)
  // 테두리 선이 끊기는 자리: 선분 번호가 여기서 시작하면 앞 선분과 이어 붙이지 않는다(경사로·평지·다른 언덕 사이 직선 방지)
  const lineBreaks = new Set<number>()
  let lineSeg = 0
  const contactPos: number[] = []
  const contactCol: number[] = []
  const rocks: [number, number, number, number, number][] = []
  const stones: [number, number, number, number][] = []
  const rng = mulberry32(hashString('cliff-rocks'))
  // 윗면 덮개: 언덕 평지 전체를 한 장으로 덮는다. 벽 안쪽 가장자리(경사로 쪽은 경사로 끝)까지 평평한 풀밭.
  const capPos: number[] = []
  const capCol: number[] = []
  const capGrass: number[] = []
  const capKeep: number[] = []
  const grassA = new THREE.Color(pal.grass[0])
  const grassB = new THREE.Color(pal.grass[1])
  const grassAt = (x: number, z: number) => grassB.clone().lerp(grassA, patch(x, z))
  const pushCap = (x: number, y: number, z: number, c: THREE.Color) => {
    capPos.push(x, y, z)
    capCol.push(c.r, c.g, c.b)
    capGrass.push(c.r, c.g, c.b)
    capKeep.push(1)
  }
  // 계단 블록 옆 반폭 안의 벽은 끊고, 블록 밖은 벽이 그대로 이어진다
  const skip = (p: Plateau, a: number) => stepSectorAt(p, a) || spoutSkip(p, a)
  // 계단 블록 옆 벽은 층 띠를 없애고 절벽 기본색 한 가지로 칠한다. 블록 옆 반폭 바깥은 각도 0.15 에 걸쳐 층 띠로 서서히 돌아간다.
  const FLAT_FADE = 0.15
  const flatWeight = (p: Plateau, a: number) => {
    let w = 0
    for (const ra of rampsOf(p)) {
      const diff = Math.abs(Math.atan2(Math.sin(a - ra), Math.cos(a - ra)))
      const rimHere = plateauRimAt(p, a)
      const edge = Math.asin(Math.min(1, stepHalfWidth(plateauRimAt(p, ra)) / rimHere))
      w = Math.max(w, 1 - smooth01(edge, edge + FLAT_FADE, diff))
    }
    return w
  }
  const pushV = (arr: number[], q: Pt) => arr.push(q[0], q[1], q[2])
  const ringAt = (p: Plateau, i: number, r: number, y: number | null): Pt => {
    const a = (i / CLIFF_N) * Math.PI * 2
    const x = p.x + Math.cos(a) * (r + WALL_OFF)
    const z = p.z + Math.sin(a) * (r + WALL_OFF)
    return [x, y ?? heightAt(x, z), z]
  }

  for (const p of PLATEAUS) {
    lineBreaks.add(lineSeg)
    const rim = (i: number) => plateauRimAt(p, (i / CLIFF_N) * Math.PI * 2)
    // 덮개 가장자리: 벽 안쪽(CLIFF_W). 경사로 구간은 절벽 윗선(rim)까지 평지가 이어진다
    const capR = (i: number) => rim(i) - CLIFF_W + (stepSectorAt(p, (i / CLIFF_N) * Math.PI * 2) ? CLIFF_W : 0)
    // 극좌표 격자로 깐다. 언덕 위 연못 자리(PONDS 의 level 이 있는 것)는 덮지 않고 비워 둬서 물이 보이게 한다.
    const capRings = 24
    const capAt = (k: number, i: number): [number, number, number] => {
      const a = (i / CLIFF_N) * Math.PI * 2
      const r = (capR(i % CLIFF_N) * k) / capRings
      return [p.x + Math.cos(a) * r, p.top, p.z + Math.sin(a) * r]
    }
    for (let k = 0; k < capRings; k++) {
      for (let i = 0; i < CLIFF_N; i++) {
        const q = [capAt(k, i), capAt(k + 1, i), capAt(k + 1, i + 1), capAt(k, i + 1)]
        const mx = (q[0][0] + q[2][0]) / 2
        const mz = (q[0][2] + q[2][2]) / 2
        if (inHilltopPond(mx, mz)) continue
        for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) pushCap(v[0], v[1], v[2], grassAt(v[0], v[2]))
      }
    }
    // 벽 밑: 평지 높이와 만나는 반지름(띠 안에서 높이가 1 이 되는 곳). 윗가장자리: 띠 바깥 끝.
    const rB = (i: number) => rim(i) - CLIFF_W * (1 / p.top)
    const rT = (i: number) => rim(i) - CLIFF_W
    for (let i = 0; i < CLIFF_N; i++) {
      const j = (i + 1) % CLIFF_N
      const a0 = (i / CLIFF_N) * Math.PI * 2
      const ok = !skip(p, a0) && !skip(p, (j / CLIFF_N) * Math.PI * 2)
      if (!ok) lineBreaks.add(lineSeg)
      if (ok) {
        // 벽: 세 줄무늬. 각 띠는 밑 점과 윗 점을 나눠 칠한다.
        const bottom = [ringAt(p, i, rB(i), null), ringAt(p, j, rB(j), null)]
        const top = [ringAt(p, i, rT(i), p.top), ringAt(p, j, rT(j), p.top)]
        // 카메라 쪽(+z)을 보는 벽은 한 톤 어둡게 칠해 위에서도 높이가 읽히게 한다.
        const am = ((i + 0.5) / CLIFF_N) * Math.PI * 2
        const shade = Math.sin(am) > 0 ? 0.78 : 1
        const flat = flatWeight(p, am)
        for (let k = 0; k < STRATA.length; k++) {
          const t0 = k / STRATA.length
          const t1 = (k + 1) / STRATA.length
          // 띠 높이 t 의 점: 밑 점과 윗 점 사이를 잇는다(idx 0 = 시작 각도, 1 = 다음 각도)
          const at = (idx: number, t: number): Pt => [
            bottom[idx][0] + (top[idx][0] - bottom[idx][0]) * t,
            bottom[idx][1] + (top[idx][1] - bottom[idx][1]) * t,
            bottom[idx][2] + (top[idx][2] - bottom[idx][2]) * t,
          ]
          const q = [at(0, t0), at(1, t0), at(1, t1), at(0, t1)]
          const c = STRATA[k].clone().lerp(CLIFF, flat)
          for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
            pushV(wallPos, v)
            wallCol.push(c.r * shade, c.g * shade, c.b * shade)
          }
        }
        // 윗자락: 절벽 밖으로 조금 내민 풀밭
        const lipIn = [ringAt(p, i, rT(i), p.top + 0.02), ringAt(p, j, rT(j), p.top + 0.02)]
        const lipOut = [ringAt(p, i, rT(i) + LIP_OUT, p.top - 0.04), ringAt(p, j, rT(j) + LIP_OUT, p.top - 0.04)]
        for (const v of [lipIn[0], lipIn[1], lipOut[1], lipIn[0], lipOut[1], lipOut[0]]) {
          pushV(lipPos, v)
          lipCol.push(lipTone.r, lipTone.g, lipTone.b)
        }
        // 윗자락 바깥 테두리: 짙은 선
        const ol0 = ringAt(p, i, rT(i) + LIP_OUT, p.top - 0.02)
        const ol1 = ringAt(p, j, rT(j) + LIP_OUT, p.top - 0.02)
        for (const v of [ol0, ol1]) pushV(linePos, v)
        lineSeg++
        // 밑동 그림자 띠: 밑 반지름 주변에 깔린다
        // 밑동 치마: 벽 밑에서 바깥으로 풀밭까지 색이 부드럽게 옅어지는 매끈한 띠. 지형 격자의 톱니가 이 아래에 숨는다.
        const sk = [rB(i) - 0.04, rim(i) + 0.05, rim(i) + 0.4]
        const skj = [rB(j) - 0.04, rim(j) + 0.05, rim(j) + 0.4]
        // 격자 현(弦)이 참 높이보다 위로 튀는 만큼 안쪽을 높이고, 바깥으로 갈수록 땅에 맞춘다.
        const lift = [0.4, 0.02, 0]
        const colAt = [SKIRT_DARK, new THREE.Color(pal.skirt), new THREE.Color(pal.foot)]
        // 경사로 근처 치마는 경사 쪽 지형에 얹혀 옆으로 길게 번진 띠가 되므로 경사로 각도 가까이에서는 깔지 않는다
        const nearRamp = p.ramps.some((r) => Math.abs(Math.atan2(Math.sin(am - r), Math.cos(am - r))) < 0.5)
        for (let k = 0; k < 2 && !nearRamp; k++) {
          const a0 = [ringAt(p, i, sk[k], null), ringAt(p, j, skj[k], null)]
          const a1 = [ringAt(p, i, sk[k + 1], null), ringAt(p, j, skj[k + 1], null)]
          const up = (v: Pt, d: number): Pt => [v[0], v[1] + d, v[2]]
          const q0 = up(a0[0], lift[k]), q1 = up(a0[1], lift[k]), q2 = up(a1[1], lift[k + 1]), q3 = up(a1[0], lift[k + 1])
          const c0 = colAt[k]
          const c1 = colAt[k + 1]
          for (const [v, c] of [[q0, c0], [q1, c0], [q2, c1], [q0, c0], [q2, c1], [q3, c1]] as [Pt, THREE.Color][]) {
            pushV(contactPos, v)
            contactCol.push(c.r, c.g, c.b)
          }
        }
        // 돌 덩이: 벽에서 살짝 튀어나온 것만 드문드문
        if (rng() < 0.3) {
          const t = 0.2 + rng() * 0.6
          const r = rB(i) + (rT(i) - rB(i)) * t + 0.12
          const x = p.x + Math.cos(a0) * r
          const z = p.z + Math.sin(a0) * r
          const base = heightAt(x, z)
          rocks.push([x, base + (p.top - base) * t, z, 0.16 + rng() * 0.14, rng() * Math.PI])
        }
      }
    }
    // 경사로 디딤돌: 계단 칸마다 가운데 윗면에 하나씩 얹는다(칸 높이와 같은 자리라 뜨지 않는다).
    for (const a of p.ramps) {
      for (let j = 0; j < RAMP_STEPS; j++) {
        const r = plateauRimAt(p, a) + (1 - (j + 0.5) / RAMP_STEPS) * RAMP_W
        const x = p.x + Math.cos(a) * r
        const z = p.z + Math.sin(a) * r
        stones.push([x, heightAt(x, z) + 0.04, z, a])
      }
    }
  }

  const geo = (pos: number[], col?: number[]) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }
  // 테두리 선: 윗자락 바깥 끝을 따라 짙은 띠를 두른다.
  const outline = new THREE.BufferGeometry()
  const idx: number[] = []
  // 샘플 n 과 n+1 사이를 잇는다. 마지막 샘플은 다음 짝이 없어서 빼야 인덱스가 정점 수를 넘지 않는다.
  for (let n = 0; n < lineSeg - 1; n++) {
    if (lineBreaks.has(n + 1)) continue
    const k = n * 2
    idx.push(k, k + 1, k + 3, k, k + 3, k + 2)
  }
  outline.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3))
  outline.setIndex(idx)
  const contact = geo(contactPos, contactCol)
  const cap = geo(capPos, capCol)
  cap.setAttribute('aGrass', new THREE.Float32BufferAttribute(capGrass, 3))
  cap.setAttribute('aKeep', new THREE.Float32BufferAttribute(capKeep, 1))
  return { cap, wall: geo(wallPos, wallCol), lip: geo(lipPos, lipCol), outline, contact, rocks, stones }
}

/**
 * 언덕 절벽: 줄무늬 벽, 풀 윗자락, 짙은 테두리, 밑동 그림자, 벽에서 튀어나온 돌, 경사로의 계단돌.
 * 지형 메시와 같은 자리에 얹고, 벽 색을 지형 절벽 색과 맞춰 이음매가 보이지 않게 한다.
 */
function Cliffs({ pal, mat, stairKey }: { pal: SeasonPalette; mat: THREE.Material; stairKey: string }) {
  const parts = useMemo(() => buildCliffs(pal), [pal, stairKey])
  // 플레이어 주변 벽·윗자락·돌은 비켜 준다(occlusion.ts). 덮개와 땅은 그대로 둔다.
  const wallMat = useMemo(() => withNightTone(withPlayerHole(new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })), 'field'), [])
  // 윗자락 밑 닿는 띠는 빛을 받지 않는 재질이라 밤 톤을 직접 건다(안 걸면 밤에 형광처럼 튄다)
  const contactMat = useMemo(() => withNightTone(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'field'), [])
  const lipMat = useMemo(() => withNightTone(withPlayerHole(new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })), 'field'), [])
  const rockMat = useMemo(() => withPlayerHole(new THREE.MeshToonMaterial({ color: '#a79479' })), [])
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const stoneRef = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3()
    parts.rocks.forEach(([x, y, z, s, rot], i) => {
      q.setFromEuler(new THREE.Euler(0, rot, 0))
      m.compose(v.set(x, y, z), q, sc.set(s, s * 0.8, s))
      rockRef.current?.setMatrixAt(i, m)
    })
    parts.stones.forEach(([x, y, z, ang], i) => {
      q.setFromEuler(new THREE.Euler(0, ang, 0))
      // 칸 윗면 폭(깊이 RAMP_W/N ≈ 0.64) 안에 들어가게 줄여 칸 모서리에 걸치지 않게 한다
      m.compose(v.set(x, y, z), q, sc.set(0.8, 1, 0.8))
      stoneRef.current?.setMatrixAt(i, m)
    })
    if (rockRef.current) rockRef.current.instanceMatrix.needsUpdate = true
    if (stoneRef.current) stoneRef.current.instanceMatrix.needsUpdate = true
  }, [parts])
  useEffect(
    () => () => {
      parts.cap.dispose()
      parts.wall.dispose()
      parts.lip.dispose()
      parts.outline.dispose()
      parts.contact.dispose()
    },
    [parts],
  )
  return (
    <group>
      <mesh geometry={parts.cap} material={mat} receiveShadow />
      <mesh geometry={parts.wall} receiveShadow>
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh geometry={parts.lip} receiveShadow>
        <primitive object={lipMat} attach="material" />
      </mesh>
      <mesh geometry={parts.outline} renderOrder={2}>
        <meshBasicMaterial color="#3f3226" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.contact} renderOrder={2}>
        <primitive object={contactMat} attach="material" />
      </mesh>
      {/* 절벽 벽에 박힌 돌은 그림자를 드리우지 않는다: 낮은 해에 벽 위로 길게 늘어난 검은 얼룩이 생겨서. 벽이 받는 그림자는 유지한다. */}
      <instancedMesh ref={rockRef} args={[undefined, undefined, parts.rocks.length]} receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <primitive object={rockMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={stoneRef} args={[undefined, undefined, parts.stones.length]} receiveShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.08, 7]} />
        <meshToonMaterial color="#c4bcab" />
      </instancedMesh>
    </group>
  )
}

/** 물결 판이 덮는 범위. 카메라가 섬 끝에 서도 화면 끝까지 물결이 보이게 넉넉히 잡는다. */
const HOME_SEA = { x: 0, z: 0, size: 200, seg: 200 }
const TRIP_SEA = { x: TRIP.x, z: TRIP.z, size: 110, seg: 110 }

function SeaPatch({ x, z, size, seg }: { x: number; z: number; size: number; seg: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, seg, seg)
    g.rotateX(-Math.PI / 2)
    // 물 밑 땅까지 깊이를 구워 둔다. 셰이더가 이걸로 색·거품·물결무늬를 정한다.
    // 연못·개울로 판 곳은 바다가 아니므로 원래 땅 높이로 잰다.
    bakeDepth(g, () => 0, baseHeightAt, { x, z })
    return g
  }, [x, z, size, seg])
  const mat = useMemo(() => makeWaterMaterial('sea'), [])
  return <mesh geometry={geo} material={mat} position={[x, 0, z]} renderOrder={1} />
}

/**
 * 바다. 물결·색·거품은 셰이더가 GPU 에서 그린다(waterMaterial.ts).
 * 물결 판 바깥은 바닥 아래 깊은 파란 판 하나로 덮고, 먼 곳은 안개가 가린다.
 */
export function Water() {
  return (
    <>
      <SeaPatch {...HOME_SEA} />
      <SeaPatch {...TRIP_SEA} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -2.6, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial color="#2a7fb5" />
      </mesh>
      <Foam cx={0} cz={0} radius={radiusAt} />
      <Foam cx={TRIP.x} cz={TRIP.z} radius={tripRadiusAt} />
    </>
  )
}

/** 해안선을 따라 밀려왔다 빠지는 하얀 거품 띠 */
function Foam({ cx, cz, radius }: { cx: number; cz: number; radius: (theta: number) => number }) {
  const geo = useMemo(() => {
    const seg = 220
    const verts: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const r = radius(a)
      for (const d of [0.985, 1.035]) verts.push(Math.cos(a) * r * d, 0.07, Math.sin(a) * r * d)
      if (i < seg) {
        const k = i * 2
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setIndex(idx)
    return g
  }, [radius])
  const ref = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(t * 0.9) * 0.008)
    if (mat.current) mat.current.opacity = 0.55 + Math.sin(t * 0.9) * 0.25
  })
  return (
    <mesh ref={ref} geometry={geo} position={[cx, 0, cz]}>
      <meshBasicMaterial ref={mat} color="#ffffff" transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}


/** 꽃과 풀 덤불. 개수가 많아 InstancedMesh 하나씩으로 그린다. */
export function Decor() {
  const season = useSeason()
  const pal = usePalette()
  // 그래픽 품질에 따라 꽃·풀 개수를 줄인다(낮음은 절반)
  const { profile } = useQuality()
  const density = profile.grass
  const base = useMemo(() => {
    const rng = mulberry32(hashString('decor'))
    const flowers: [number, number, number, string][] = []
    const tufts: [number, number, number, number][] = []
    // 집 섬과 여행 섬에 각각 뿌린다.
    const areas = [
      { cx: 0, cz: 0, half: ISLAND_R * 0.9, flowers: 540, tufts: 640 },
      { cx: TRIP.x, cz: TRIP.z, half: 14, flowers: 50, tufts: 50 },
    ].map((a) => ({ ...a, flowers: Math.round(a.flowers * density), tufts: Math.round(a.tufts * density) }))
    for (const area of areas) {
      const palette = SEASON_INFO[area.cx === 0 ? season : 'summer'].flowers
      const f0 = flowers.length
      const t0 = tufts.length
      for (let i = 0; i < 9000 && (flowers.length - f0 < area.flowers || tufts.length - t0 < area.tufts); i++) {
        const x = area.cx + (rng() * 2 - 1) * area.half
        const z = area.cz + (rng() * 2 - 1) * area.half
        if (islandDist(x, z) > 0.76 || !flatRing(x, z, 0.8) || inStepBlockAt(x, z, STEP_PAD) || !isWalkable(x, z) || blockedByProps(x, z, 0.6) || blockedByScenery(x, z, 0.3) || reservedByHomes(x, z, 0.3) || byWater(x, z, 0.4)) continue
        if (rng() < 0.5 && flowers.length - f0 < area.flowers) flowers.push([x, heightAt(x, z), z, palette[Math.floor(rng() * palette.length)]])
        else if (tufts.length - t0 < area.tufts) tufts.push([x, heightAt(x, z), z, rng() * Math.PI])
      }
    }
    return { flowers, tufts }
  }, [season, density])
  // 길을 깐 칸 위와 둘레의 꽃·풀은 뺀다(길을 새로 깔면 여기서만 다시 거른다)
  const raw = useGame((s) => s.infra.paths)
  const { flowers, tufts } = useMemo(() => {
    const keys = pathKeys(decodePaths(raw))
    return {
      flowers: base.flowers.filter(([x, , z]) => !nearPath(x, z, keys)),
      tufts: base.tufts.filter(([x, , z]) => !nearPath(x, z, keys)),
    }
  }, [base, raw])

  // 풀 덤불 끝이 바람에 살랑인다.
  // 카메라 코앞의 덤불은 잘라 낸다(occlusion.ts withCameraCut). 바람 흔들림은 그대로 둔다.
  const tuftMat = useMemo(() => withCameraCut(withNightTone(withWind(new THREE.MeshToonMaterial()))), [])
  useLayoutEffect(() => {
    tuftMat.color.set(pal.tuft)
  }, [tuftMat, pal])
  const flowerRef = useRef<THREE.InstancedMesh>(null)
  const tuftRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    flowers.forEach(([x, y, z, col], i) => {
      m.makeTranslation(x, y + 0.12, z)
      flowerRef.current?.setMatrixAt(i, m)
      flowerRef.current?.setColorAt(i, c.set(col))
    })
    tufts.forEach(([x, y, z, rot], i) => {
      m.makeRotationY(rot).setPosition(x, y + 0.12, z)
      tuftRef.current?.setMatrixAt(i, m)
    })
    if (flowerRef.current) {
      flowerRef.current.instanceMatrix.needsUpdate = true
      if (flowerRef.current.instanceColor) flowerRef.current.instanceColor.needsUpdate = true
    }
    if (tuftRef.current) tuftRef.current.instanceMatrix.needsUpdate = true
  }, [flowers, tufts])

  return (
    <group>
      <instancedMesh ref={flowerRef} args={[undefined, undefined, flowers.length]}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshToonMaterial />
      </instancedMesh>
      <instancedMesh ref={tuftRef} args={[undefined, undefined, tufts.length]} material={tuftMat}>
        <coneGeometry args={[0.14, 0.34, 5]} />
      </instancedMesh>
    </group>
  )
}
