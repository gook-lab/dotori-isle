import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { currentHour } from '../core/clock'
import { weatherFor } from '../core/weather'
import { flagSwing, windLevel } from '../core/wind'
import { todayTodos } from '../core/todo'
import { HALL_OBJECTS, HALL_ROOM, ROOM_D, ROOM_FLOOR, ROOM_W, roomCenter } from '../core/interior'
import { HALL_SITE } from '../core/hall'
import { heightAt } from '../core/island'
import { now } from '../game/runtime'
import { todoCtxOf, useGame } from '../game/store'
import { Toon } from './toon'
import { Batch, Merge, shape, useMerged, xf } from './batching'
import { useSeason } from './Island'
import { EaveDrips } from './EaveDrips'
import { WindowPane } from './WindowPane'

const WALL_H = 2.8
const INDOOR_FLOOR = '#2b1f17'
const STONE = '#c9bfa8'

/** 간판·종이에 쓸 글자판. 가로로 긴 판에 한두 줄을 가운데 맞춘다. */
function textTexture(lines: string[], bg: string, fg: string, w = 512, h = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const size = lines.length > 1 ? 44 : 64
  g.font = `bold ${size}px sans-serif`
  lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (size + 8)))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 마을회관 건물. 지붕 위에 방송 스피커와 안테나를 올리고, 정면에는 간판·차양·계단·벤치를 둔다. 정면(문)은 남쪽(+z)을 본다. */
/** 처마 네 모서리(건물 그룹 기준). 비 오는 날 여기서 빗방울이 떨어진다. */
const HALL_EAVES: [number, number, number][] = [
  [-2.25, 2.55, -1.85],
  [2.25, 2.55, -1.85],
  [-2.25, 2.55, 1.85],
  [2.25, 2.55, 1.85],
]

/** 건물의 움직이지 않는 조각(벽·띠·지붕·간판 판·차양·문·창틀·계단·벤치·화분·깃대 기둥)을 재질별로 굳힌다. */
function addHallStatic(b: Batch) {
  const box = (size: [number, number, number], p: [number, number, number], color: string, r: [number, number, number] = [0, 0, 0]) =>
    b.add(shape(THREE.BoxGeometry, ...size), xf(p, r), color, { cast: false })
  // 벽 몸체는 Part 로 그리던 것처럼 그림자를 드리우고 테두리를 두른다
  b.add(shape(THREE.BoxGeometry, 4.2, 2.6, 3.4), xf([0, 1.3, 0]), '#f1e6cf', { cast: true, outline: 0.04 })
  box([4.3, 0.24, 3.5], [0, 0.12, 0], '#8e6a47')
  for (let i = 0; i < 9; i++) box([0.46, 0.22, 0.12], [-2 + i * 0.5, 0.3, 1.74], i % 2 ? STONE : '#b9ad93')
  box([4.6, 0.14, 3.8], [0, 2.62, 0], '#a84b35')
  // 네 면 지붕: 삼각 피라미드를 돌려 짧은 기와 지붕을 만든다
  b.add(shape(THREE.ConeGeometry, 3.2, 1.7, 4), xf([0, 3.25, 0], [0, Math.PI / 4, 0], [1, 1, 0.85]), '#c4553a', { cast: false })
  box([2.4, 0.5, 0.1], [0, 2.08, 1.78], '#2f5a72')
  for (let i = 0; i < 4; i++) box([0.4, 0.06, 0.6], [-0.6 + i * 0.4, 1.6, 2.06], i % 2 ? '#f4e6c6' : '#d8604a', [-0.35, 0, 0])
  // 문틀 앞면이 벽 앞면(z 1.7)과 겹쳐 떨리지 않게 0.005 앞으로 민다
  box([1.1, 1.6, 0.08], [0, 0.95, 1.665], '#3b2716')
  box([0.9, 1.4, 0.08], [0, 0.9, 1.72], '#5a3b24')
  for (const x of [-1.3, 1.3]) {
    box([0.82, 0.82, 0.05], [x, 1.6, 1.72], '#f8f2e6')
    box([0.05, 0.7, 0.02], [x, 1.6, 1.77], '#f8f2e6')
  }
  for (let i = 0; i < 2; i++) box([1.8 - i * 0.2, 0.12, 0.34], [0, 0.06 + i * 0.1, 2.25 + i * 0.3], i ? '#d6c6a4' : '#c9b78f')
  // 현관 앞 벤치와 왼쪽 화분
  box([1.2, 0.1, 0.4], [2.0, 0.42, 2.7], '#9a6e45')
  for (const x of [-0.5, 0.5]) box([0.1, 0.2, 0.34], [2.0 + x, 0.31, 2.7], '#5a3b24')
  b.add(shape(THREE.CylinderGeometry, 0.2, 0.16, 0.26, 10), xf([-2.0, 0.32, 2.6]), '#c4553a', { cast: false })
  b.add(shape(THREE.SphereGeometry, 0.24, 8, 6), xf([-2.0, 0.62, 2.6]), '#5f9d56', { cast: false })
}

