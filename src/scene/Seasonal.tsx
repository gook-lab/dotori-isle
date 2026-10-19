import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { SEASON_INFO } from '../core/season'
import { blossomSpotsOf, groundLeafSpots, leafPiles, petalAt } from '../core/seasonal'
import { TREES } from '../core/world'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useSeason } from './Island'
import { withNightTone } from './worldFx'

const LEAF_COLORS = ['#e0883a', '#d9482b', '#f0c24a', '#8a5a2b', '#c96a2e']
/** 더미 하나의 잎 조각 칸. 더미마다 5~8 장만 쓰고 나머지는 숨긴다. */
const CHIP_SLOTS = 8
/** 0~1 사이 고정 난수. 같은 더미·조각은 늘 같은 모양이다. */
const hash = (n: number) => Math.abs(Math.sin(n * 91.7 + 13.1))

/** 더미 i 의 j 번째 잎 조각: 가운데가 솟은 둔덕이고, 납작하면 흩어져 바닥에 눕는다. */
function chipAt(i: number, j: number, flat: boolean) {
  const n = 5 + (i % 4)
  if (j >= n) return null
  const ang = hash(i * 31 + j) * Math.PI * 2
  const r = (0.08 + 0.3 * hash(i * 17 + j * 5)) * (flat ? 1.7 : 1)
  const layer = j < n / 2 ? 0 : 1
  const y = flat ? 0.03 : 0.07 + layer * 0.13 + 0.05 * hash(i * 7 + j)
  const w = 0.42 + 0.1 * hash(i * 3 + j * 11)
  return { x: Math.cos(ang) * r, y, z: Math.sin(ang) * r, ry: hash(i + j * 13) * Math.PI, w, h: flat ? 0.05 : 0.14 }
}

/**
 * 가을 낙엽더미: 주황·빨강·노랑·갈색 잎 조각 5~8 장이 쌓인 둔덕 하나씩. E 로 차면 납작하게 흩어지고, 다음 날 다시 쌓인다.
 */
export function LeafPiles() {
  const season = useSeason()
  const piles = useMemo(() => leafPiles(), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  // 마지막으로 그린 모양(더미마다 쌓임/납작). 바뀔 때만 행렬을 다시 쓴다.
  const shown = useRef('')
  useLayoutEffect(() => {
    shown.current = ''
  }, [season])
  useFrame(() => {
    const mesh = ref.current
    if (season !== 'autumn' || !mesh) return
    const day = useGame.getState().day
    const flat = piles.map((p) => runtime.kickedDay[p.id] === day)
    const key = flat.map((f) => (f ? 1 : 0)).join('')
    if (key === shown.current) return
    shown.current = key
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3()
    const c = new THREE.Color()
    piles.forEach((p, i) => {
      const base = heightAt(p.x, p.z)
      for (let j = 0; j < CHIP_SLOTS; j++) {
        const k = i * CHIP_SLOTS + j
        const ch = chipAt(i, j, flat[i])
        if (!ch) {
          mesh.setMatrixAt(k, m.makeScale(0, 0, 0))
          continue
        }
        q.setFromEuler(new THREE.Euler(0, ch.ry, 0))
        m.compose(v.set(p.x + ch.x, base + ch.y, p.z + ch.z), q, sc.set(ch.w, ch.h, ch.w * 0.85))
        mesh.setMatrixAt(k, m)
        mesh.setColorAt(k, c.set(LEAF_COLORS[(i * 3 + j) % LEAF_COLORS.length]))
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  if (season !== 'autumn') return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, piles.length * CHIP_SLOTS]}>
      <sphereGeometry args={[0.5, 8, 6]} />
      <meshToonMaterial />
    </instancedMesh>
  )
}

const PETALS = 60
/** 봄 꽃잎: 열매 나무 둘레를 천천히 흩날리며 떨어진다. 한 덩어리 인스턴스로 그린다. */
export function BlossomPetals() {
  const season = useSeason()
  const trees = useMemo(() => blossomSpotsOf(TREES), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  // 매 프레임 새 객체를 만들지 않도록 계산용 객체는 한 번만 만들어 재사용한다
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const sc = useMemo(() => new THREE.Vector3(0.13, 0.13, 0.13), [])
  const base = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (season !== 'spring' || !mesh || !trees.length) return
    const t = clock.elapsedTime
    for (let i = 0; i < PETALS; i++) {
      const tr = trees[i % trees.length]
      base.x = tr.x
      base.y = heightAt(tr.x, tr.z) + 1.6 * tr.scale
      base.z = tr.z
      petalAt(base, (i * 0.618) % 1, t, v)
      q.setFromEuler(e.set(t * 1.7 + i, i * 0.9, t * 0.8))
      mesh.setMatrixAt(i, m.compose(v, q, sc))
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  if (season !== 'spring') return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PETALS]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffc4d6" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

/**
 * 가을 땅의 낙엽 조각: 나무 밑동 둘레에 납작하게 떨어진 잎. 가을에만 보이고, 색은 가을 잎 네 가지에서 고른다.
 */
export function GroundLeaves() {
  const season = useSeason()
  const spots = useMemo(() => groundLeafSpots(TREES), [])
  const material = useMemo(() => withNightTone(new THREE.MeshToonMaterial(), 'plant'), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3(0.12, 0.12, 0.12)
    const tones = SEASON_INFO.autumn.leaves.map((c) => new THREE.Color(c))
    spots.forEach((s, i) => {
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, s.rot))
      v.set(s.x, heightAt(s.x, s.z) + 0.03, s.z)
      m.compose(v, q, sc)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, tones[s.tone])
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [spots])
  return (
    <instancedMesh ref={ref} args={[undefined, material, spots.length]} visible={season === 'autumn'} frustumCulled={false}>
      <circleGeometry args={[1, 5]} />
    </instancedMesh>
  )
}
