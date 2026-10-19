import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime, type Burst } from '../game/runtime'

const CAP = 400

interface Preset {
  count: number
  colors: string[]
  speed: [number, number]
  up: [number, number]
  gravity: number
  life: [number, number]
  size: [number, number]
  /** dir 쪽으로만 퍼지는 각도 폭. 없으면 사방 */
  cone?: number
  /** 떨어지며 좌우로 살랑이는 정도(나뭇잎) */
  flutter?: number
  /** 납작한 잎 조각으로 그린다. 뒤집히며 떨어진다. */
  leaf?: boolean
}

const PRESETS: Record<Burst['kind'], Preset> = {
  dirt: { count: 12, colors: ['#9b6a45', '#b8865a', '#7a5233'], speed: [0.8, 2], up: [2, 3.5], gravity: 9, life: [0.5, 0.8], size: [0.06, 0.12] },
  sparks: { count: 10, colors: ['#fff3b0', '#ffd166', '#ffffff'], speed: [2, 4], up: [1, 3], gravity: 6, life: [0.25, 0.45], size: [0.04, 0.07] },
  chips: { count: 9, colors: ['#e0b07a', '#c98b55'], speed: [1.2, 2.6], up: [2, 3.5], gravity: 9, life: [0.5, 0.8], size: [0.05, 0.09] },
  leaves: { count: 14, colors: ['#6cc26a', '#80d379', '#5fb75e'], speed: [0.6, 1.6], up: [0.2, 1], gravity: 1.2, life: [1.2, 1.8], size: [0.06, 0.1], flutter: 2 },
  // 낙엽더미를 차면 단풍 색 잎 조각이 팔랑이며 흩어진다
  foliage: { count: 12, colors: ['#e0883a', '#d9482b', '#f0c24a', '#c96a2e', '#8a5a2b'], speed: [0.5, 1.5], up: [1.2, 2.4], gravity: 2.2, life: [1.1, 1.8], size: [0.11, 0.16], flutter: 2.5, leaf: true },
  water: { count: 4, colors: ['#9ddcf0', '#c9eefa'], speed: [1.6, 2.2], up: [0.2, 0.6], gravity: 7, life: [0.35, 0.5], size: [0.04, 0.06], cone: 0.35 },
  splash: { count: 16, colors: ['#c9eefa', '#ffffff', '#9ddcf0'], speed: [0.6, 1.8], up: [2, 3.6], gravity: 10, life: [0.35, 0.6], size: [0.04, 0.09] },
  puff: { count: 3, colors: ['#efe2c6', '#e2d2b0'], speed: [0.3, 0.7], up: [0.3, 0.7], gravity: 0.6, life: [0.35, 0.55], size: [0.07, 0.12] },
  // 생일 주민 머리 위의 색종이. 위로 조금만 솟고 천천히 내려앉도록 좁게 흩어 보이게 한다.
  party: { count: 36, colors: ['#ff8fa3', '#ffd166', '#7ee081', '#9ad0ec', '#c77dff'], speed: [0.4, 1.1], up: [1.2, 2.2], gravity: 2.2, life: [1.4, 2.2], size: [0.1, 0.15], flutter: 2.5 },
  confetti: { count: 50, colors: ['#ff8fa3', '#ffd166', '#7ee081', '#9ad0ec', '#c77dff'], speed: [1.5, 4], up: [2, 5], gravity: 3.5, life: [1.2, 2], size: [0.06, 0.1], flutter: 3 },
  // 찌가 떨어진 뒤 작은 물방울이 톡톡 튀어 오른다
  spray: { count: 10, colors: ['#e6f8ff', '#ffffff', '#9ddcf0'], speed: [0.8, 2], up: [2.6, 4.2], gravity: 11, life: [0.4, 0.7], size: [0.03, 0.05] },
  // 먹고 나서 하트 하나가 떠오른다
  heart: { count: 1, colors: ['#ff6b8b'], speed: [0.05, 0.12], up: [0.9, 1.2], gravity: -0.3, life: [0.9, 1.2], size: [0.13, 0.15] },
  // 마을 방송 차임 때 스피커에서 작은 음표가 천천히 떠오른다
  note: { count: 5, colors: ['#ffd66b', '#9ad0ec', '#c77dff'], speed: [0.05, 0.25], up: [0.5, 0.9], gravity: -0.15, life: [1.3, 1.8], size: [0.09, 0.13] },
  dust: { count: 20, colors: ['#fff6e0', '#f2e3c4'], speed: [2, 3.5], up: [0.2, 0.8], gravity: 0.5, life: [0.6, 1], size: [0.12, 0.22] },
}