function Building() {
  const spin = useRef<THREE.Group>(null)
  const flag = useRef<THREE.Mesh>(null)
  const sign = useMemo(() => textTexture(['마을회관'], '#3e6e8a', '#fff6d6', 512, 128), [])
  useEffect(() => () => sign.dispose(), [sign])
  // 깃발은 그날 바람과 비에 따라 세기가 다르다. 날짜가 같으면 늘 같은 세기다.
  const day = useGame((s) => s.day)
  const swing = useMemo(() => flagSwing(windLevel(day), weatherFor(day) === 'rain'), [day])
  const season = useSeason()
  const still = useMerged((b) => addHallStatic(b), [])
  // 안테나 끝의 불빛과 깃발이 천천히 움직인다. 깃발은 바람·비에 맞춰 더 세게 펄럭인다.
  useFrame(() => {
    if (spin.current) spin.current.rotation.y = Math.sin(now() * 0.6) * 0.25
    if (flag.current) flag.current.rotation.y = Math.sin(now() * swing.speed) * swing.amp
  })
  return (
    <group scale={0.8}>
      <Merge g={still} />
      {/* 간판 판의 글자 */}
      <mesh position={[0, 2.08, 1.84]}>
        <planeGeometry args={[2.2, 0.42]} />
        <meshBasicMaterial map={sign} />
      </mesh>
      {/* 겨울엔 지붕 꼭대기에 눈 모자. 상점과 같은 방식으로 꼭짓점에서 0.36 내려온 짧은 뿔이다. */}
      {season === 'winter' && (
        <mesh position={[0, 3.92, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.85]}>
          <coneGeometry args={[((3.2 * 0.36) / 1.7) * 1.06, 0.36, 4]} />
          <Toon color="#f7fbff" />
        </mesh>
      )}
      {/* 처마 쪽 경사면에도 눈 띠를 두른다. 방송 장치(꼭대기)에 가리지 않는 아래쪽 면이라 보인다. 같은 원뿔의 y=-0.73~-0.43 구간을 얇은 뿔대로 덮는다. */}
      {season === 'winter' && (
        <mesh position={[0, 2.67, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.85]}>
          <cylinderGeometry args={[2.41 * 1.06, 2.974 * 1.06, 0.3, 4, 1, true]} />
          <Toon color="#f7fbff" />
        </mesh>
      )}
      {/* 창 두 개: 유리는 밤에 등불색으로 켜진다(WindowPane). 나머지 창틀은 위에서 묶었다. */}
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[x, 1.6, 1.72]}>
          <WindowPane position={[0, 0, 0.02]}>
            <boxGeometry args={[0.7, 0.7, 0.06]} />
          </WindowPane>
        </group>
      ))}
      {/* 깃대와 섬 깃발(초록 바탕에 노란 점): 앞마당 왼쪽. 깃발은 펄럭이므로 따로 둔다. */}
      <group position={[-2.7, 0, 2.6]}>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 3.4, 6]} />
          <Toon color="#e9e1cf" />
        </mesh>
        <mesh ref={flag} position={[0.45, 3.1, 0]}>
          <planeGeometry args={[0.9, 0.55]} />
          <meshToonMaterial color="#6fb36a" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.25, 3.12, 0.01]}>
          <circleGeometry args={[0.12, 12]} />
          <meshToonMaterial color="#ffd66b" />
        </mesh>
      </group>
      {/* 지붕 위 방송 장치: 스피커 상자, 나팔, 안테나 */}
      <group ref={spin} position={[0, 4.0, 0]}>
        <mesh>
          <boxGeometry args={[0.6, 0.45, 0.5]} />
          <Toon color="#3b4a5c" />
        </mesh>
        <mesh position={[0, 0, 0.36]} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.22, 0.32, 10, 1, true]} />
          <Toon color="#7f8fa3" />
        </mesh>
        <mesh position={[0.5, 0.2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.5, 6]} />
          <Toon color="#55606e" />
        </mesh>
        <mesh position={[0.5, 1.0, 0]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <Toon color="#ffd66b" emissive="#ffcf55" />
        </mesh>
      </group>
      <EaveDrips points={HALL_EAVES} />
    </group>
  )
}

