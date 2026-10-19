import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hashString, mulberry32 } from '../core/rng'
import { heightAt } from '../core/island'
import { festivalOn, FIREWORK_BENCH, HOST_OFFSET, SUMMER_LANTERNS, type Festival } from '../core/festivals'
import { MARKET_SITE } from '../core/market'
import { SEASON_INFO } from '../core/season'
import { play } from '../game/sfx'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { FurnitureModel } from './Furniture'
import { Part } from './toon'

/**
 * 축제 날 광장 장식과 불꽃. 광장은 장터 자리(MARKET_SITE)를 쓴다.
 * 기둥 네 개 사이에 색 깃발 줄과 등불을 달고, 가운데 진행 천막과 계절 소품을 놓는다.
 * 여름 밤에는 폭죽이 올라가 터진다. 축제가 아니면 아무것도 그리지 않는다.
 */
export function FestivalScene() {
  const day = useGame((s) => s.day)
  const fest = festivalOn(day)
  if (!MARKET_SITE || !fest) return null
  const { x, z } = MARKET_SITE
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]}>
      <PlazaDecor fest={fest} />
      <HostStand fest={fest} />
      <SeasonProps fest={fest} />
      {fest.season === 'summer' && <Fireworks />}
    </group>
  )
}

const POLE = [
  [-2.6, -2.2],
  [2.6, -2.2],
  [2.6, 2.2],
  [-2.6, 2.2],
] as const
const BUNTING = ['#ff8fa3', '#ffe066', '#9ad0ec', '#b8e986', '#f2a541', '#c9a8ff']
const LANTERN_N = 12
const FLAGS_PER_EDGE = 6