const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a)

/** 모든 효과 파티클을 InstancedMesh 하나로 그린다. runtime.bursts 에 쌓인 요청을 매 프레임 꺼내 쓴다. */
export function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const pool = useMemo(
    () => ({
      pos: new Float32Array(CAP * 3),
      vel: new Float32Array(CAP * 3),
      age: new Float32Array(CAP).fill(1),
      life: new Float32Array(CAP).fill(1),
      size: new Float32Array(CAP),
      flutter: new Float32Array(CAP),
      leaf: new Float32Array(CAP),
      gravity: new Float32Array(CAP),
      next: 0,
    }),
    [],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const euler = useMemo(() => new THREE.Euler(), [])
  const vec = useMemo(() => new THREE.Vector3(), [])
  const flatScale = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    const im = mesh.current
    if (!im) return
    m4.makeScale(0, 0, 0)
    for (let i = 0; i < CAP; i++) {
      im.setMatrixAt(i, m4)
      im.setColorAt(i, color.set('#ffffff'))
    }
  }, [m4, color])

  useFrame((_, delta) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(delta, 0.05)

    for (const b of runtime.bursts.splice(0)) {
      const pr = PRESETS[b.kind]
      for (let n = 0; n < pr.count; n++) {
        const i = pool.next
        pool.next = (i + 1) % CAP
        const cone = b.cone ?? pr.cone
        const a = cone !== undefined && b.dir !== undefined ? b.dir + (Math.random() - 0.5) * cone : Math.random() * Math.PI * 2
        const sp = rand(pr.speed) * (b.reach ?? 1)
        pool.pos.set([b.x, b.y, b.z], i * 3)
        pool.vel.set([Math.sin(a) * sp, rand(pr.up), Math.cos(a) * sp], i * 3)
        pool.age[i] = 0
        pool.life[i] = rand(pr.life)
        pool.size[i] = rand(pr.size)
        pool.flutter[i] = pr.flutter ?? 0
        pool.leaf[i] = pr.leaf ? 1 : 0
        pool.gravity[i] = pr.gravity
        im.setColorAt(i, color.set(pr.colors[Math.floor(Math.random() * pr.colors.length)]))
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }

    for (let i = 0; i < CAP; i++) {
      if (pool.age[i] >= pool.life[i]) continue
      pool.age[i] += dt
      const k = pool.age[i] / pool.life[i]
      const j = i * 3
      pool.vel[j + 1] -= pool.gravity[i] * dt
      if (pool.flutter[i]) {
        // 나뭇잎·색종이는 공기 저항을 받아 느리게 떨어지며 좌우로 흔들린다.
        pool.vel[j] *= 1 - dt * 1.5
        pool.vel[j + 2] *= 1 - dt * 1.5
        pool.pos[j] += Math.sin(pool.age[i] * 6 + i) * pool.flutter[i] * dt * 0.5
      }
      pool.pos[j] += pool.vel[j] * dt
      pool.pos[j + 1] = Math.max(0.02, pool.pos[j + 1] + pool.vel[j + 1] * dt)
      pool.pos[j + 2] += pool.vel[j + 2] * dt
      const sc = k >= 1 ? 0 : pool.size[i] * (k < 0.15 ? k / 0.15 : 1 - Math.max(0, k - 0.6) / 0.4)
      if (pool.leaf[i]) {
        // 잎 조각은 납작한 채로 뒤집히며 떨어진다
        const age = pool.age[i]
        quat.setFromEuler(euler.set(age * 3 + i, i * 0.7, age * 2))
        m4.compose(vec.set(pool.pos[j], pool.pos[j + 1], pool.pos[j + 2]), quat, flatScale.set(sc * 1.5, sc * 0.16, sc * 1.1))
      } else m4.makeScale(sc, sc, sc).setPosition(pool.pos[j], pool.pos[j + 1], pool.pos[j + 2])
      im.setMatrixAt(i, m4)
    }
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CAP]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial />
    </instancedMesh>
  )
}