/** 마을회관 바깥 자리. 광장 근처에 서고 문에서 건물 쪽을 본다. */
export function HallExterior() {
  const site = HALL_SITE
  if (!site) return null
  return (
    <group position={[site.x, heightAt(site.x, site.z), site.z]} rotation-y={site.rot}>
      <Building />
    </group>
  )
}

/** 게시판 종이: 오늘 아직 끝나지 않은 할 일 수를 적는다. 실내에 있을 때만 그려지므로 상태를 그대로 읽는다. */
function BoardNote({ x, z }: { x: number; z: number }) {
  const st = useGame()
  const left = useMemo(() => todayTodos(todoCtxOf(st)).filter((t) => !t.done && !t.later).length, [st])
  const tex = useMemo(() => textTexture([`오늘 할 일 ${left}개`], '#fff6d6', '#3f6b4c', 512, 128), [left])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={[x, 1.5, z]}>
      <planeGeometry args={[1.5, 0.38]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  )
}

/** 마이크 책상의 '방송 중' 불: 아침 소식 카드가 떠 있는 동안 켜진다. */
function OnAirLamp({ x, y, z }: { x: number; y: number; z: number }) {
  const on = useGame((s) => s.news !== null)
  return (
    <>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial color={on ? '#ff4a3d' : '#5a2a26'} />
      </mesh>
      <pointLight position={[x, y + 0.1, z]} color="#ff4a3d" intensity={on ? 1.2 : 0} distance={2.5} decay={1.6} />
    </>
  )
}

/** 벽시계: 게임 시각에 맞춰 두 바늘을 돌린다. */
function WallClock({ x, y, z }: { x: number; y: number; z: number }) {
  const hour = currentHour()
  const h = (hour % 12) / 12 * Math.PI * 2
  return (
    <group position={[x, y, z]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 20]} />
        <meshToonMaterial color="#5a3b24" />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.035]}>
        <circleGeometry args={[0.3, 20]} />
        <meshToonMaterial color="#fff9ec" />
      </mesh>
      <mesh position={[Math.sin(h) * 0.12, Math.cos(h) * 0.12, 0.05]} rotation-z={-h}>
        <boxGeometry args={[0.04, 0.22, 0.02]} />
        <meshToonMaterial color="#3b2716" />
      </mesh>
      <mesh position={[0, 0.1, 0.05]}>
        <boxGeometry args={[0.03, 0.2, 0.02]} />
        <meshToonMaterial color="#3b2716" />
      </mesh>
    </group>
  )
}

/** 화분 하나: 흙 항아리와 초록 잎 덩어리 */
function Plant({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, ROOM_FLOOR, z]} scale={s}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.24, 0.18, 0.5, 10]} />
        <meshToonMaterial color="#c4553a" />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.42, 10, 8]} />
        <meshToonMaterial color="#5f9d56" />
      </mesh>
    </group>
  )
}

/** 의자: 앉는 판과 등받이 하나. 책상 앞쪽(문 쪽)에 둔다. */
function Chair({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, ROOM_FLOOR, z]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.62, 0.1, 0.62]} />
        <meshToonMaterial color="#9a6e45" />
      </mesh>
      <mesh position={[0, 0.85, -0.28]}>
        <boxGeometry args={[0.62, 0.7, 0.08]} />
        <meshToonMaterial color="#9a6e45" />
      </mesh>
      {[
        [-0.24, -0.24],
        [0.24, -0.24],
        [-0.24, 0.24],
        [0.24, 0.24],
      ].map(([dx, dz], k) => (
        <mesh key={k} position={[dx, 0.2, dz]}>
          <boxGeometry args={[0.08, 0.4, 0.08]} />
          <meshToonMaterial color="#6b4a2e" />
        </mesh>
      ))}
    </group>
  )
}

