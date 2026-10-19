import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { MARKET_SITE } from '../core/market'
import { PIER_DECK, PIER_LEN } from '../core/waters'
import { DOCKS, MAILBOX, STALL, WORKBENCH, type Dock } from '../core/world'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { Merge, mul, shape, useMerged, xf } from './batching'
import { designLayers } from './designPixels'
import { SongiMerchant } from './SongiMerchant'
import { freeze, Part } from './toon'

/** 바다로 뻗은 나무 잔교. 판자는 한 덩어리(인스턴스)로 그리고, 바다 위 기둥은 따로 세운다. */
function Pier({ dock }: { dock: Dock }) {
  const n = Math.ceil((PIER_LEN - 0.6) / 0.42)
  const planks = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      m.makeTranslation(0, PIER_DECK, 0.6 + i * 0.42)
      planks.current?.setMatrixAt(i, m)
      planks.current?.setColorAt(i, c.set(i % 2 ? '#c98b55' : '#b97d4a'))
    }
    if (planks.current) {
      planks.current.instanceMatrix.needsUpdate = true
      if (planks.current.instanceColor) planks.current.instanceColor.needsUpdate = true
    }
  }, [n])
  // 기둥: 육지 쪽 셋은 땅에, 바다 쪽 둘은 물속 깊이 박는다
  const piles = [
    ...[1.2, 2.6, 4].map((z) => ({ z, y: -0.1, h: 1.2 })),
    ...[6.5, 9].map((z) => ({ z, y: -1.0, h: 2.6 })),
  ]
  return (
    // 그룹의 +z 가 바다 쪽을 향하도록 돌린다.
    <group ref={freeze} position={[dock.x, 0, dock.z]} rotation-y={Math.PI / 2 - dock.angle}>
      <instancedMesh ref={planks} args={[undefined, undefined, n]}>
        <boxGeometry args={[1.5, 0.08, 0.38]} />
        <meshToonMaterial />
      </instancedMesh>
      {piles.map(({ z, y, h }) =>
        [-0.7, 0.7].map((x) => (
          <Part key={`${x}${z}`} color="#8a5a3b" position={[x, y, z]} outline={0.1}>
            <cylinderGeometry args={[0.07, 0.07, h, 6]} />
          </Part>
        )),
      )}
    </group>
  )
}

/** 펠리컨 뱃사공 펠리. 플레이어가 가까이 오면 돌아보고, 말할 때는 부리를 벌린다. */
function Pelican({ dock }: { dock: Dock }) {
  const root = useRef<THREE.Group>(null)
  const beak = useRef<THREE.Group>(null)
  const wingL = useRef<THREE.Group>(null)
  const wingR = useRef<THREE.Group>(null)
  const y = heightAt(dock.x, dock.z)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const p = runtime.player
    const near = Math.hypot(p.x - dock.x, p.z - dock.z) < 6
    const talking = useGame.getState().dialog?.villagerId === 'pelican' && near
    if (root.current) {
      const want = near ? Math.atan2(p.x - dock.x, p.z - dock.z) : Math.PI / 2 - dock.angle + Math.PI
      const cur = root.current.rotation.y
      root.current.rotation.y = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * 0.08
      root.current.position.y = y + Math.abs(Math.sin(t * (talking ? 6 : 1.6))) * (talking ? 0.06 : 0.03)
    }
    if (beak.current) beak.current.rotation.x = talking ? 0.15 + Math.abs(Math.sin(t * 12)) * 0.35 : 0.05
    // 가끔 날개를 퍼덕인다.
    const flap = Math.sin(t * 0.7 + dock.x) > 0.93 ? Math.sin(t * 25) * 0.6 : 0
    if (wingL.current) wingL.current.rotation.z = 0.15 + flap
    if (wingR.current) wingR.current.rotation.z = -0.15 - flap
  })
  return (
    <group ref={root} position={[dock.x, y, dock.z]}>
      <Part color="#f7f4ee" position={[0, 0.65, 0]} scale={[1, 1.15, 1.1]}>
        <sphereGeometry args={[0.42, 20, 16]} />
      </Part>
      <Part color="#f7f4ee" position={[0, 1.3, 0.12]}>
        <sphereGeometry args={[0.3, 18, 14]} />
      </Part>
      {/* 선원 모자 */}
      <Part color="#3f6fb5" position={[0, 1.55, 0.08]} outline={0.05}>
        <cylinderGeometry args={[0.2, 0.24, 0.16, 16]} />
      </Part>
      <Part color="#ffffff" position={[0, 1.47, 0.08]} outline={0.04}>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 18]} />
      </Part>
      {/* 큰 부리와 주머니 */}
      <group ref={beak} position={[0, 1.24, 0.36]}>
        <Part color="#f5a623" position={[0, 0.02, 0.32]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.45]} outline={0.06}>
          <coneGeometry args={[0.11, 0.7, 10]} />
        </Part>
      </group>
      <Part color="#ffc66b" position={[0, 1.1, 0.55]} scale={[0.8, 0.7, 1.4]} outline={0.06}>
        <sphereGeometry args={[0.17, 14, 10]} />
      </Part>
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 1.38, 0.36]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshBasicMaterial color="#2b2018" />
        </mesh>
      ))}
      <group ref={wingL} position={[-0.38, 0.85, 0]}>
        <Part color="#e9e4da" position={[-0.05, -0.15, 0]} scale={[0.35, 1, 0.8]}>
          <sphereGeometry args={[0.3, 12, 10]} />
        </Part>
      </group>
      <group ref={wingR} position={[0.38, 0.85, 0]}>
        <Part color="#e9e4da" position={[0.05, -0.15, 0]} scale={[0.35, 1, 0.8]}>
          <sphereGeometry args={[0.3, 12, 10]} />
        </Part>
      </group>
      {[-0.15, 0.15].map((x) => (
        <Part key={x} color="#f5a623" position={[x, 0.12, 0.1]} scale={[1, 0.3, 1.4]} outline={0.1}>
          <sphereGeometry args={[0.1, 8, 6]} />
        </Part>
      ))}
    </group>
  )
}

