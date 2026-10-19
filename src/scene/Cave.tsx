import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { caveSpot, minesLeft, tideHigh } from '../core/cave'
import { currentHour } from '../core/clock'
import { heightAt } from '../core/island'
import { CAVE_CHEST, CAVE_NODES, CAVE_POOLS, CAVE_ROOM, roomCenter, ROOM_D, ROOM_W } from '../core/interior'
import { hashString, mulberry32 } from '../core/rng'
import { useGame } from '../game/store'
import { type Batch, Merge, shape, useMerged, vertexToonMaterial, xf } from './batching'

const STONE = ['#5b5149', '#4d443c', '#665a4f', '#3f3832']
const ORE_COLORS = ['#e8912f', '#a45cd6', '#e9f2ff']

/** 울퉁불퉁한 돌 한 덩이. 크기와 기울기를 조금씩 흔든다. */
function stone(b: Batch, r: () => number, x: number, y: number, z: number, s: number, color?: string, outline = 0.05) {
  const sc: [number, number, number] = [s * (0.8 + r() * 0.4), s * (0.7 + r() * 0.5), s * (0.8 + r() * 0.4)]
  const c = color ?? STONE[Math.floor(r() * STONE.length)]
  b.add(shape(THREE.DodecahedronGeometry, 1, 0), xf([x, y, z], [r() * 3, r() * 3, r() * 3], sc), c, { outline })
}

/** 뾰족한 기둥. flip 이면 천장에서 아래로 늘어진 종유석이다. y 는 붙는 자리다. */
function spike(b: Batch, x: number, y: number, z: number, rad: number, h: number, color: string, flip: boolean) {
  b.add(shape(THREE.ConeGeometry, 1, 1, 6), xf([x, y + (flip ? -h / 2 : h / 2), z], [flip ? Math.PI : 0, 0, 0], [rad, h, rad]), color, { outline: 0.04 })
}

/** 보물 상자: 둥근 뚜껑, 금속 띠, 자물쇠. 상자 가운데 바닥 자리에 놓는다. */
function chest(b: Batch, x: number, z: number) {
  const wood = '#7a4a2a'
  const gold = '#d9a441'
  b.add(shape(THREE.BoxGeometry, 1, 1, 1), xf([x, 0.25, z], [0, 0, 0], [1, 0.5, 0.6]), wood, { outline: 0.04 })
  // 뚜껑: 반원기둥을 눕힌 것. 축이 가로(x)로 가도록 z 축으로 90도 돌린다.
  b.add(shape(THREE.CylinderGeometry, 1, 1, 1, 14, 1, false, 0, Math.PI), xf([x, 0.5, z], [0, 0, Math.PI / 2], [0.3, 1, 0.3]), wood, { outline: 0.04 })
  for (const dx of [-0.32, 0.32]) b.add(shape(THREE.BoxGeometry, 1, 1, 1), xf([x + dx, 0.36, z], [0, 0, 0], [0.07, 0.72, 0.64]), gold, { outline: 0.03 })
  b.add(shape(THREE.BoxGeometry, 1, 1, 1), xf([x, 0.38, z + 0.32], [0, 0, 0], [0.13, 0.16, 0.05]), gold, { outline: 0.03 })
}

/** 서쪽 해안 바위 턱의 동굴 입구. 둥근 아치를 돌로 둘러 위 바위 턱과 잇는다. */
function buildRocks(b: Batch) {
  const r = mulberry32(hashString('cave-entrance'))
  const rocks: [number, number, number, number, number, number][] = [
    // [x, y, z, 크기, 기울기 x, 기울기 y]
    [0, 2.05, 0.3, 0.95, 0.2, 0.9],
    // 큰 뒤쪽 바위는 아치 뒤로 물려 앞 돌 테를 가리지 않게 한다
    [-0.4, 0.5, -1.6, 1.4, 0.3, 0.2],
    [1.1, 0.4, -1.3, 1.1, 0.6, 0.1],
  ]
  for (const [x, y, z, sc, rx, ry] of rocks)
    b.add(shape(THREE.DodecahedronGeometry, sc, 0), xf([x, y, z], [rx, ry, 0], 1), '#8f8478', { outline: 0.05 })
  // 아치: 입구 가운데(0, 0.55)를 둘러싸는 반원을 두 겹으로 쌓는다. 안쪽 겹은 굴 입구 둘레, 바깥 겹은 두께를 준다.
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8
    stone(b, r, Math.cos(a) * 0.95, 0.55 + Math.sin(a) * 0.95, 1.05, 0.3, '#8f8478')
    stone(b, r, Math.cos(a) * 1.2, 0.55 + Math.sin(a) * 1.2, 0.8, 0.34, '#7d7268')
  }
}

