import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { SCENERY, type ScenerySpot } from '../core/scenery'
import { hashString, mulberry32 } from '../core/rng'
import { SEASON_INFO, type Season } from '../core/season'
import { decodePaths, nearPath, pathKeys } from '../core/paths'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useSeason } from './Island'
import { Batch, Merge, mul, shape, useMerged, vertexToonMaterial, xf } from './batching'
import { withNightTone } from './worldFx'
import { Toon } from './toon'

const SHAKE_TIME = 0.6
type V3 = [number, number, number]

/** 덤불 몸통 색. 가을엔 단풍이 들고 겨울엔 눈을 인다. */
const BUSH_COLOR: Record<Season, [string, string]> = {
  spring: ['#5fb36a', '#6fc277'],
  summer: ['#4fa65e', '#5db56b'],
  autumn: ['#d9823f', '#c9a23c'],
  winter: ['#5f8a7e', '#6f9a8e'],
}

/** 덤불에 달린 것: 봄엔 분홍 꽃, 여름엔 수국, 가을엔 빨간 열매 */
const BLOSSOM: Record<Season, string | null> = { spring: '#ff9fbf', summer: '#8fb8f0', autumn: '#d8343a', winter: null }

/** 덤불 꽃·열매 자리(동그란 덩이 표면) */
const DOTS: [number, number, number][] = [
  [0.35, 0.62, 0.3],
  [-0.4, 0.55, 0.25],
  [0.1, 0.85, -0.2],
  [-0.15, 0.48, -0.45],
  [0.48, 0.4, -0.2],
  [-0.05, 0.9, 0.22],
]

function Bush({ s, season }: { s: ScenerySpot; season: Season }) {
  const ref = useRef<THREE.Group>(null)
  const phase = s.x * 0.31 + s.z * 0.17
  useFrame(({ clock }) => {
    if (!ref.current) return
    const sh = runtime.shake
    const st = sh?.id === s.id ? sh.t : SHAKE_TIME
    const k = Math.max(0, 1 - st / SHAKE_TIME)
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + phase) * 0.02 + Math.sin(st * 42) * 0.12 * k
    const squash = 1 + Math.sin(st * 32) * 0.08 * k
    ref.current.scale.set(1 / squash, squash, 1 / squash)
  })
  const lit = useMemo(() => withNightTone(vertexToonMaterial()), [])
  useEffect(() => () => lit.dispose(), [lit])
  const g = useMerged(
    (b) => {
      const [c0, c1] = BUSH_COLOR[season]
      const blossom = BLOSSOM[season]
      b.add(shape(THREE.SphereGeometry, 1, 14, 10), xf([0, 0.45, 0], [0, 0, 0], [0.62, 0.5, 0.58]), c0, { outline: 0.06 })
      b.add(shape(THREE.SphereGeometry, 1, 12, 9), xf([0.3, 0.38, 0.12], [0, 0, 0], [0.38, 0.34, 0.36]), c1, { outline: 0.06 })
      b.add(shape(THREE.SphereGeometry, 1, 12, 9), xf([-0.32, 0.34, -0.08], [0, 0, 0], [0.36, 0.3, 0.34]), c1, { outline: 0.06 })
      if (blossom)
        DOTS.forEach(([x, y, z], i) => {
          // 덩이 겉면 바깥으로 살짝 빼야 묻히지 않는다.
          const geo = season === 'summer' ? shape(THREE.DodecahedronGeometry, 1, 0) : shape(THREE.SphereGeometry, 1, 8, 6)
          b.add(geo, xf([x * 1.25, 0.45 + (y - 0.45) * 1.15, z * 1.3], [0, 0, 0], season === 'summer' ? 0.11 : 0.08), i % 3 === 0 && season === 'spring' ? '#ffffff' : blossom, { cast: false })
        })
      if (season === 'winter') b.add(shape(THREE.SphereGeometry, 1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), xf([0, 0.82, 0], [0, 0, 0], [0.5, 0.18, 0.46]), '#ffffff', { cast: false })
    },
    [season],
  )
  return (
    <group position={[s.x, heightAt(s.x, s.z), s.z]} rotation-y={s.rot} scale={s.scale}>
      <group ref={ref}>
        <Merge g={g} lit={lit} />
      </group>
    </group>
  )
}

