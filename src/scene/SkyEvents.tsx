import { useMemo, useRef } from 'react'
import { isIndoor } from '../game/indoor'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { currentHour } from '../core/clock'
import { hashString, mulberry32 } from '../core/rng'
import { isMeteorNight, meteorHours, prevDay, rainbowDay, rainbowHour } from '../core/skyEvents'
import { weatherFor } from '../core/weather'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

/**
 * 하늘 이벤트 장면: 유성우 밤의 별똥별과 비 갠 뒤 무지개.
 * 둘 다 화면 위쪽 하늘에 그린다. 기본 카메라가 보는 방향에 맞춰 화면 좌표로 자리를 잡아
 * 어느 각도에서든 카메라가 올려다보는 하늘 띠에 걸린다. 집 안이나 전시관에서는 숨긴다.
 */
export function SkyEvents() {
  return (
    <>
      <Meteors />
      <Rainbow />
    </>
  )
}

/** 지금 하늘 이벤트가 보일 수 있는 바깥인지 */
const outdoors = () => {
  const s = useGame.getState()
  return !isIndoor(s)
}

/** 화면 좌표(-1..1)가 가리키는 하늘 먼 곳 한 점. 카메라에서 일정 거리에 둔다. */
const SKY_DIST = 60
function skyPoint(nx: number, ny: number, camera: THREE.Camera, out: THREE.Vector3) {
  out.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(SKY_DIST).add(camera.position)
  return out
}

const METEOR_CYCLE = 5
const METEOR_TIME = 1.1
const STREAK_W = 0.3
const STREAK_L = 12

/**
 * 별똥별: 주기마다 하나씩, 화면 위쪽에서 비스듬히 흘러 내려간다. 자리와 방향은 주기 번호로 정해진다.
 * 카메라를 마주 보는 평면을 화면 안에서 돌려 세우므로, 어느 각도에서 보아도 줄기가 가로로 눕는다.
 */