/** 물 면 타원의 가운데 자리(로컬 z). 입구 앞에서 바다 쪽으로 길게 뻗는다. */
const ELLIPSE_Z = -0.3

/** 평면 도형을 가로 1.6, 바다 쪽 세로 2.2 의 타원으로 눕힌다. 반지름 1 기준 */
function flatEllipse(g: THREE.BufferGeometry) {
  g.scale(1.6, 2.2, 1)
  g.rotateX(-Math.PI / 2)
  return g
}

/**
 * 원판 가장자리에 쓸 투명도 그림. 가운데는 1, r 이 커질수록 0 으로 부드럽게 사라진다.
 * alpha(r, a): r 은 원판 중심에서 가장자리까지 0~1, a 는 각도(라디안).
 */
function alphaTexture(alpha: (r: number, a: number) => number) {
  const N = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = N
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Texture()
  const img = ctx.createImageData(N, N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) / N) * 2 - 1
      const v = ((y + 0.5) / N) * 2 - 1
      const val = Math.max(0, Math.min(1, alpha(Math.hypot(u, v), Math.atan2(v, u)))) * 255
      const i = (y * N + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(canvas)
}

const smooth01 = (lo: number, hi: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/** 물 면: 가장자리로 갈수록 옅어진다 */
const waterFade = () => alphaTexture((r) => 1 - smooth01(0.5, 1, r))
/** 거품 고리: 얇은 띠이고, 각도마다 굵기가 달라 군데군데 끊긴다 */
const foamRing = () =>
  alphaTexture((r, a) => {
    const n = 0.5 + 0.3 * Math.sin(a * 5 + 1.1) + 0.2 * Math.sin(a * 13 + 0.4) + 0.1 * Math.sin(a * 29)
    const band = smooth01(0.8, 0.88, r) * (1 - smooth01(0.93, 0.99, r))
    return band * smooth01(0.42, 0.5, n)
  })

/** 밀물과 썰물이 물 높이를 바꾸는 시간(초) */
const TIDE_RISE = 0.6
/** 물이 빠진 뒤 젖은 모래 자국이 마르는 시간(초) */
const WET_DRY = 5

/** 입구 둘레 바위. 가운데 어두운 아치 구멍이 동굴 입구다. */
export function CaveEntrance() {
  const spot = useMemo(() => caveSpot(), [])
  const y = heightAt(spot.x, spot.z)
  const rocks = useMerged(buildRocks, [])
  const water = useRef<THREE.Mesh>(null)
  const foam = useRef<THREE.Mesh>(null)
  const stain = useRef<THREE.MeshBasicMaterial>(null)
  // 물 면은 바다 쪽(로컬 -z)으로 길게 늘인 타원이다. 해변 물과 이어 보이게 한다.
  const pool = useMemo(() => flatEllipse(new THREE.CircleGeometry(1, 32)), [])
  const rim = useMemo(() => flatEllipse(new THREE.CircleGeometry(1, 48)), [])
  const fade = useMemo(waterFade, [])
  const ring = useMemo(foamRing, [])
  // level: 0 은 모래 아래, 1 은 물이 차오른 높이. wet: 젖은 자국의 진하기
  const level = useRef(0)
  const wet = useRef(0)
  useFrame((_, dt) => {
    const target = tideHigh(currentHour()) ? 1 : 0
    const prev = level.current
    const step = dt / TIDE_RISE
    level.current = target > prev ? Math.min(target, prev + step) : Math.max(target, prev - step)
    // 물이 빠지는 동안 자국이 진해지고, 그 뒤 천천히 마른다
    wet.current = level.current < prev ? 1 : Math.max(0, wet.current - dt / WET_DRY)
    const surface = -0.15 + 0.4 * level.current
    if (water.current) {
      water.current.position.y = surface
      water.current.visible = level.current > 0.001
    }
    if (foam.current) {
      foam.current.position.y = surface + 0.01
      foam.current.visible = level.current > 0.001
    }
    if (stain.current) stain.current.opacity = wet.current * 0.5
  })
  // 안쪽 막다른 벽: 아치 모양으로 옅은 돌색을 깔아 터널이 깊이 있게 보이게 한다
  const back = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.7, -0.1)
    s.lineTo(-0.7, 0.55)
    s.absarc(0, 0.55, 0.7, Math.PI, 0, true)
    s.lineTo(0.7, -0.1)
    s.closePath()
    return new THREE.ShapeGeometry(s, 16)
  }, [])
  // 터널: 위쪽 반원기둥(축이 앞뒤 방향), 아래 양옆 벽과 바닥. 열린 앞쪽으로 들어가는 굴이다.
  const tunnel = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 1.7, 16, 1, true, Math.PI / 2, Math.PI), [])
  return (
    // 입구는 섬 가운데(동쪽)와 기본 카메라(남쪽) 사이 대각선을 본다. 기본 시점에서 아치 정면이 보이게 한다.
    <group position={[spot.x, y, spot.z]} rotation={[0, Math.PI / 4, 0]}>
      <Merge g={rocks} />
      {/* 터널: 아치 안쪽으로 깊어지는 어두운 굴 */}
      <mesh position={[0, 0.55, 0.4]} rotation={[Math.PI / 2, 0, 0]} geometry={tunnel}>
        <meshBasicMaterial color="#140f0b" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.7, 0.25, 0.4]}>
        <boxGeometry args={[0.06, 0.6, 1.7]} />
        <meshBasicMaterial color="#140f0b" />
      </mesh>
      <mesh position={[0.7, 0.25, 0.4]}>
        <boxGeometry args={[0.06, 0.6, 1.7]} />
        <meshBasicMaterial color="#140f0b" />
      </mesh>
      <mesh position={[0, -0.02, 0.4]}>
        <boxGeometry args={[1.4, 0.06, 1.7]} />
        <meshBasicMaterial color="#1a1310" />
      </mesh>
      <mesh position={[0, 0, -0.44]} geometry={back}>
        <meshBasicMaterial color="#3a2e25" />
      </mesh>
      {/* 밀물: 입구 앞으로 얕은 물이 차오르고 가장자리에 거품 고리가 돈다. 썰물엔 젖은 모래 자국만 남는다. */}
      <mesh ref={water} position={[0, -0.15, ELLIPSE_Z]} visible={false} geometry={pool}>
        <meshStandardMaterial color="#6fc4cf" roughness={0.2} transparent opacity={0.55} alphaMap={fade} depthWrite={false} />
      </mesh>
      <mesh ref={foam} position={[0, -0.14, ELLIPSE_Z]} visible={false} geometry={rim}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} alphaMap={ring} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.03, ELLIPSE_Z]} geometry={pool}>
        <meshBasicMaterial ref={stain} color="#8a7452" transparent opacity={0} alphaMap={fade} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** 방 벽, 바닥 돌, 종유석과 석순, 웅덩이 둘레 돌, 광석 받침, 상자를 한 묶음으로 굳힌다. */