/** 마을회관 방. 방 안에 들어가 있을 때만 그린다. 접수대·게시판·마이크 책상, 러그, 벽시계, 화분, 의자가 있다. */
export function HallInterior() {
  const inHall = useGame((s) => s.inHall)
  const night = useGame((s) => s.night)
  if (!inHall) return null
  const c = roomCenter(HALL_ROOM)
  const { reception, mic, board } = HALL_OBJECTS
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color={INDOOR_FLOOR} />
      </mesh>
      <mesh position={[0, ROOM_FLOOR - 0.1, 0]} receiveShadow>
        <boxGeometry args={[ROOM_W, 0.2, ROOM_D]} />
        <meshToonMaterial color="#b98b5a" />
      </mesh>
      {/* 러그: 가운데 바닥의 빨간 천과 연한 테두리 */}
      <mesh position={[0, ROOM_FLOOR + 0.01, 0.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3.8, 2.6]} />
        <meshToonMaterial color="#e8c9a0" />
      </mesh>
      <mesh position={[0, ROOM_FLOOR + 0.02, 0.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3.2, 2.1]} />
        <meshToonMaterial color="#c25e4a" />
      </mesh>
      {[
        { pos: [0, WALL_H / 2, -ROOM_D / 2] as const, size: [ROOM_W, WALL_H, 0.12] as const },
        { pos: [-ROOM_W / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, ROOM_D] as const },
        { pos: [ROOM_W / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, ROOM_D] as const },
      ].map((w, k) => (
        <mesh key={k} position={[...w.pos]} receiveShadow>
          <boxGeometry args={[...w.size]} />
          <meshToonMaterial color="#efe3cf" />
        </mesh>
      ))}
      {/* 벽 아랫단 나무 띠 */}
      <mesh position={[0, 0.25, -ROOM_D / 2 + 0.07]}>
        <boxGeometry args={[ROOM_W, 0.5, 0.04]} />
        <meshToonMaterial color="#b98b5a" />
      </mesh>
      {/* 접수대: 왼쪽 탁자와 뒤의 작은 선반 */}
      <mesh position={[reception.x, 0.55, reception.z]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.1, 0.9]} />
        <meshToonMaterial color="#8e6a47" />
      </mesh>
      <mesh position={[reception.x, 1.15, reception.z]}>
        <boxGeometry args={[1.9, 0.08, 1.0]} />
        <meshToonMaterial color="#c9a57a" />
      </mesh>
      <mesh position={[reception.x, 1.3, reception.z - 0.42]}>
        <boxGeometry args={[0.7, 0.14, 0.2]} />
        <meshToonMaterial color="#fff9ec" />
      </mesh>
      <Chair x={reception.x} z={reception.z + 1.1} />
      {/* 게시판: 뒷벽 코르크 판과 쪽지, 그리고 오늘 할 일 종이 */}
      <mesh position={[board.x, 1.5, -ROOM_D / 2 + 0.2]}>
        <boxGeometry args={[2.4, 1.5, 0.08]} />
        <meshToonMaterial color="#d6a867" />
      </mesh>
      {[
        [-0.7, 1.9, '#fff6d6'],
        [0.1, 1.7, '#ffe0e6'],
        [0.8, 1.95, '#e0f0ff'],
        [-0.2, 1.3, '#f6ffd6'],
      ].map(([x, y, color], k) => (
        <mesh key={k} position={[board.x + (x as number), y as number, -ROOM_D / 2 + 0.26]}>
          <boxGeometry args={[0.45, 0.32, 0.02]} />
          <meshToonMaterial color={color as string} />
        </mesh>
      ))}
      <BoardNote x={board.x} z={-ROOM_D / 2 + 0.3} />
      {/* 마이크 책상: 오른쪽 탁자, 마이크, 방송 중 불 */}
      <mesh position={[mic.x, 0.55, mic.z]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.1, 0.9]} />
        <meshToonMaterial color="#5a4a3a" />
      </mesh>
      <mesh position={[mic.x, 1.2, mic.z]}>
        <cylinderGeometry args={[0.06, 0.09, 0.22, 8]} />
        <meshToonMaterial color="#2f3640" />
      </mesh>
      <mesh position={[mic.x, 1.45, mic.z]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshToonMaterial color="#3e4a57" />
      </mesh>
      <OnAirLamp x={mic.x + 0.6} y={1.2} z={mic.z} />
      <Chair x={mic.x} z={mic.z + 1.1} />
      {/* 벽시계와 화분 두 개, 모서리 */}
      <WallClock x={-3.6} y={2.2} z={-ROOM_D / 2 + 0.08} />
      <Plant x={-3.7} z={2.8} />
      <Plant x={3.7} z={2.8} s={0.9} />
      {/* 천장 등: 따뜻한 빛 두 개 */}
      {[-2.4, 2.4].map((x) => (
        <pointLight key={x} position={[x, WALL_H - 0.3, -0.4]} color="#ffd9a0" intensity={night ? 9 : 5} distance={8} decay={1.4} />
      ))}
    </group>
  )
}
