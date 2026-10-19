import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getLayout, type DigSpot } from '../core/daily'
import type { Hole } from '../core/holes'
import { BLOOM, type Plant } from '../core/garden'
import { heightAt } from '../core/island'
import { ROCKS, type RockSpot } from '../core/world'
import { runtime, SHAKE_TIME } from '../game/runtime'
import { HITS_PER_ROCK, useGame } from '../game/store'
import { Merge, shape, useMerged, xf } from './batching'
import { glowMaterial, nightLevel } from './glow'
import { freeze, Part, Toon } from './toon'
import { crackSpots, PEBBLE_SPOTS } from './wear'

const ROCK_BRIGHT = ['#a7a9b4', '#9496a3', '#b6b8c2']
// 다 쓴 바위는 색이 조금 죽는다(같은 계열을 회색 쪽으로).
const ROCK_DULL = ['#8f929d', '#82858f', '#9a9ca6']
const _crackQ = new THREE.Quaternion()
const _crackSpin = new THREE.Quaternion()
const _crackN = new THREE.Vector3()
const _crackP = new THREE.Vector3()
const _crackM = new THREE.Matrix4()
const _unit = new THREE.Vector3(1, 1, 1)
const _Z = new THREE.Vector3(0, 0, 1)

/** 바위 본체(타원체 0.65 × (1, 0.8, 0.95), 중심 y 0.42) 표면의 금 한 줄. 면에 붙어 누운 얇은 막대다. */
function crackMatrix(phi: number, theta: number, spin: number): THREE.Matrix4 {
  const sx = Math.sin(phi) * Math.cos(theta)
  const sy = Math.cos(phi)
  const sz = Math.sin(phi) * Math.sin(theta)
  _crackP.set(0.65 * sx, 0.42 + 0.65 * 0.8 * sy, 0.65 * 0.95 * sz)
  // 타원체 법선은 축 배율의 역수로 바뀐다.
  _crackN.set(sx, sy / 0.8, sz / 0.95).normalize()
  _crackQ.setFromUnitVectors(_Z, _crackN)
  _crackSpin.setFromAxisAngle(_Z, spin)
  _crackQ.multiply(_crackSpin)
  return _crackM.compose(_crackP, _crackQ, _unit)
}

/** 바위: 맞으면 움찔 눌렸다 튕기고, 맞은 만큼 금이 가고, 많이 캘수록 조금씩 작아진다. 다 쓰면 돌 조각이 흩어진다. */
function Rock({ rock }: { rock: RockSpot }) {
  const hits = useGame((s) => s.rockHits[rock.id] ?? 0)
  const spent = hits >= HITS_PER_ROCK
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const sh = runtime.shake
    const st = sh?.id === rock.id ? sh.t : SHAKE_TIME
    const k = Math.max(0, 1 - st / SHAKE_TIME)
    const squash = 1 - Math.sin(st * 28) * 0.12 * k
    const worn = 1 - (hits / HITS_PER_ROCK) * 0.15
    ref.current.scale.set(rock.scale * worn / squash, rock.scale * worn * squash, rock.scale * worn / squash)
    ref.current.rotation.z = Math.sin(st * 40) * 0.05 * k
  })
  // 바위 세 덩이와 금·돌 조각은 한 덩어리로 굳혀 그린다(움직임은 바깥 그룹이 맡는다).
  // 맞을 때마다(또는 다 쓸 때) 이 바위 것만 다시 굳힌다.
  const g = useMerged(
    (b) => {
      const [c0, c1, c2] = spent ? ROCK_DULL : ROCK_BRIGHT
      b.add(shape(THREE.DodecahedronGeometry, 0.65, 1), xf([0, 0.42, 0], [0, 0, 0], [1, 0.8, 0.95]), c0, { outline: 0.05 })
      b.add(shape(THREE.DodecahedronGeometry, 0.32, 1), xf([0.45, 0.25, 0.25]), c1, { outline: 0.08 })
      b.add(shape(THREE.DodecahedronGeometry, 0.24, 1), xf([-0.4, 0.2, 0.3]), c2, { outline: 0.08 })
      for (const c of crackSpots(hits))
        b.add(shape(THREE.BoxGeometry, 0.035, c.len, 0.012), crackMatrix(c.phi, c.theta, c.spin), '#3d3f4a', { outline: 0, cast: false })
      if (spent)
        for (const p of PEBBLE_SPOTS)
          b.add(shape(THREE.DodecahedronGeometry, p.s, 0), xf([Math.cos(p.a) * p.d, p.s * 0.5, Math.sin(p.a) * p.d], [0, p.a, 0]), '#8a8d98', { outline: 0.08 })
    },
    [hits, spent],
  )
  return (
    <group position={[rock.x, heightAt(rock.x, rock.z), rock.z]}>
      <group ref={ref}>
        <Merge g={g} />
      </group>
    </group>
  )
}

export function Rocks() {
  return (
    <>
      {ROCKS.map((r) => (
        <Rock key={r.id} rock={r} />
      ))}
    </>
  )
}