/** 사각형 둘레 위 0~1 지점. 네 기둥을 잇는다. */
function edgePoint(t: number): [number, number] {
  const seg = t * 4
  const i = Math.min(3, Math.floor(seg))
  const f = seg - i
  const a = POLE[i]
  const b = POLE[(i + 1) % 4]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** 기둥, 깃발 줄(색 깃발은 인스턴스 하나로 묶는다), 등불 줄. 밤에는 등불이 밝아진다. */
function PlazaDecor({ fest }: { fest: Festival }) {
  const flags = useRef<THREE.InstancedMesh>(null)
  const lanterns = useRef<THREE.InstancedMesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const night = useGame((s) => s.night)
  const glow = SEASON_INFO[fest.season].flowers[0]
  const setup = useRef(false)
  const flagSpots = useMemo(() => {
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = []
    for (let e = 0; e < 4; e++) {
      const [x, z] = POLE[e]
      const [x2, z2] = POLE[(e + 1) % 4]
      const ang = Math.atan2(-(z2 - z), x2 - x)
      for (let k = 0; k < FLAGS_PER_EDGE; k++) {
        const t = (e + (k + 1) / (FLAGS_PER_EDGE + 1)) / 4
        const [px, pz] = edgePoint(t)
        const m = new THREE.Matrix4().compose(new THREE.Vector3(px, 2.02, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1))
        out.push({ m, c: new THREE.Color(BUNTING[(e * FLAGS_PER_EDGE + k) % BUNTING.length]) })
      }
    }
    return out
  }, [])
  const lanternSpots = useMemo(() => {
    const out: THREE.Matrix4[] = []
    for (let i = 0; i < LANTERN_N; i++) {
      const [x, z] = edgePoint(i / LANTERN_N)
      out.push(new THREE.Matrix4().makeTranslation(x, 2.1 - Math.sin((i / LANTERN_N) * Math.PI * 4) * 0.1, z))
    }
    return out
  }, [])
  useFrame(() => {
    if (setup.current) return
    const f = flags.current
    const l = lanterns.current
    if (!f || !l) return
    flagSpots.forEach((s, i) => {
      f.setMatrixAt(i, s.m)
      f.setColorAt(i, s.c)
    })
    lanternSpots.forEach((m, i) => l.setMatrixAt(i, m))
    f.instanceMatrix.needsUpdate = true
    if (f.instanceColor) f.instanceColor.needsUpdate = true
    l.instanceMatrix.needsUpdate = true
    setup.current = true
  })
  useFrame(() => {
    const lt = light.current
    if (lt) lt.intensity = night ? 3 : 0
  })
  return (
    <>
      {POLE.map(([x, z], i) => (
        <Part key={i} color="#8c5a3c" position={[x, 1.2, z]} outline={0.06}>
          <cylinderGeometry args={[0.07, 0.08, 2.4, 6]} />
        </Part>
      ))}
      {POLE.map(([x, z], i) => {
        const [x2, z2] = POLE[(i + 1) % 4]
        const len = Math.hypot(x2 - x, z2 - z)
        const ang = Math.atan2(x2 - x, z2 - z)
        return (
          <group key={`string-${i}`} position={[(x + x2) / 2, 2.2, (z + z2) / 2]} rotation-y={ang}>
            <Part color="#6b4a2b" outline={0.03}>
              <boxGeometry args={[0.03, 0.03, len]} />
            </Part>
          </group>
        )
      })}
      <instancedMesh ref={flags} args={[undefined, undefined, POLE.length * FLAGS_PER_EDGE]} frustumCulled={false}>
        <boxGeometry args={[0.24, 0.3, 0.02]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={lanterns} args={[undefined, undefined, LANTERN_N]} frustumCulled={false}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshBasicMaterial color={night ? '#ffcf7a' : glow} />
      </instancedMesh>
      <pointLight ref={light} position={[0, 2.6, 0]} color="#ffd9a0" intensity={0} distance={10} decay={1.5} />
    </>
  )
}

/** 가운데 진행 천막. 계절 색 천을 두른 나무 좌판에 과일이나 꽃을 얹고, 위에 축제 간판을 단다. */
function HostStand({ fest }: { fest: Festival }) {
  const cloth = SEASON_INFO[fest.season].leaves[0]
  const top = fest.season === 'autumn' ? ['#f29b4b', '#e8673e', '#f7b955'] : ['#ff8fa3', '#ffe066', '#ffffff']
  return (
    <group position={[HOST_OFFSET.x, 0, HOST_OFFSET.z]}>
      <Part color="#b9864f" position={[0, 0.5, 0]} outline={0.05}>
        <boxGeometry args={[1.5, 0.1, 0.8]} />
      </Part>
      {[-0.65, 0.65].map((x) =>
        [-0.32, 0.32].map((z) => (
          <Part key={`${x}${z}`} color="#8c5a3c" position={[x, 0.25, z]} outline={0.04}>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
          </Part>
        )),
      )}
      <Part color={cloth} position={[0, 0.3, 0.38]} outline={0.04}>
        <boxGeometry args={[1.5, 0.38, 0.04]} />
      </Part>
      {top.map((c, i) => (
        <Part key={i} color={c} position={[-0.4 + i * 0.4, 0.6, 0]} outline={0.03}>
          <sphereGeometry args={[0.1, 8, 6]} />
        </Part>
      ))}
      <Part color="#fff6e0" position={[0, 1.4, 0]} outline={0.05}>
        <boxGeometry args={[1.2, 0.36, 0.06]} />
      </Part>
      <Part color={cloth} position={[0, 1.4, 0.04]} outline={0.02}>
        <boxGeometry args={[1.05, 0.22, 0.02]} />
      </Part>
      {/* 불꽃 구경 벤치: 천막 뒤에서 광장을 본다. E 로 앉는다. */}
      <group position={[0, 0, FIREWORK_BENCH.z - HOST_OFFSET.z]}>
        <Part color="#b9864f" position={[0, 0.42, 0]} outline={0.05}>
          <boxGeometry args={[1.4, 0.1, 0.42]} />
        </Part>
        {[-0.6, 0.6].map((x) => (
          <Part key={x} color="#8c5a3c" position={[x, 0.2, 0]} outline={0.03}>
            <boxGeometry args={[0.08, 0.4, 0.36]} />
          </Part>
        ))}
      </group>
    </group>
  )
}

/** 계절 소품: 봄 꽃 아치, 여름 종이 등불, 가을 허수아비와 과일 상자, 겨울 얼음 조각. 축제 전용 가구 모델을 그대로 쓴다. */
function SeasonProps({ fest }: { fest: Festival }) {
  const night = useGame((s) => s.night)
  if (fest.season === 'spring')
    return (
      <group position={[0, 0, 2.3]}>
        <FurnitureModel itemId="blossom-arch" night={night} />
      </group>
    )
  if (fest.season === 'summer')
    return (
      <>
        {SUMMER_LANTERNS.map((o, i) => (
          <group key={i} position={[o.x, 0, o.z]}>
            <FurnitureModel itemId="paper-lantern" night={night} />
          </group>
        ))}
      </>
    )
  if (fest.season === 'autumn')
    return (
      <>
        <group position={[-1.9, 0, 1.5]}>
          <FurnitureModel itemId="harvest-scarecrow" night={night} />
        </group>
        {[0, 0.34].map((y) => (
          <Part key={y} color="#c9975f" position={[1.9, 0.17 + y, 1.7]} outline={0.05}>
            <boxGeometry args={[0.6, 0.34, 0.5]} />
          </Part>
        ))}
        <Part color="#e8673e" position={[1.9, 0.5, 1.7]} outline={0.04}>
          <sphereGeometry args={[0.1, 8, 6]} />
        </Part>
      </>
    )
  return (
    <>
      <group position={[-1.9, 0, -1.7]}>
        <FurnitureModel itemId="ice-sculpture" night={night} />
      </group>
      <group position={[1.9, 0, 1.5]}>
        <FurnitureModel itemId="ice-sculpture" night={night} />
      </group>
    </>
  )
}

const BURST_EVERY = 2.6
const LAUNCH = 0.9
const BURST_LIFE = 2.2
const SPARKS = 40
const TRAIL = 5
/** 머리·꼬리 여러 개 + 불꽃 여러 개 + 터지는 순간의 밝은 심지 한 개 */
const PER = 1 + TRAIL + SPARKS + 1
const SLOTS = 3
const GRAVITY = 3.2
const BOOM_DELAY = 0.35
const CORE_TIME = 0.12
/** 채도를 지키는 색. 더하기 혼합 대신 보통 혼합을 써서 겹쳐도 흰색으로 뭉개지지 않는다. */
const PALETTE = ['#ff3d8b', '#ffb703', '#00c2ff', '#2ed573', '#9b5de5']
const HIDDEN = new THREE.Color('#000000')
const WHITE = new THREE.Color('#ffffff')
const UP = new THREE.Vector3(0, 1, 0)

interface Shot {
  launch: THREE.Vector3
  burst: THREE.Vector3
  color: THREE.Color
  vel: THREE.Vector3[]
}

/** k 번째 폭죽의 발사 자리, 터지는 자리, 불꽃 방향. 같은 k 는 언제나 같은 모양이다. */
function shotAt(k: number): Shot {
  const rng = mulberry32(hashString(`firework-${k}`))
  const a = rng() * Math.PI * 2
  const r = 3.4 + rng() * 1.2
  const launch = new THREE.Vector3(Math.cos(a) * r, 0.6, Math.sin(a) * r)
  // 높이는 6~7.5 로 둬서 기본 카메라 화면 안에 들어오게 한다
  const burst = new THREE.Vector3(launch.x * 0.4 + (rng() - 0.5) * 3, 6 + rng() * 1.5, launch.z * 0.4 + (rng() - 0.5) * 3)
  const vel: THREE.Vector3[] = []
  for (let i = 0; i < SPARKS; i++) {
    const u = rng() * 2 - 1
    const th = rng() * Math.PI * 2
    const q = Math.sqrt(1 - u * u)
    const sp = 2.4 + rng() * 2
    vel.push(new THREE.Vector3(Math.cos(th) * q * sp, u * sp, Math.sin(th) * q * sp))
  }
  return { launch, burst, color: new THREE.Color(PALETTE[k % PALETTE.length]), vel }
}

/**
 * 여름 밤 불꽃놀이. 폭죽이 광장 가장자리에서 올라가며 꼬리를 남기고, 높이 터져 색 불꽃이 떨어지며 사라진다.
 * 불꽃은 가늘게 늘어진 선(속도 방향)이고, 터지는 순간 밝은 심지가 0.12초 번쩍인다. 끝날 무렵엔 반짝이며 흩어진다.
 * 터지는 순간 주변 바닥을 색 빛으로 비추고, 펑 소리는 터진 뒤 조금 늦게 난다. 터질 때 주민이 환호한다.
 */
function Fireworks() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const flash = useRef<THREE.PointLight>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const shots = useRef(new Map<number, Shot>())
  const lastLaunch = useRef(-1)
  const lastBoom = useRef(-1)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const col = useMemo(() => new THREE.Color(), [])

  const shot = (k: number) => {
    let s = shots.current.get(k)
    if (!s) {
      s = shotAt(k)
      shots.current.set(k, s)
      if (shots.current.size > 10) for (const key of shots.current.keys()) if (key < k - 4) shots.current.delete(key)
    }
    return s
  }
  const hide = (m: THREE.InstancedMesh, idx: number) => {
    dummy.position.set(0, -50, 0)
    dummy.scale.setScalar(0.0001)
    dummy.quaternion.identity()
    dummy.updateMatrix()
    m.setMatrixAt(idx, dummy.matrix)
    m.setColorAt(idx, HIDDEN)
  }
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const night = useGame.getState().night
    const t = clock.elapsedTime
    const cur = Math.floor(t / BURST_EVERY)
    // 발사 소리는 폭죽이 올라가기 시작할 때 한 번
    if (night && cur >= 0 && cur !== lastLaunch.current) {
      lastLaunch.current = cur
      play('launch')
    }
    // 펑 소리와 환호는 터진 뒤 조금 늦게 한 번
    const kb = Math.floor((t - LAUNCH - BOOM_DELAY) / BURST_EVERY)
    if (kb >= 0 && kb !== lastBoom.current) {
      lastBoom.current = kb
      if (night) {
        play('boom')
        runtime.boomAt = t
      }
    }
    let lit: { s: Shot; tau: number } | null = null
    for (let slot = 0; slot < SLOTS; slot++) {
      const k = cur - slot
      const tau = t - k * BURST_EVERY
      const s = k >= 0 && night ? shot(k) : null
      const alive = !!s && tau >= 0 && tau <= LAUNCH + BURST_LIFE
      if (alive && s && tau >= LAUNCH && tau - LAUNCH < 0.5 && (!lit || tau < lit.tau)) lit = { s, tau }
      const base = slot * PER
      for (let i = 0; i < PER; i++) {
        const idx = base + i
        if (!s || !alive) {
          hide(m, idx)
          continue
        }
        if (i === PER - 1) {
          // 심지: 터지는 순간 0.12초 동안만 밝은 흰 점
          const ct = tau - LAUNCH
          if (ct < 0 || ct > CORE_TIME) {
            hide(m, idx)
          } else {
            dummy.position.copy(s.burst)
            dummy.quaternion.identity()
            dummy.scale.setScalar(0.2 * (1 - ct / CORE_TIME) + 0.06)
            dummy.updateMatrix()
            m.setMatrixAt(idx, dummy.matrix)
            m.setColorAt(idx, WHITE)
          }
          continue
        }
        if (i <= TRAIL) {
          // 0번은 올라가는 불꽃 머리, 나머지는 뒤따르는 꼬리
          const back = i * 0.07
          if (tau - back < 0 || tau >= LAUNCH) {
            hide(m, idx)
            continue
          }
          const ph = Math.max(0, Math.min(1, (tau - back) / LAUNCH))
          tmp.lerpVectors(s.launch, s.burst, ph * ph * (3 - 2 * ph))
          dummy.position.copy(tmp)
          dummy.quaternion.identity()
          dummy.scale.setScalar(i === 0 ? 0.1 : 0.07 * (1 - i / (TRAIL + 1)))
          dummy.updateMatrix()
          m.setMatrixAt(idx, dummy.matrix)
          m.setColorAt(idx, i === 0 ? WHITE : s.color)
          continue
        }
        const p = i - TRAIL - 1
        const ts = tau - LAUNCH
        if (ts < 0) {
          hide(m, idx)
          continue
        }
        const v = s.vel[p]
        const fade = Math.max(0, 1 - ts / BURST_LIFE)
        // 끝 무렵 반짝임: 가끔 꺼졌다 켜지며 흩어진다
        const twinkle = ts > BURST_LIFE - 0.6 && Math.sin(ts * 45 + p * 1.7) < -0.2 ? 0 : 1
        dummy.position.set(s.burst.x + v.x * ts, s.burst.y + v.y * ts - 0.5 * GRAVITY * ts * ts, s.burst.z + v.z * ts)
        // 속도 방향으로 가늘게 늘린 선. 가운데가 굵고 꼬리는 가늘다.
        dir.copy(v).normalize()
        dummy.quaternion.setFromUnitVectors(UP, dir)
        const rad = (0.05 + 0.03 * fade) * twinkle
        dummy.scale.set(rad, rad * (3 + 3 * fade), rad)
        dummy.updateMatrix()
        m.setMatrixAt(idx, dummy.matrix)
        m.setColorAt(idx, col.copy(s.color).multiplyScalar(0.35 + 0.65 * fade))
      }
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    // 터지는 순간의 빛: 불꽃 자리에 색 빛을 잠깐 켠다
    const fl = flash.current
    if (fl) {
      if (lit) {
        const b = lit.s.burst
        fl.position.set(b.x, b.y, b.z)
        fl.color.copy(lit.s.color)
        fl.intensity = 16 * (1 - (lit.tau - LAUNCH) / 0.5)
      } else {
        fl.intensity = 0
      }
    }
  })
  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, SLOTS * PER]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <pointLight ref={flash} intensity={0} distance={16} decay={1.4} />
    </>
  )
}
