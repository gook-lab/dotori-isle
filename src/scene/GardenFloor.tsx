import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { decodeGarden, type GardenKind, type GardenTile } from '../core/gardenTiles'
import { heightAt } from '../core/island'
import { useGame } from '../game/store'
import { buildPathGeometries, faceUp } from './Paths'
import { vertexToonMaterial } from './batching'

/** 땅 위로 띄우는 높이(길과 같은 높이). 나무 데크 판은 한 칸에 네 장을 가로로 깐다. */
const LIFT = 0.035
const DECK_A = new THREE.Color('#c08a52')
const DECK_B = new THREE.Color('#ad7642')
const GAP = new THREE.Color('#6b4a2b')

/**
 * 정원 바닥 칸을 지오메트리로 굳힌다. 자갈·벽돌은 길 그리기(buildPathGeometries)를 그대로 쓰고,
 * 나무 데크만 판자 네 장을 따로 그린다.
 */
export function buildGardenGeometries(tiles: readonly GardenTile[]): Record<GardenKind, THREE.BufferGeometry | null> {
  const pathTiles = tiles.filter((t) => t.kind !== 'deck').map((t) => ({ x: t.x, z: t.z, kind: t.kind === 'gravel' ? ('stone' as const) : ('brick' as const) }))
  const paths = buildPathGeometries(pathTiles)
  return { gravel: paths.stone, brick: paths.brick, deck: buildDeck(tiles.filter((t) => t.kind === 'deck')) }
}

function buildDeck(tiles: readonly GardenTile[]): THREE.BufferGeometry | null {
  if (!tiles.length) return null
  const pos: number[] = []
  const col: number[] = []
  const nrm: number[] = []
  // 판자는 틈 바닥보다 살짝 높게 올려 겹쳐 깜빡이지 않게 한다
  const quad = (x0: number, z0: number, x1: number, z1: number, c: THREE.Color, ox: number, oz: number, lift: number) => {
    const corners: [number, number][] = [
      [ox + x0, oz + z0],
      [ox + x1, oz + z0],
      [ox + x1, oz + z1],
      [ox + x0, oz + z1],
    ]
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [x, z] = corners[i]
      pos.push(x, heightAt(x, z) + lift, z)
      col.push(c.r, c.g, c.b)
      nrm.push(0, 1, 0)
    }
  }
  for (const t of tiles) {
    const shade = 1 + ((Math.imul(t.x * 31 + t.z, 0x9e3779b1) >>> 0) / 4294967296 - 0.5) * 0.08
    quad(-0.5, -0.5, 0.5, 0.5, GAP.clone().multiplyScalar(shade), t.x, t.z, LIFT)
    // 판자: 가로로 네 장, 판 사이 틈은 어두운 바닥이 보인다
    for (let k = 0; k < 4; k++) {
      const z0 = -0.5 + k * 0.25 + 0.025
      const base = k % 2 === 0 ? DECK_A : DECK_B
      quad(-0.46, z0, 0.46, z0 + 0.2, base.clone().multiplyScalar(shade), t.x, t.z, LIFT + 0.012)
    }
  }
  faceUp(pos, col)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  return g
}

/** 정원 바닥 칸: 저장된 줄이 바뀔 때만 다시 굳힌다 */
export function GardenFloor() {
  const raw = useGame((s) => s.gardenTiles)
  const geos = useMemo(() => buildGardenGeometries(decodeGarden(raw)), [raw])
  useEffect(() => () => (Object.values(geos) as (THREE.BufferGeometry | null)[]).forEach((g) => g?.dispose()), [geos])
  const mat = useMemo(() => vertexToonMaterial(), [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group>
      {(['gravel', 'brick', 'deck'] as const).map((k) => {
        const g = geos[k]
        return g ? <mesh key={k} geometry={g} material={mat} /> : null
      })}
    </group>
  )
}