/** 나이테가 보이는 그루터기. 위에 작은 싹이 하나 돋아 있다. */
function addStump(b: Batch, M: THREE.Matrix4, season: Season) {
  b.add(shape(THREE.CylinderGeometry, 0.36, 0.44, 0.4, 12), mul(M, xf([0, 0.2, 0])), '#8a5a35', { outline: 0.06 })
  // 뿌리 셋
  for (const a of [0, 2.1, 4.2]) {
    b.add(shape(THREE.SphereGeometry, 1, 8, 6), mul(M, xf([Math.cos(a) * 0.42, 0.06, Math.sin(a) * 0.42], [0, -a, 0.5], [0.22, 0.1, 0.12])), '#7a4e2d', { outline: 0.1 })
  }
  b.add(shape(THREE.CircleGeometry, 0.33, 20), mul(M, xf([0, 0.405, 0], [-Math.PI / 2, 0, 0])), season === 'winter' ? '#ffffff' : '#e8c48f', { cast: false })
  if (season !== 'winter') b.add(shape(THREE.RingGeometry, 0.15, 0.18, 20), mul(M, xf([0, 0.41, 0], [-Math.PI / 2, 0, 0])), '#b88a55', { unlit: true })
  if (season === 'spring' || season === 'summer') {
    const sprout = mul(M, xf([0.12, 0.42, 0.05]))
    b.add(shape(THREE.CylinderGeometry, 0.015, 0.015, 0.16, 4), mul(sprout, xf([0, 0.08, 0])), '#5aa84f', { cast: false })
    b.add(shape(THREE.SphereGeometry, 1, 8, 6), mul(sprout, xf([0.05, 0.16, 0], [0, 0, -0.6], [0.07, 0.03, 0.045])), '#7ccf6a', { cast: false })
  }
}

/** 쓰러진 통나무: 이끼 낀 몸통, 양 끝 나이테, 옆에 버섯 하나 */
function addLog(b: Batch, M: THREE.Matrix4, season: Season) {
  b.add(shape(THREE.CylinderGeometry, 0.27, 0.3, 1.9, 12), mul(M, xf([0, 0.27, 0], [Math.PI / 2, 0, 0])), '#8f603a', { outline: 0.06 })
  for (const sd of [-1, 1]) {
    b.add(shape(THREE.CircleGeometry, 0.26, 16), mul(M, xf([0, 0.27, sd * 0.955], [0, sd > 0 ? 0 : Math.PI, 0])), '#e1bb86', { cast: false })
  }
  // 이끼 / 눈
  b.add(shape(THREE.SphereGeometry, 1, 10, 6), mul(M, xf([0.02, 0.5, -0.15], [0, 0, 0], [0.22, 0.07, 0.55])), season === 'winter' ? '#ffffff' : '#79b65a', { cast: false })
  if (season !== 'winter') addMushroom(b, M, 0.36, 0.5, 0.75)
}

/** 버섯 한 송이. 빨간 버섯만 흰 점이 있다. */
function addMushroom(b: Batch, M: THREE.Matrix4, x: number, z: number, scale = 1, cap = '#e2493f') {
  const base = mul(M, xf([x, 0, z], [0, 0, 0], scale))
  b.add(shape(THREE.CylinderGeometry, 0.045, 0.06, 0.18, 8), mul(base, xf([0, 0.09, 0])), '#fff4e3', { cast: false })
  const capScale: V3 = [0.16, 0.1, 0.16]
  b.add(shape(THREE.SphereGeometry, 1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mul(base, xf([0, 0.19, 0], [0, 0, 0], capScale)), cap, { outline: 0.1 })
  if (cap === '#e2493f') {
    for (const a of [0, 2.1, 4.2]) b.add(shape(THREE.SphereGeometry, 1, 6, 4), mul(base, xf([Math.cos(a) * 0.08, 0.26, Math.sin(a) * 0.08], [0, 0, 0], 0.022)), '#ffffff', { unlit: true })
  }
}

/** 버섯 무리: 빨간 점박이 하나와 갈색 꼬마 둘. 겨울엔 숨는다. 가을엔 한 송이 더. */
function addMushrooms(b: Batch, M: THREE.Matrix4, season: Season) {
  if (season === 'winter') return
  addMushroom(b, M, 0, 0)
  addMushroom(b, M, 0.2, 0.12, 0.65, '#b07a4a')
  addMushroom(b, M, -0.15, 0.18, 0.55, '#c99060')
  if (season === 'autumn') addMushroom(b, M, 0.05, -0.22, 0.8, '#e8a33c')
}

/** 자갈 무리: 납작한 회색 돌 몇 개. 겨울엔 눈을 살짝 인다. */
function addPebbles(b: Batch, s: ScenerySpot, M: THREE.Matrix4, season: Season) {
  const rng = mulberry32(hashString(s.id))
  const stones = Array.from({ length: 4 + Math.floor(rng() * 3) }, () => {
    const a = rng() * Math.PI * 2
    const d = rng() * 0.45
    const r = 0.07 + rng() * 0.1
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r, rot: rng() * Math.PI, tone: rng() < 0.5 ? '#a9a59c' : '#c2bdb2' }
  })
  stones.forEach((st, i) => {
    const sc: V3 = [st.r, st.r * 0.55, st.r * 0.8]
    b.add(shape(THREE.DodecahedronGeometry, 1, 0), mul(M, xf([st.x, st.r * 0.35, st.z], [0, st.rot, 0], sc)), season === 'winter' && i % 2 === 0 ? '#f4f8fb' : st.tone, { outline: 0.12, cast: st.r >= 0.1 })
  })
}