/** 꼬리가 투명에서 시작해 머리로 갈수록 밝아지는 띠 무늬. 평면의 위쪽(+Y, 흐름 방향)이 머리다. */
function streakTexture() {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 256
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createLinearGradient(0, c.height, 0, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.6, 'rgba(255,246,216,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  const tex = new THREE.CanvasTexture(c)
  return tex
}

function Meteors() {
  const mesh = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => streakTexture(), [])
  const tmp = useMemo(() => ({ mid: new THREE.Vector3() }), [])
  const spin = useMemo(() => new THREE.Quaternion(), [])
  const Z = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  // 소원을 빌고 나서 별똥별이 그려졌는지
  const streakSeen = useRef(false)
  useFrame(({ clock, camera }) => {
    const m = mesh.current
    if (!m) return
    const st = useGame.getState()
    const on = outdoors() && isMeteorNight(st.day, weatherFor(st.day)) && meteorHours(currentHour())
    m.visible = on
    if (!on) {
      runtime.wishing = false
      return
    }
    const t = clock.elapsedTime
    const k = Math.floor(t / METEOR_CYCLE)
    const local = t - k * METEOR_CYCLE
    if (local > METEOR_TIME) {
      m.visible = false
      // 소원을 빌고 기다리는 동안 별똥별이 한 번 지나갔다면 소원이 이루어진다
      if (streakSeen.current) {
        streakSeen.current = false
        if (runtime.wishing) {
          runtime.wishing = false
          st.makeWish()
        }
      }
      return
    }
    if (runtime.wishing) streakSeen.current = true
    const rng = mulberry32(hashString(`meteor-cycle-${k}`))
    const x0 = -0.6 + rng() * 0.9
    const y0 = 0.3 + rng() * 0.4
    const dx = 0.45 + rng() * 0.25
    const dy = -0.12 - rng() * 0.12
    const p = local / METEOR_TIME
    // 가운데 점을 화면에 놓고, 흐름 방향(화면 비율을 보정한 각도)으로 평면을 돌린다
    const cx = x0 + dx * (p - 0.06)
    const cy = y0 + dy * (p - 0.06)
    skyPoint(cx, cy, camera, tmp.mid)
    m.position.copy(tmp.mid)
    const angle = Math.atan2(dy, dx * (camera as THREE.PerspectiveCamera).aspect)
    spin.setFromAxisAngle(Z, angle - Math.PI / 2)
    m.quaternion.copy(camera.quaternion).multiply(spin)
    // 흐려지며 사라진다
    ;(m.material as THREE.MeshBasicMaterial).opacity = 1 - p * p * 0.6
  })
  return (
    <mesh ref={mesh} visible={false} frustumCulled={false} renderOrder={10}>
      <planeGeometry args={[STREAK_W, STREAK_L]} />
      {/* 화면 위쪽은 지평선 근처라 지형에 가리기 쉬워서, 별똥별은 깊이 검사와 안개 없이 그린다 */}
      <meshBasicMaterial color="#ffffff" map={tex ?? undefined} transparent fog={false} toneMapped={false} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

const RAINBOW_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#8ce99a', '#74c0fc', '#748ffc', '#b197fc']

/**
 * 띠 가장자리를 흐리게, 호의 양 끝(지평선 쪽)을 안개처럼 옅게 만든 색 정점. 토러스의 uv 에서 u 는 호를 따라,
 * v 는 띠 단면을 따라 간다.
 */
function feathered(geo: THREE.BufferGeometry) {
  const uv = geo.attributes.uv
  const col = new Float32Array(uv.count * 4)
  for (let i = 0; i < uv.count; i++) {
    const along = 0.2 + 0.8 * Math.sin(Math.PI * uv.getX(i))
    const across = Math.pow(Math.sin(Math.PI * uv.getY(i)), 0.6)
    col.set([1, 1, 1, 0.6 * along * across], i * 4)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4))
  return geo
}
/** 무지개는 섬 너머 먼 지평선 쪽에 둔다 */
const RAINBOW_DIST = 180
/** 호 반지름 상한. 하늘 위쪽으로 너무 솟아 화면 밖으로 나가지 않게 한다. */
const RAINBOW_MAX_R = 70

/**
 * 무지개: 먼 지평선 위에 걸린 일곱 색 호. 하늘을 올려다볼 때만 보이고, 섬과 땅 뒤에 깊이 검사로 가려진다.
 * 한 게임 시간 동안만 보인다.
 */
function Rainbow() {
  const group = useRef<THREE.Group>(null)
  const geos = useMemo(() => RAINBOW_COLORS.map((_, i) => feathered(new THREE.TorusGeometry(1 - i * 0.05, 0.05, 6, 96, Math.PI))), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    const st = useGame.getState()
    // 하늘을 올려다보는 중(벤치에 앉아 하늘 블렌드가 켜진 상태)에만 보인다. 기본 시점에서는 알림으로 대신한다.
    const on = outdoors() && rainbowDay(weatherFor(prevDay(st.day)), weatherFor(st.day)) && rainbowHour(currentHour()) && runtime.skyCam > 0.5
    g.visible = on
    if (!on) return
    // 실제로 올려다본 순간에만 기록한다(무지개가 뜬 시간에 있기만 해서는 안 된다)
    if (!st.rainbowSeen) st.seeRainbow()
    const cam = camera as THREE.PerspectiveCamera
    // 수평 방향 먼 곳, 지평선 높이에 둔다. 앞쪽 땅과 섬은 깊이 검사로 가리고 위쪽 호만 보인다.
    camera.getWorldDirection(dir)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
    dir.normalize()
    tmp.copy(camera.position).addScaledVector(dir, RAINBOW_DIST)
    tmp.y = 0
    g.position.copy(tmp)
    g.quaternion.copy(camera.quaternion)
    // 거리 RAINBOW_DIST 에서 세로 화각의 반높이(h). 가로로는 화면 너비를 넘도록 키운다.
    const h = RAINBOW_DIST * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    g.scale.setScalar(Math.min(h * Math.max(cam.aspect, 0.6) * 0.6, RAINBOW_MAX_R))
  })
  return (
    <group ref={group} visible={false}>
      {RAINBOW_COLORS.map((c, i) => (
        <mesh key={c} geometry={geos[i]}>
          {/* 파스텔 톤: 원색을 흰색 쪽으로 조금 섞는다 */}
          <meshBasicMaterial color={new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.2)} vertexColors transparent fog={false} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