/** 작업대: 나무 탁자 위에 망치와 톱. 움직이지 않아 한 덩어리로 굳힌다. */
function Workbench() {
  const y = heightAt(WORKBENCH.x, WORKBENCH.z)
  const g = useMerged((b) => {
    const box = (w: number, h: number, d: number) => shape(THREE.BoxGeometry, w, h, d)
    const cyl = (rt: number, rb: number, h: number, seg: number) => shape(THREE.CylinderGeometry, rt, rb, h, seg)
    b.add(box(1.5, 0.14, 0.8), xf([0, 0.7, 0]), '#c98b55', { outline: 0.04 })
    for (const [x, z] of [
      [-0.62, -0.3],
      [0.62, -0.3],
      [-0.62, 0.3],
      [0.62, 0.3],
    ])
      b.add(box(0.12, 0.64, 0.12), xf([x, 0.32, z]), '#a8744a', { outline: 0.08 })
    // 망치
    const hammer = xf([-0.3, 0.8, 0.05], [0, 0.5, Math.PI / 2])
    b.add(cyl(0.025, 0.025, 0.45, 6), hammer, '#b07a45', { outline: 0.12 })
    b.add(box(0.1, 0.08, 0.2), mul(hammer, xf([0, 0.24, 0])), '#8d97a5', { outline: 0.1 })
    // 톱: 날은 그림자·테두리 없이, 이빨만 테두리를 둔다.
    const saw = xf([0.35, 0.79, -0.05], [-Math.PI / 2, 0, 0.3])
    b.add(box(0.5, 0.18, 0.015), saw, '#c9d2dc', { cast: false })
    b.add(box(0.14, 0.12, 0.05), mul(saw, xf([-0.3, 0, 0])), '#e46a52', { outline: 0.1 })
    // 판자 더미
    b.add(box(0.9, 0.08, 0.25), xf([0.1, 0.12, 0.55], [0, 0.2, 0]), '#e0b07a', { outline: 0.06 })
  }, [])
  return (
    <group position={[WORKBENCH.x, y, WORKBENCH.z]} rotation-y={-0.3}>
      <Merge g={g} />
    </group>
  )
}

/** 옷 가판대: 줄무늬 차양 아래 옷걸이와 모자 받침. 움직이지 않아 한 덩어리로 굳힌다. */
function Stall() {
  const y = heightAt(STALL.x, STALL.z)
  const g = useMerged((b) => {
    const shirts = ['#f0758a', '#7cc576', '#f5d25a', '#b49ae6']
    const box = (w: number, h: number, d: number) => shape(THREE.BoxGeometry, w, h, d)
    const cyl = (rt: number, rb: number, h: number, seg: number) => shape(THREE.CylinderGeometry, rt, rb, h, seg)
    for (const x of [-0.85, 0.85]) b.add(cyl(0.05, 0.05, 1.9, 6), xf([x, 0.95, -0.25]), '#a8744a', { outline: 0.08 })
    // 차양
    for (const [i, x] of [-0.75, -0.25, 0.25, 0.75].entries()) b.add(box(0.5, 0.06, 0.9), xf([x, 1.95, 0.05], [0.45, 0, 0]), i % 2 ? '#fdf6e3' : '#ff9fb5', { cast: false })
    // 옷걸이 봉과 셔츠
    b.add(cyl(0.025, 0.025, 1.7, 6), xf([0, 1.45, -0.25], [0, 0, Math.PI / 2]), '#8d97a5', { outline: 0.1 })
    shirts.forEach((c, i) => {
      const at = xf([-0.6 + i * 0.4, 1.12, -0.25], [0, 0.15 * (i - 1.5), 0])
      b.add(box(0.3, 0.42, 0.3), mul(at, xf([0, 0, 0], [0, 0, 0], [1, 1.1, 0.35])), c, { outline: 0.06 })
      for (const sd of [-1, 1]) b.add(box(0.12, 0.18, 0.1), mul(at, xf([sd * 0.2, 0.12, 0], [0, 0, sd * 0.6])), c, { outline: 0.08 })
    })
    // 모자 받침 위 밀짚모자
    b.add(cyl(0.06, 0.12, 0.8, 8), xf([0.95, 0.4, 0.45]), '#c98b55', { outline: 0.08 })
    const hat = xf([0.95, 0.82, 0.45])
    b.add(cyl(0.36, 0.38, 0.03, 20), hat, '#f2d38a', { outline: 0.05 })
    b.add(cyl(0.18, 0.2, 0.16, 16), mul(hat, xf([0, 0.09, 0])), '#f2d38a', { outline: 0.06 })
  }, [])
  return (
    <group position={[STALL.x, y, STALL.z]} rotation-y={0.3}>
      <Merge g={g} />
    </group>
  )
}

