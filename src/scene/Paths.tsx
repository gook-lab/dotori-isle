import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { decodePaths, PATH_KINDS, tileOutline, type PathKind, type PathTile } from '../core/paths'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { vertexToonMaterial } from './batching'

/** 땅 위로 살짝 띄운 높이: 땅과 겹쳐 깜빡이지 않게 한다. 층마다 더 띄워서 쌓는다. */
const LIFT = 0.035
/** 흙길은 섬의 경사로 흙길 색(Island.tsx 의 PATH)에 맞춘다 */
const SAND = new THREE.Color('#cfa872')
/** 흙길 가장자리가 풀밭으로 녹아드는 색 */
const GRASS = new THREE.Color('#9db06a')
const FLAG = new THREE.Color('#d8d3c4')
/** 돌 틈으로 비치는 흙 */
const BED = new THREE.Color('#9c7f55')
const BRICK = new THREE.Color('#b8553c')
const MORTAR = new THREE.Color('#d9d0bd')

/** 칸 위치로 정하는 0~1 난수. 같은 칸은 다시 그려도 같은 값이 나온다. salt 로 층마다 다르게 한다. */
function h01(x: number, z: number, salt: number): number {
  let h = Math.imul(x | 0, 0x9e3779b1) ^ Math.imul((z | 0) + salt * 131, 0x85ebca77)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

/** 정점마다 주는 아주 작은 색 얼룩. 0.5 중심이고 칸끼리 이어져도 얼룩이 맞물린다. */
function grain(x: number, z: number): number {
  return h01(Math.round(x * 6), Math.round(z * 6), 9)
}

/** 삼각형이 위(+y)를 보도록 감는 순서를 맞춘다. 뒤집힌 면은 토온 음영이 아래에서 비쳐 어둡게 나온다. */
export function faceUp(pos: number[], col: number[]) {
  for (let b = 0; b < pos.length; b += 9) {
    const ux = pos[b + 3] - pos[b]
    const uz = pos[b + 5] - pos[b + 2]
    const wx = pos[b + 6] - pos[b]
    const wz = pos[b + 8] - pos[b + 2]
    if (uz * wx - ux * wz >= 0) continue
    for (let c = 0; c < 3; c++) {
      ;[pos[b + 3 + c], pos[b + 6 + c]] = [pos[b + 6 + c], pos[b + 3 + c]]
      ;[col[b + 3 + c], col[b + 6 + c]] = [col[b + 6 + c], col[b + 3 + c]]
    }
  }
}

/** 길 칸들을 종류별로 한 덩어리 지오메트리에 담는다. 이웃 칸(어느 종류든)을 보고 가장자리를 맞춘다. */
export function buildPathGeometries(tiles: readonly PathTile[]): Record<PathKind, THREE.BufferGeometry | null> {
  const keys = new Set(tiles.map((t) => `${t.x},${t.z}`))
  const out = {} as Record<PathKind, THREE.BufferGeometry | null>
  for (const kind of PATH_KINDS) {
    const pos: number[] = []
    const col: number[] = []
    const nrm: number[] = []
    // 정점 하나: 월드 좌표, 색(얼룩 적용), 띄움 높이
    const put = (x: number, z: number, c: THREE.Color, lift: number) => {
      const k = 1 + (grain(x, z) - 0.5) * 0.1
      pos.push(x, heightAt(x, z) + lift, z)
      col.push(c.r * k, c.g * k, c.b * k)
      nrm.push(0, 1, 0)
    }
    // 볼록 다각형을 무게중심 부채꼴로 채운다
    const fan = (ox: number, oz: number, poly: [number, number][], c: THREE.Color, lift: number) => {
      let cx = 0
      let cz = 0
      for (const [x, z] of poly) {
        cx += x
        cz += z
      }
      cx /= poly.length
      cz /= poly.length
      for (let i = 0; i < poly.length; i++) {
        const [ax, az] = poly[i]
        const [bx, bz] = poly[(i + 1) % poly.length]
        put(ox + cx, oz + cz, c, lift)
        put(ox + ax, oz + az, c, lift)
        put(ox + bx, oz + bz, c, lift)
      }
    }
    // 같은 점 개수의 두 선 사이를 색을 바꿔 가며 잇는다(가장자리 번짐)
    const band = (ox: number, oz: number, a: [number, number][], b: [number, number][], ca: THREE.Color, cb: THREE.Color, lift: number) => {
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length
        put(ox + a[i][0], oz + a[i][1], ca, lift)
        put(ox + a[j][0], oz + a[j][1], ca, lift)
        put(ox + b[j][0], oz + b[j][1], cb, lift)
        put(ox + a[i][0], oz + a[i][1], ca, lift)
        put(ox + b[j][0], oz + b[j][1], cb, lift)
        put(ox + b[i][0], oz + b[i][1], cb, lift)
      }
    }
    for (const t of tiles) {
      if (t.kind !== kind) continue
      const has = (dx: number, dz: number) => keys.has(`${t.x + dx},${t.z + dz}`)
      const nE = has(1, 0)
      const nN = has(0, 1)
      const nW = has(-1, 0)
      const nS = has(0, -1)
      const shade = 1 + (h01(t.x, t.z, 1) - 0.5) * 0.12
      const tint = (c: THREE.Color) => c.clone().multiplyScalar(shade)
      const outline = tileOutline(0, nE, nN, nW, nS)

      if (kind === 'dirt') {
        // 흙길: 바깥은 풀색, 가운데는 중간색, 안쪽은 모래 흙색으로 세 겹을 잇는다(진한 테두리 없음)
        const mid = tileOutline(0.5, nE, nN, nW, nS)
        const inner = tileOutline(1, nE, nN, nW, nS)
        const mix = GRASS.clone().lerp(SAND, 0.5)
        band(t.x, t.z, outline, mid, GRASS, mix, LIFT)
        band(t.x, t.z, mid, inner, mix, tint(SAND), LIFT)
        fan(t.x, t.z, inner, tint(SAND), LIFT)
      } else if (kind === 'stone') {
        // 돌길: 흙 바닥 위에 사분면 가운데 세 개를 돌로 깐다. 돌 사이 틈은 흙이 보인다.
        fan(t.x, t.z, outline, tint(BED), LIFT)
        const G = 0.06
        const g = 0.05
        const sx = (h01(t.x, t.z, 2) - 0.5) * 0.08
        const sz = (h01(t.x, t.z, 3) - 0.5) * 0.08
        const x0 = nW ? -0.5 : -0.5 + G
        const x1 = nE ? 0.5 : 0.5 - G
        const z0 = nS ? -0.5 : -0.5 + G
        const z1 = nN ? 0.5 : 0.5 - G
        const quads: [number, number, number, number][] = [
          [x0, sx - g / 2, sz + g / 2, z1],
          [sx + g / 2, x1, sz + g / 2, z1],
          [x0, sx - g / 2, z0, sz - g / 2],
          [sx + g / 2, x1, z0, sz - g / 2],
        ]
        const skip = Math.floor(h01(t.x, t.z, 4) * 4)
        quads.forEach(([qa, qb, qc, qd], k) => {
          if (k === skip) return
          const j = h01(t.x, t.z, 10 + k)
          const poly: [number, number][] = [
            [qa, qc],
            [qb, qc],
            [qb, qd],
            [qa, qd],
          ]
          const c = FLAG.clone().multiplyScalar(0.9 + j * 0.2)
          fan(t.x, t.z, poly, c, LIFT + 0.012 + j * 0.012)
        })
      } else {
        // 벽돌길: 줄눈 색 바닥 위에 두 줄 쌓기(줄마다 벽돌 엇갈림). 모서리 쪽 벽돌은 둥근 모서리 안에 든다.
        fan(t.x, t.z, outline, MORTAR, LIFT)
        const M = 0.05
        const rows: [number, number][][] = [
          [
            [-0.5, 0],
            [0, 0.5],
          ],
          [
            [-0.5, -0.25],
            [-0.25, 0.25],
            [0.25, 0.5],
          ],
        ]
        rows.forEach((bricks, r) => {
          const bz0 = r === 0 ? -0.5 : 0
          const bz1 = r === 0 ? 0 : 0.5
          for (const [bx0, bx1] of bricks) {
            const xa = bx0 === -0.5 ? (nW ? -0.5 + 0.02 : -0.4) : bx0 + M / 2
            const xb = bx1 === 0.5 ? (nE ? 0.5 - 0.02 : 0.4) : bx1 - M / 2
            const za = bz0 === -0.5 ? (nS ? -0.5 + 0.02 : -0.4) : bz0 + M / 2
            const zb = bz1 === 0.5 ? (nN ? 0.5 - 0.02 : 0.4) : bz1 - M / 2
            const j = h01(t.x * 2 + Math.round(bx0 * 4), t.z * 2 + r, 5)
            const c = BRICK.clone().multiplyScalar(0.88 + j * 0.22)
            fan(t.x, t.z, [[xa, za], [xb, za], [xb, zb], [xa, zb]], c, LIFT + 0.01)
          }
        })
      }
    }
    if (!pos.length) {
      out[kind] = null
      continue
    }
    faceUp(pos, col)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
    out[kind] = g
  }
  return out
}