/** 땅속 보물 자리: 바닥의 X 모양 금과 반짝이 */
function Dig({ spot }: { spot: DigSpot }) {
  const star = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Sprite>(null)
  const phase = spot.x * 1.7
  const glow = useMemo(() => glowMaterial('#fff0a0'), [])
  useFrame(({ clock }) => {
    if (!star.current || !halo.current) return
    const t = clock.elapsedTime + phase
    const tw = Math.max(0, Math.sin(t * 2.5))
    // 밤엔 반짝이를 키우고 빛 번짐을 얹어야 어두운 땅에서도 보인다. 낮엔 예전 크기 그대로.
    const night = nightLevel()
    star.current.scale.setScalar((0.04 + tw * 0.1) * (1 + night * 0.5))
    star.current.rotation.y = t * 2
    halo.current.visible = night > 0.02
    halo.current.scale.setScalar(1.1 + tw * 0.5)
    glow.opacity = night * 0.9
  })
  const y = heightAt(spot.x, spot.z)
  return (
    <group position={[spot.x, y + 0.03, spot.z]}>
      {[Math.PI / 4, -Math.PI / 4].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, r]}>
          <planeGeometry args={[0.5, 0.08]} />
          <meshBasicMaterial color="#6b4528" transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={star} position={[0, 0.35, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#fff3b0" />
      </mesh>
      <sprite ref={halo} position={[0, 0.35, 0]} material={glow} visible={false} />
    </group>
  )
}

/** 판 자리에 남는 구멍과 흙더미. 삽으로 판 땅은 메우기 전까지 이 모양으로 남는다. */
function HoleMark({ spot }: { spot: { x: number; z: number } }) {
  const y = heightAt(spot.x, spot.z)
  return (
    <group ref={freeze} position={[spot.x, y + 0.02, spot.z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.38, 18]} />
        <meshBasicMaterial color="#3e2a1a" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3
        return (
          <Part key={i} color="#9b6a45" position={[Math.cos(a) * 0.5, 0.04, Math.sin(a) * 0.5]} scale={[1, 0.45, 1]} outline={0}>
            <sphereGeometry args={[0.13, 10, 6]} />
          </Part>
        )
      })}
    </group>
  )
}

export function DigSpots() {
  const day = useGame((s) => s.day)
  const dug = useGame((s) => s.dug)
  const holes: Hole[] = useGame((s) => s.holes)
  // 아직 안 판 보물 자리만 반짝인다. 판 자리는 구멍으로 남아 holes 목록이 그린다.
  const digs = getLayout(day).digs.filter((d) => !dug.includes(d.id))
  return (
    <>
      {digs.map((d) => (
        <Dig key={d.id} spot={d} />
      ))}
      {holes.map((h) => (
        <HoleMark key={h.id} spot={h} />
      ))}
    </>
  )
}

/** 자라는 단계마다 모양이 바뀌는 꽃. 물 준 날은 흙이 촉촉하게 진해진다. */
function Flower({ plant }: { plant: Plant }) {
  const ref = useRef<THREE.Group>(null)
  const phase = plant.x * 0.7 + plant.z
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.z = Math.sin(t * 1.6 + phase) * 0.08
    ref.current.rotation.x = Math.sin(t * 1.3 + phase * 2) * 0.05
  })
  const y = heightAt(plant.x, plant.z)
  const s = plant.stage
  return (
    <group position={[plant.x, y, plant.z]}>
      <mesh position={[0, 0.02, 0]} scale={[1, 0.25, 1]}>
        <sphereGeometry args={[0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color={plant.watered ? '#6b4528' : '#9b6a45'} />
      </mesh>
      <group ref={ref}>
        {s >= 1 && (
          <Part color="#5fb75e" position={[0, s >= 2 ? 0.22 : 0.1, 0]} outline={0.12}>
            <cylinderGeometry args={[0.025, 0.03, s >= 2 ? 0.44 : 0.2, 5]} />
          </Part>
        )}
        {s >= 1 &&
          [-1, 1].map((d) => (
            <Part key={d} color="#7ccf6e" position={[d * 0.09, 0.12, 0]} rotation={[0, 0, -d * 0.9]} scale={[1, 0.35, 0.6]} outline={0.1}>
              <sphereGeometry args={[0.1, 8, 6]} />
            </Part>
          ))}
        {s === 2 && (
          <Part color={plant.color} position={[0, 0.48, 0]} scale={[0.8, 1.1, 0.8]} outline={0.1}>
            <sphereGeometry args={[0.09, 10, 8]} />
          </Part>
        )}
        {s >= BLOOM && (
          <group position={[0, 0.48, 0]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Part key={i} color={plant.color} position={[Math.cos((i / 5) * Math.PI * 2) * 0.11, 0, Math.sin((i / 5) * Math.PI * 2) * 0.11]} outline={0.1}>
                <sphereGeometry args={[0.085, 10, 8]} />
              </Part>
            ))}
            <Part color="#ffd166" position={[0, 0.03, 0]} outline={0.12}>
              <sphereGeometry args={[0.065, 10, 8]} />
            </Part>
          </group>
        )}
      </group>
    </group>
  )
}

export function Garden() {
  const plants = useGame((s) => s.plants)
  return (
    <>
      {plants.map((p) => (
        <Flower key={p.id} plant={p} />
      ))}
    </>
  )
}