/** 정적 소품 한 구역. 같은 구역의 것은 한 덩어리로 굳혀 드로콜을 구역 수만큼만 쓴다. */
function addStatic(b: Batch, s: ScenerySpot, season: Season) {
  const M = xf([s.x, heightAt(s.x, s.z), s.z], [0, s.rot, 0], s.scale)
  if (s.kind === 'stump') addStump(b, M, season)
  else if (s.kind === 'log') addLog(b, M, season)
  else if (s.kind === 'mushroom') addMushrooms(b, M, season)
  else if (s.kind === 'pebbles') addPebbles(b, s, M, season)
}

/** 정적 소품 전부(그루터기·통나무·버섯·자갈). 섬 전체를 재질별 몇 덩어리로만 굳혀 드로콜을 줄인다. */
function StaticProps({ spots, season }: { spots: ScenerySpot[]; season: Season }) {
  const g = useMerged((b) => spots.forEach((s) => addStatic(b, s, season)), [spots, season])
  // 덤불·풀 같은 초록 식물만 밤 톤을 받는다(돌·꽃·열매는 그대로)
  const lit = useMemo(() => withNightTone(vertexToonMaterial()), [])
  useEffect(() => () => lit.dispose(), [lit])
  return <Merge g={g} lit={lit} />
}

const WILDFLOWERS = SCENERY.filter((s) => s.kind === 'wildflowers')
const STATIC = SCENERY.filter((s) => s.kind === 'stump' || s.kind === 'log' || s.kind === 'mushroom' || s.kind === 'pebbles')
const BUSHES = SCENERY.filter((s) => s.kind === 'bush')

/** 덤불·그루터기·통나무·버섯·들꽃·자갈. 계절 따라 색과 장식이 바뀐다. */
export function Scenery() {
  const season = useSeason()
  const raw = useGame((s) => s.infra.paths)
  // 길을 깐 칸 둘레의 들꽃·자갈은 길 밑으로 뚫고 나오므로 빼고 굳힌다
  const { wild, statics } = useMemo(() => {
    const keys = pathKeys(decodePaths(raw))
    return {
      wild: WILDFLOWERS.filter((s) => !nearPath(s.x, s.z, keys, 0.3)),
      statics: STATIC.filter((s) => !nearPath(s.x, s.z, keys, 0.3)),
    }
  }, [raw])
  return (
    <>
      <Wildflowers spots={wild} season={season} />
      <StaticProps spots={statics} season={season} />
      {BUSHES.map((s) => (
        <Bush key={s.id} s={s} season={season} />
      ))}
    </>
  )
}

/**
 * 들꽃 무더기: 가는 줄기 끝에 작은 꽃. 계절 꽃 색을 쓰고 겨울엔 마른 줄기만 남는다.
 * 무더기가 많아 섬 전체 줄기·꽃송이를 인스턴스 메시 두 개로 한 번에 그린다.
 */
function Wildflowers({ spots, season }: { spots: ScenerySpot[]; season: Season }) {
  const stems = useMemo(
    () =>
      spots.flatMap((s) => {
        const rng = mulberry32(hashString(s.id))
        const y0 = heightAt(s.x, s.z)
        return Array.from({ length: 9 }, () => {
          const a = rng() * Math.PI * 2
          const d = Math.sqrt(rng()) * 0.55 * s.scale
          const h = (0.18 + rng() * 0.18) * s.scale
          return { x: s.x + Math.cos(a) * d, y: y0, z: s.z + Math.sin(a) * d, h, lean: (rng() - 0.5) * 0.5, c: Math.floor(rng() * 8) }
        })
      }),
    [spots],
  )
  const stemRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const winter = season === 'winter'
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3()
    const col = new THREE.Color()
    const palette = SEASON_INFO[season].flowers
    stems.forEach((st, i) => {
      // 줄기: 높이만큼 늘인 원기둥을 살짝 기울여 세운다. 꽃은 기운 줄기 끝에 얹는다.
      q.setFromEuler(e.set(0, 0, st.lean))
      m.compose(v.set(st.x, st.y + st.h / 2, st.z), q, sc.set(1, st.h, 1))
      stemRef.current?.setMatrixAt(i, m)
      const tip = v.set(-Math.sin(st.lean) * st.h, Math.cos(st.lean) * st.h, 0)
      m.compose(tip.set(st.x + tip.x, st.y + tip.y + 0.02, st.z), q.identity(), sc.set(0.055, 0.035, 0.055))
      headRef.current?.setMatrixAt(i, m)
      headRef.current?.setColorAt(i, col.set(palette[st.c % palette.length]))
    })
    if (stemRef.current) stemRef.current.instanceMatrix.needsUpdate = true
    if (headRef.current) {
      headRef.current.instanceMatrix.needsUpdate = true
      if (headRef.current.instanceColor) headRef.current.instanceColor.needsUpdate = true
    }
  }, [stems, season])
  return (
    <>
      <instancedMesh ref={stemRef} args={[undefined, undefined, stems.length]}>
        <cylinderGeometry args={[0.012, 0.016, 1, 4]} />
        <Toon color={winter ? '#b9a77e' : '#5fa04e'} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, stems.length]} visible={!winter}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshToonMaterial />
      </instancedMesh>
    </>
  )
}