/** 길 한 덩어리씩: 저장된 칸이 바뀔 때만 다시 굳히고 이전 지오메트리는 버린다 */
export function Paths() {
  const raw = useGame((s) => s.infra.paths)
  const geos = useMemo(() => buildPathGeometries(decodePaths(raw)), [raw])
  useEffect(() => () => PATH_KINDS.forEach((k) => geos[k]?.dispose()), [geos])
  const mat = useMemo(() => {
    return vertexToonMaterial()
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group>
      {PATH_KINDS.map((k) => {
        const g = geos[k]
        return g ? <mesh key={k} geometry={g} material={mat} /> : null
      })}
      <PaintGhost />
    </group>
  )
}

/** 길 깔기 중 바라보는 칸의 미리보기: 놓을 수 있으면 연두, 걷어낼 칸은 주황, 안 되면 빨강 */
function PaintGhost() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = runtime.paintMode ? runtime.paintTarget : null
    m.visible = !!t
    if (!t) return
    m.position.set(t.x, heightAt(t.x, t.z) + LIFT + 0.01, t.z)
    mat.color.set(!t.ok ? '#e0604c' : t.remove ? '#e8a46c' : '#9ee07a')
  })
  return (
    <mesh ref={ref} material={mat} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <planeGeometry args={[0.9, 0.9]} />
    </mesh>
  )
}
