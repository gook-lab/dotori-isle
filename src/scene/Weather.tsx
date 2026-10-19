import { isIndoor } from '../game/indoor'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { seasonFor } from '../core/season'
import { weatherFor, type Weather } from '../core/weather'
import { windLevel } from '../core/wind'
import { skyGlow } from './skyGlow'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { Part } from './toon'

const BOX = 36
const TOP = 16
/** 카메라가 플레이어 뒤(+z)에 있어서, 그쪽 빗줄기는 렌즈 바로 앞에서 굵은 막대로 보인다. 앞쪽에만 내린다. */
const randZ = () => -BOX * 0.7 + Math.random() * BOX * 0.85

interface FallKind {
  count: number
  speed: [number, number]
  /** 좌우로 하늘거리는 폭. 0 이면 곧게 떨어진다. */
  sway: number
  /** 떨어지며 빙글 도는 속도 */
  spin: number
  colors: string[]
  geometry: 'streak' | 'flake' | 'petal'
  opacity: number
}

const FALLS = {
  rain: { count: 900, speed: [16, 22], sway: 0, spin: 0, colors: ['#cfe6ff'], geometry: 'streak', opacity: 0.55 },
  snow: { count: 700, speed: [1.4, 2.6], sway: 0.5, spin: 0, colors: ['#ffffff'], geometry: 'flake', opacity: 0.9 },
  petals: { count: 110, speed: [0.9, 1.5], sway: 0.9, spin: 2.5, colors: ['#ffc4d6', '#ffd6e2', '#ffffff'], geometry: 'petal', opacity: 0.95 },
  leaves: { count: 90, speed: [1.1, 1.8], sway: 1.1, spin: 3, colors: ['#f29b4b', '#e8673e', '#f7b955'], geometry: 'petal', opacity: 1 },
} satisfies Record<string, FallKind>

/** 비·눈·꽃잎·낙엽: 플레이어 주변 상자 안에서 떨어지다 바닥에 닿으면 위로 돌아간다. */
function Falling({ kind }: { kind: keyof typeof FALLS }) {
  const cfg: FallKind = FALLS[kind]
  const mesh = useRef<THREE.InstancedMesh>(null)
  // 비는 태풍 때 1.6배까지 그리므로 최대 개수로 만들고, 평소엔 앞쪽 900개만 그린다
  const size = kind === 'rain' ? Math.round(cfg.count * 1.6) : cfg.count
  const drops = useMemo(
    () =>
      Array.from({ length: size }, () => ({
        x: (Math.random() - 0.5) * BOX,
        y: Math.random() * TOP,
        z: randZ(),
        v: cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0]),
        ph: Math.random() * Math.PI * 2,
      })),
    [cfg, size],
  )
  const m = useMemo(() => new THREE.Object3D(), [])
  // 지금 그리는 개수(바뀔 때만 g.count 에 적는다)
  const shown = useRef(-1)
  useEffect(() => {
    const g = mesh.current
    if (!g || cfg.colors.length < 2) return
    const c = new THREE.Color()
    drops.forEach((_, i) => g.setColorAt(i, c.set(cfg.colors[i % cfg.colors.length])))
    if (g.instanceColor) g.instanceColor.needsUpdate = true
  }, [cfg, drops])
  useFrame(({ clock }, delta) => {
    const g = mesh.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const p = runtime.player
    // 바람 날엔 입자가 한 방향(+x)으로 날린다. 태풍은 더 세게, 비는 가로로 기울어 떨어진다.
    const gale = windLevel(useGame.getState().day)
    const blow = gale === 'calm' ? 0 : (gale === 'typhoon' ? 4.5 : 1.8) * dt
    // 개수는 바뀔 때만 적는다. 다른 곳(품질 시험 등)에서 바꾼 값을 매 프레임 되돌리지 않는다.
    const active = kind === 'rain' && gale === 'typhoon' ? size : cfg.count
    if (shown.current !== active) {
      g.count = active
      shown.current = active
    }
    drops.forEach((d, i) => {
      if (i >= active) return
      d.y -= d.v * dt
      if (blow) {
        d.x += blow * (cfg.sway ? 1 : 2.5)
        if (d.x > BOX / 2) d.x -= BOX
      }
      if (d.y < 0) {
        d.y += TOP
        d.x = (Math.random() - 0.5) * BOX
        d.z = randZ()
      }
      const sway = Math.sin(t * 1.3 + d.ph) * cfg.sway
      // 비는 바람에 살짝 비스듬히, 나머지는 하늘하늘
      // 태풍 비는 바람을 따라 훨씬 눕는다
      const lean = gale === 'typhoon' ? 0.35 : 0.08
      m.position.set(p.x + d.x + (cfg.sway ? sway : d.y * lean), p.y + d.y - 2, p.z + d.z + Math.cos(t * 0.9 + d.ph) * cfg.sway * 0.5)
      if (cfg.spin) m.rotation.set(t * cfg.spin + d.ph, d.ph, t * cfg.spin * 0.7)
      else m.rotation.set(0, 0, cfg.sway ? 0 : 0.08)
      m.updateMatrix()
      g.setMatrixAt(i, m.matrix)
    })
    g.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, size]} frustumCulled={false}>
      {cfg.geometry === 'streak' && <boxGeometry args={[0.025, 0.55, 0.025]} />}
      {cfg.geometry === 'flake' && <icosahedronGeometry args={[0.06, 0]} />}
      {cfg.geometry === 'petal' && <circleGeometry args={[0.09, 5]} />}
      <meshBasicMaterial
        color={cfg.colors.length < 2 ? cfg.colors[0] : '#ffffff'}
        transparent
        opacity={cfg.opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}