function buildRoom(b: Batch) {
  const r = mulberry32(hashString('cave-room'))
  const j = (lo: number, hi: number) => lo + (hi - lo) * r()
  // 뒤쪽 벽과 양옆 벽: 돌 덩이를 겹쳐 울퉁불퉁한 벽을 만든다
  for (let i = 0; i < 12; i++) stone(b, r, -5 + i * 0.9 + j(-0.2, 0.2), j(0.5, 2.8), -4.1 + j(-0.2, 0.1), j(0.7, 1.1))
  for (let i = 0; i < 8; i++) stone(b, r, -4.6 + i * 1.3, 3.3, -3.9, j(0.8, 1.0))
  for (const x of [-4.9, 4.9]) {
    for (let i = 0; i < 10; i++) stone(b, r, x + j(-0.2, 0.2), j(0.5, 2.8), -4 + i * 0.9, j(0.7, 1.0))
    for (let i = 0; i < 5; i++) stone(b, r, x * 0.94, 3.3, -3.6 + i * 1.8, j(0.8, 1.0))
  }
  // 천장 가장자리의 종유석
  for (let i = 0; i < 7; i++) spike(b, -4.2 + i * 1.4 + j(-0.2, 0.2), 3.0, -3.4 + j(-0.2, 0.2), j(0.12, 0.2), j(0.5, 1.1), STONE[1], true)
  for (const x of [-4.1, 4.1]) for (let i = 0; i < 3; i++) spike(b, x, 2.9, -2.4 + i * 2, j(0.12, 0.18), j(0.5, 0.9), STONE[1], true)
  // 바닥: 작은 돌, 석순(뒤쪽과 양옆 벽 가까이)
  for (let i = 0; i < 16; i++) stone(b, r, j(-4, 4), 0.1, j(-3, 3.4), j(0.08, 0.2), '#4a4138')
  for (let i = 0; i < 6; i++) {
    const x = (i % 2 ? 1 : -1) * j(3.6, 4.4)
    spike(b, x, 0, j(-3, 3), j(0.12, 0.2), j(0.3, 0.8), STONE[2], false)
  }
  spike(b, -1.2, 0, -3.7, 0.16, 0.45, STONE[2], false)
  // 광석 받침: 벽 바위에 박힌 돌 하나씩
  for (const n of CAVE_NODES) stone(b, r, n.x, 0.2, n.z - 0.25, 0.6, '#3d352e')
  // 웅덩이 둘레의 돌 테두리
  for (const p of CAVE_POOLS)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      stone(b, r, p.x + Math.cos(a) * (p.r + 0.02), 0.14, p.z + Math.sin(a) * (p.r + 0.02), 0.13, '#5b5149')
    }
  chest(b, CAVE_CHEST.x, CAVE_CHEST.z)
}