/** 내 우체통. 안 읽은 편지가 있으면 빨간 깃발이 올라가고 통이 들썩인다. */
function Mailbox() {
  const unread = useGame((s) => s.letters.some((l) => !l.read))
  const flag = useRef<THREE.Group>(null)
  const box = useRef<THREE.Group>(null)
  const y = heightAt(MAILBOX.x, MAILBOX.z)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (flag.current) flag.current.rotation.z += ((unread ? 0 : -Math.PI / 2) - flag.current.rotation.z) * 0.1
    if (box.current) box.current.position.y = 0.95 + (unread && Math.sin(t * 3) > 0.85 ? Math.abs(Math.sin(t * 30)) * 0.04 : 0)
  })
  return (
    <group position={[MAILBOX.x, y, MAILBOX.z]} rotation-y={-0.4}>
      <Part color="#a8744a" position={[0, 0.42, 0]} outline={0.1}>
        <boxGeometry args={[0.1, 0.84, 0.1]} />
      </Part>
      <group ref={box} position={[0, 0.95, 0]}>
        <Part color="#5fa35f" scale={[1, 1, 1.4]} outline={0.06}>
          <boxGeometry args={[0.36, 0.3, 0.36]} />
        </Part>
        <Part color="#5fa35f" position={[0, 0.15, 0]} rotation-x={Math.PI / 2} scale={[1, 1.4, 1]} outline={0.06}>
          <cylinderGeometry args={[0.18, 0.18, 0.36, 14, 1, false, 0, Math.PI]} />
        </Part>
        <group ref={flag} position={[0.2, 0.05, -0.1]}>
          <Part color="#8d97a5" position={[0, 0.17, 0]} outline={0.1}>
            <boxGeometry args={[0.03, 0.34, 0.03]} />
          </Part>
          <Part color="#e2412f" position={[0, 0.3, 0.07]} outline={0.1}>
            <boxGeometry args={[0.03, 0.1, 0.14]} />
          </Part>
        </group>
      </group>
    </group>
  )
}

/** 광장 깃발이 장터 자리에서 떨어져 서는 곳 */
const FLAG_OFFSET = { x: 2.4, z: -2.4 }
/** 디자인이 없을 때의 빨간 깃발 천 */
const FLAG_PLANE = new THREE.PlaneGeometry(0.92, 0.62)

/** 광장 깃발: 마이 디자인을 달면 그림이, 아니면 빨간 깃발이 바람에 흔들린다. 장터가 없는 섬에는 서지 않는다. */
function PlazaFlag() {
  const cells = useGame((s) => (s.flagDesign ? s.designs.find((d) => d.id === s.flagDesign)?.cells : undefined))
  const layers = useMemo(() => (cells ? designLayers(cells, 0.92, 0.62) : null), [cells])
  const cloth = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (cloth.current) cloth.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.12
  })
  if (!MARKET_SITE) return null
  const x = MARKET_SITE.x + FLAG_OFFSET.x
  const z = MARKET_SITE.z + FLAG_OFFSET.z
  return (
    <group position={[x, heightAt(x, z), z]}>
      <Part color="#8d97a5" position={[0, 1.1, 0]} outline={0.1}>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 8]} />
      </Part>
      <group ref={cloth} position={[0.03, 1.8, 0]}>
        {layers ? (
          <group position={[0.46, 0, 0]}>
            {layers.map((l) => (
              <mesh key={l.color} geometry={l.geo}>
                <meshBasicMaterial color={l.color} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh position={[0.46, 0, 0]} geometry={FLAG_PLANE}>
            <meshBasicMaterial color="#e2412f" side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  )
}

export function Landmarks() {
  return (
    <>
      {DOCKS.map((d) => (
        <group key={d.id}>
          <Pier dock={d} />
          <Pelican dock={d} />
        </group>
      ))}
      <Workbench />
      <Stall />
      <Mailbox />
      <PlazaFlag />
      <SongiMerchant />
    </>
  )
}