const CLOUD_COUNT: Record<Weather, number> = { sunny: 4, cloudy: 11, rain: 13, snow: 12 }

/** 섬 위를 천천히 흘러가는 뭉게구름. 날씨에 따라 수와 색이 바뀐다. */
/** 해 질 녘 구름 아래쪽 색 */
const CLOUD_WARM = new THREE.Color('#ff9a5c')

function Clouds({ weather }: { weather: Weather }) {
  const typhoon = useGame((s) => windLevel(s.day) === 'typhoon')
  const group = useRef<THREE.Group>(null)
  const clouds = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const a = (i / 13) * Math.PI * 2 + i
        const r = 10 + ((i * 7) % 5) * 7
        return { x: Math.cos(a) * r, z: Math.sin(a) * r - 6, y: 15 + (i % 3) * 2.2, s: 1 + (i % 4) * 0.35 }
      }),
    [],
  )
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const p = runtime.player
    // 해 질 녘엔 구름이 주황으로 물든다(재질마다 처음 색을 기억해 두고 그 사이를 섞는다)
    const warm = skyGlow.twilight * 0.6
    g.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined
      if (!mat?.color) return
      const base = (o.userData.baseColor ??= mat.color.clone()) as THREE.Color
      mat.color.copy(base).lerp(CLOUD_WARM, warm)
    })
    // 섬을 따라 움직이되 아주 느리게 흘러간다(여행 섬에서도 하늘이 보이게).
    const drift = (clock.elapsedTime * 0.4) % 80
    g.position.set(p.x * 0.6 + drift - 40, 0, p.z * 0.6)
  })
  // 태풍 구름은 짙은 회청색이다
  const color = typhoon ? '#3b4a60' : weather === 'rain' ? '#a7b0ba' : weather === 'cloudy' || weather === 'snow' ? '#e3e8ee' : '#ffffff'
  return (
    <group ref={group}>
      {clouds.slice(0, CLOUD_COUNT[weather]).map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          <Part color={color} outline={0}>
            <sphereGeometry args={[1.6, 14, 10]} />
          </Part>
          <Part color={color} position={[1.6, -0.3, 0.2]} outline={0}>
            <sphereGeometry args={[1.15, 12, 10]} />
          </Part>
          <Part color={color} position={[-1.5, -0.4, -0.1]} outline={0}>
            <sphereGeometry args={[1.05, 12, 10]} />
          </Part>
        </group>
      ))}
    </group>
  )
}

export function WeatherFx() {
  const day = useGame((s) => s.day)
  const weather = weatherFor(day)
  const season = seasonFor(day)
  // 내 집 안도 실내라 비·눈·꽃잎이 들이치지 않는다.
  const inside = useGame((s) => isIndoor(s))
  if (inside) return null
  // 궂은 날이 아니면 봄엔 꽃잎, 가을엔 낙엽이 흩날린다.
  const fall = weather === 'rain' || weather === 'snow' ? weather : season === 'spring' ? 'petals' : season === 'autumn' ? 'leaves' : null
  return (
    <>
      <Clouds weather={weather} />
      {fall && <Falling key={fall} kind={fall} />}
    </>
  )
}