/** 광석 결정 무리. 원점은 광석이 박힌 자리 바닥이다. 크기와 기울기가 제각각인 뾰족한 결정 넷. */
function crystals(b: Batch, color: string) {
  const spec: [number, number, number, number, number, number][] = [
    // [x, z, 높이, 굵기, 기울기 x, 기울기 z]
    [-0.2, 0.05, 0.75, 0.13, 0.35, 0.2],
    [0.05, 0.1, 1.0, 0.16, 0.2, -0.1],
    [0.24, 0.02, 0.6, 0.11, -0.25, 0.3],
    [-0.02, -0.12, 0.45, 0.09, 0.1, -0.4],
  ]
  for (const [x, z, h, rad, rx, rz] of spec)
    b.add(shape(THREE.ConeGeometry, 1, 1, 5), xf([x, h / 2, z], [rx, 0, rz], [rad, h, rad]), color, { outline: 0.03 })
}

/** 한 벽의 광석 무리. 다 캐면 결정이 줄고 빛이 약해진다. */
function OreCluster({ at, color, depleted }: { at: { x: number; z: number }; color: string; depleted: boolean }) {
  const g = useMerged((b) => crystals(b, color), [color])
  const mat = useMemo(() => {
    const m = vertexToonMaterial()
    m.emissive.set(color)
    m.emissiveIntensity = depleted ? 0.04 : 0.45
    return m
  }, [color, depleted])
  return (
    <group position={[at.x, 0.35, at.z]} scale={depleted ? 0.5 : 1}>
      <Merge g={g} lit={mat} />
      {/* 바닥에 같은 색 빛 웅덩이 */}
      <mesh position={[0, -0.27, 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 20]} />
        <meshBasicMaterial color={color} transparent opacity={depleted ? 0.05 : 0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

/** 웅덩이 표면에서 살짝 반짝이는 점. 천천히 밝기가 오르내린다. */
function Glints({ x, z, r }: { x: number; z: number; r: number }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  useFrame(({ clock }) => {
    mats.current.forEach((m, i) => {
      if (m) m.opacity = 0.25 + 0.25 * Math.sin(clock.elapsedTime * 1.4 + i * 2.1)
    })
  })
  const spots: [number, number][] = [
    [-0.35, -0.2],
    [0.3, 0.25],
    [0.05, -0.5],
  ]
  return (
    <>
      {spots.map(([dx, dz], i) => (
        <mesh key={i} position={[x + dx * r, 0.16, z + dz * r]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.07, 8]} />
          <meshBasicMaterial ref={(m) => { mats.current[i] = m }} color="#e6f8ff" transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

const MOSS = Array.from({ length: 26 }, (_, i) => {
  const a = (i * 2.399) % (Math.PI * 2)
  const wall = i % 3
  // 벽 가까이에 흩어진 이끼 빛 한 점씩: 뒤쪽 벽, 왼쪽, 오른쪽
  if (wall === 0) return { x: Math.cos(a) * 4.2, y: 0.5 + ((i * 7) % 9) * 0.25, z: -3.8 }
  if (wall === 1) return { x: -4.8, y: 0.4 + ((i * 5) % 8) * 0.25, z: Math.sin(a) * 3 }
  return { x: 4.8, y: 0.4 + ((i * 3) % 8) * 0.25, z: Math.sin(a) * 3 }
})

const ROW_HALF_W = ROOM_W / 2
const ROW_HALF_D = ROOM_D / 2

/** 바닥: 가운데는 젖은 짙은 돌색이고 가장자리로 갈수록 어두워진다. 정점 색으로 칠한다. */
function useFloor() {
  return useMemo(() => {
    const g = new THREE.PlaneGeometry(ROOM_W, ROOM_D, 20, 16)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const col = new Float32Array(pos.count * 3)
    const base = new THREE.Color('#4a423b')
    const dark = new THREE.Color('#1c1815')
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / ROW_HALF_W
      const nz = pos.getZ(i) / ROW_HALF_D
      const t = Math.min(1, Math.pow(Math.hypot(nx, nz) * 0.8, 2))
      c.copy(base).lerp(dark, t)
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
}

/** 동굴 방: 바위 벽, 젖은 바닥, 광석 벽, 웅덩이, 깊은 곳 상자. 방 가운데가 원점이다. */
export function CaveRoom() {
  const inCave = useGame((s) => s.inCave)
  const depleted = useGame((s) => minesLeft(s.day, s.cave) === 0)
  const c = roomCenter(CAVE_ROOM)
  const room = useMerged(buildRoom, [])
  const floor = useFloor()
  const moss = useMemo(() => {
    const m = new THREE.Matrix4()
    const arr = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: '#9cff9a' }), MOSS.length)
    MOSS.forEach((p, i) => arr.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)))
    arr.instanceMatrix.needsUpdate = true
    return arr
  }, [])
  if (!inCave) return null
  return (
    <group position={[c.x, 0, c.z]}>
      <Merge g={room} />
      <mesh position={[0, 0.05, 0]} geometry={floor}>
        <meshStandardMaterial vertexColors roughness={0.35} metalness={0.05} />
      </mesh>
      <primitive object={moss} />
      {/* 웅덩이: 물 표면은 거칠지 않게, 위에 반짝이는 점을 얹는다 */}
      {CAVE_POOLS.map((p, i) => (
        <group key={i}>
          <mesh position={[p.x, 0.12, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[p.r, 20]} />
            <meshStandardMaterial color="#2d6f8f" roughness={0.12} metalness={0.1} emissive="#0c2a38" transparent opacity={0.85} />
          </mesh>
          <Glints x={p.x} z={p.z} r={p.r} />
        </group>
      ))}
      {/* 광석 무리: 호박석, 자수정, 월장석 순서 */}
      {CAVE_NODES.map((n, i) => (
        <OreCluster key={i} at={n} color={ORE_COLORS[i]} depleted={depleted} />
      ))}
    </group>
  )
}
