import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { baseHeightAt, heightAt, waterLevelAt } from '../core/island'
import { mulberry32 } from '../core/rng'
import { BRIDGE_ARCH, BRIDGE_DECK, BRIDGES, PONDS, pondLevel, SPOUT, SPOUT_LEVEL, STREAM, STREAM_W, type Pond } from '../core/waters'
import { pondFrozen } from '../core/seasonal'
import { freeze, Part, Toon } from './toon'
import { Merge, mul, shape, useMerged, xf } from './batching'
import { useGame } from '../game/store'
import { bridgeShapes, builtBridges } from '../core/infra'
import { useSeason } from './Island'
import { bakeDepth, makeWaterMaterial, waterUniforms } from './waterMaterial'


/** 개울 가운데 선을 고르게 나눈 점들. 물 높이와 진행 방향을 같이 들고 있다. */
const STREAM_PATH = (() => {
  const out: { x: number; z: number; y: number; dx: number; dz: number; s: number }[] = []
  let s = 0
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i]
    const [bx, bz] = STREAM[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.round(len / 0.3))
    for (let j = 0; j < n || (i === STREAM.length - 2 && j === n); j++) {
      const k = j / n
      const x = ax + (bx - ax) * k
      const z = az + (bz - az) * k
      out.push({ x, z, y: waterLevelAt(x, z) ?? 0.02, dx: (bx - ax) / len, dz: (bz - az) / len, s: s + len * k })
    }
    s += len
  }
  // 다리 밑은 물 높이를 이웃에서 이어 받는다(다리 위는 물이 아니라고 답하기 때문).
  for (let i = 1; i < out.length; i++) if (waterLevelAt(out[i].x, out[i].z) === null) out[i].y = out[i - 1].y
  // 바다에 닿으면 거기서 끝낸다. 계속 이어 그리면 바다 위에 밝은 띠가 떠 보인다.
  const mouth = out.findIndex((p) => baseHeightAt(p.x, p.z) < -0.1)
  return mouth < 0 ? out : out.slice(0, Math.max(mouth, 1) + 1)
})()

/** 물 높이가 확 떨어지는 곳 = 잔디 끝 절벽의 폭포 */
const FALLS = (() => {
  let best = 0
  for (let i = 1; i < STREAM_PATH.length; i++) if (STREAM_PATH[i - 1].y - STREAM_PATH[i].y > STREAM_PATH[best].y - (STREAM_PATH[best + 1]?.y ?? 0)) best = i - 1
  const top = STREAM_PATH[best]
  // 떨어지는 구간이 몇 점에 걸쳐 있으니 아래쪽 끝을 찾는다.
  let end = best + 1
  while (end < STREAM_PATH.length - 1 && STREAM_PATH[end].y - STREAM_PATH[end + 1].y > 0.02) end++
  const bottom = STREAM_PATH[end]
  return { top, bottom }
})()

function StreamRibbon() {
  const geo = useMemo(() => {
    const verts: number[] = []
    const uvs: number[] = []
    const depth: number[] = []
    const idx: number[] = []
    const w = STREAM_W * 1.1
    STREAM_PATH.forEach((p, i) => {
      // 진행 방향에 수직으로 왼쪽·가운데·오른쪽 세 점. 가운데가 있어야 깊이가 가운데서 깊어진다.
      for (const k of [-1, 0, 1]) {
        const x = p.x - p.dz * w * k
        const z = p.z + p.dx * w * k
        verts.push(x, p.y, z)
        uvs.push((k + 1) / 2, p.s)
        depth.push(p.y - heightAt(x, z))
      }
      if (i < STREAM_PATH.length - 1) {
        const a = i * 3
        const b = a + 3
        idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1))
    g.setIndex(idx)
    return g
  }, [])
  const mat = useMemo(() => makeWaterMaterial('stream'), [])
  return <mesh geometry={geo} material={mat} renderOrder={1} />
}

/** 폭포 물줄기: 위에서 아래로 쏟아지는 흰 줄무늬. 가장자리는 투명하게 흐린다. len 은 판의 길이(월드 단위)다. */
function makeFallsMaterial(len: number) {
  return new THREE.ShaderMaterial({
    // 비 오는 날 멀리 있는 폭포도 다른 물체처럼 안개에 묻히게 한다.
    uniforms: { uTime: waterUniforms.uTime, uRepeat: { value: Math.max(1, Math.round(len / 0.35)) }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uRepeat;
      varying vec2 vUv;
      void main() {
        // 가로 위치에 따라 줄기 위상을 부드럽게 흔든다. 칸을 나누면 칸 경계가 계단처럼 보인다.
        float wob = sin(vUv.x * 13.0 + 1.3) * 0.5 + sin(vUv.x * 29.0) * 0.25;
        // 판 길이에 맞춘 줄기 수만큼 위에서 아래로 흘린다. 줄기 가장자리는 부드럽게 흐린다.
        float y = fract(vUv.y * uRepeat + uTime * 1.9 + wob);
        float streak = smoothstep(0.3, 0.5, y) * (1.0 - smoothstep(0.7, 1.0, y));
        vec3 col = mix(vec3(0.7, 0.92, 0.97), vec3(1.0), streak);
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        // 아래(바닥에 닿는 곳)는 하얗게 부서진다.
        col = mix(col, vec3(1.0), smoothstep(0.3, 0.0, vUv.y));
        // 위(꼭대기)와 아래도 흐려서 판의 네모 가장자리가 안 보이게 한다.
        float fade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        gl_FragColor = vec4(col, (0.6 + streak * 0.3) * edge * fade);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

const SPRAY_N = 18

/** 폭포: 떨어지는 물줄기 면 + 아래에서 튀어 오르는 물보라 */
/** 윗면 물길이 벽을 타고 떨어지는 자리: 꼭대기는 물길 끝, 아래는 벽 밑 땅 */
const SPOUT_FALL = (() => {
  const [ax, az] = SPOUT.a
  const [bx, bz] = SPOUT.b
  const len = Math.hypot(bx - ax, bz - az)
  const dx = (bx - ax) / len
  const dz = (bz - az) / len
  const fx = bx + dx * 0.5
  const fz = bz + dz * 0.5
  return { top: { x: bx, y: SPOUT_LEVEL, z: bz, dx, dz }, bottom: { x: fx, y: heightAt(fx, fz), z: fz } }
})()

/** 윗면 물길 물 판: 연못과 같은 물 셰이더를 쓰고 높이는 물길 높이로 맞춘다. */
function SpoutSurface() {
  const geo = useMemo(() => {
    const [ax, az] = SPOUT.a
    const [bx, bz] = SPOUT.b
    const len = Math.hypot(bx - ax, bz - az)
    const g = new THREE.PlaneGeometry(len + 0.1, SPOUT.w * 2)
    g.rotateX(-Math.PI / 2)
    bakeDepth(g, () => SPOUT_LEVEL, heightAt, { x: (ax + bx) / 2, z: (az + bz) / 2 })
    return g
  }, [])
  const mat = useMemo(() => makeWaterMaterial('pond'), [])
  const [ax, az] = SPOUT.a
  const [bx, bz] = SPOUT.b
  return <mesh geometry={geo} material={mat} position={[(ax + bx) / 2, SPOUT_LEVEL, (az + bz) / 2]} rotation-y={Math.atan2(-(bz - az), bx - ax)} renderOrder={1} />
}

function Waterfall({ top, bottom, width }: { top: { x: number; y: number; z: number; dx: number; dz: number }; bottom: { x: number; y: number; z: number }; width: number }) {
  const drop = Math.hypot(top.x - bottom.x, top.y - bottom.y, top.z - bottom.z)
  const spray = useRef<THREE.InstancedMesh>(null)
  const sheetMat = useMemo(() => makeFallsMaterial(drop + 0.2), [drop])
  const m = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => {
    const rng = mulberry32(31)
    return Array.from({ length: SPRAY_N }, () => ({ a: rng() * Math.PI * 2, r: 0.2 + rng() * 0.6, off: rng(), h: 0.25 + rng() * 0.35 }))
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const mesh = spray.current
    if (!mesh) return
    seeds.forEach((sd, i) => {
      const k = (t * 1.4 + sd.off) % 1
      m.position.set(bottom.x + Math.cos(sd.a) * sd.r * (0.4 + k), bottom.y + 0.05 + Math.sin(k * Math.PI) * sd.h, bottom.z + Math.sin(sd.a) * sd.r * (0.4 + k))
      m.scale.setScalar(0.09 * (1 - k * 0.7))
      m.updateMatrix()
      mesh.setMatrixAt(i, m.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  const mid = { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2, z: (top.z + bottom.z) / 2 }
  const pitch = Math.atan2(top.y - bottom.y, Math.hypot(top.x - bottom.x, top.z - bottom.z))
  return (
    <group>
      {/* 물줄기: 하얀 반투명 면을 경사에 맞춰 세운다 */}
      {/* 판을 물 표면(개울 띠)보다 살짝 앞으로 밀어 띠에 묻히지 않게 하고, 띠 위에 그린다. */}
      <group position={[mid.x + Math.sin(pitch) * top.dx * 0.06, mid.y + 0.04 + Math.cos(pitch) * 0.06, mid.z + Math.sin(pitch) * top.dz * 0.06]} rotation={[0, Math.atan2(top.dx, top.dz), 0]}>
        {/* 판의 +y(uv 위쪽)가 폭포 꼭대기(상류·위)를 향하게 눕힌다. */}
        <mesh rotation-x={pitch - Math.PI / 2} renderOrder={2}>
          <planeGeometry args={[width, drop + 0.2]} />
          <primitive object={sheetMat} attach="material" />
        </mesh>
      </group>
      <instancedMesh ref={spray} args={[undefined, undefined, SPRAY_N]}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </instancedMesh>
      {/* 폭포 아래 하얀 물거품 고리 */}
      <mesh position={[bottom.x, bottom.y + 0.015, bottom.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.9, 20]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}

function PondSurface({ x, z, r, level }: { x: number; z: number; r: number; level: number }) {
  const geo = useMemo(() => {
    // 가운데서 가장자리로 여러 겹 고리를 둬야 깊이(거품 테두리)가 매끈하게 바뀐다.
    const g = new THREE.RingGeometry(0.001, r * 1.06, 48, 10)
    g.rotateX(-Math.PI / 2)
    bakeDepth(g, () => level, heightAt, { x, z })
    return g
  }, [x, z, r, level])
  const mat = useMemo(() => makeWaterMaterial('pond'), [])
  return <mesh geometry={geo} material={mat} position={[x, level, z]} renderOrder={1} />
}

/** 연잎(몇 장엔 분홍 꽃)과 물가 갈대. 겨울엔 연잎이 지고 갈대만 마른 색으로 남는다. */
function PondLife({ winter, spring }: { winter: boolean; spring: boolean }) {
  const pads = useMemo(() => {
    const rng = mulberry32(5)
    return PONDS.flatMap((p) =>
      Array.from({ length: Math.round(p.r * 1.3) }, () => {
        const a = rng() * Math.PI * 2
        const d = p.r * (0.35 + rng() * 0.5)
        return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, y: pondLevel(p) + 0.02, s: 0.3 + rng() * 0.22, rot: rng() * Math.PI * 2, flower: rng() < 0.3 }
      }),
    )
  }, [])
  const reeds = useMemo(() => {
    const rng = mulberry32(9)
    return PONDS.flatMap((p) =>
      Array.from({ length: 4 }, () => {
        // 물가 둑 바깥(반지름 1.1~1.2배)에 심는다. 물 위로 나오면(개울 쪽 등) 다시 뽑고, 그래도 안 되면 건너뛴다.
        for (let t = 0; t < 8; t++) {
          const a = rng() * Math.PI * 2
          const d = p.r * (1.1 + rng() * 0.1)
          const x = p.x + Math.cos(a) * d
          const z = p.z + Math.sin(a) * d
          if (waterLevelAt(x, z) === null) return { x, z, y: heightAt(x, z) - 0.04, seed: rng() * 10 }
        }
        return null
      }),
    ).filter((r): r is { x: number; z: number; y: number; seed: number } => r !== null)
  }, [])
  // 한쪽이 파인 동그란 잎은 한 가지 초록이라 모두 한 덩어리로 굳힌다(겨울엔 없다)
  const padBody = useMerged(
    (b) => {
      if (winter) return
      for (const p of pads) b.add(shape(THREE.CircleGeometry, p.s, 16, 0.35, Math.PI * 2 - 0.7), mul(xf([p.x, p.y, p.z], [0, p.rot, 0]), xf([0, 0, 0], [-Math.PI / 2, 0, 0])), '#5aa84f', { cast: false })
    },
    [pads, winter],
  )
  return (
    <>
      <Merge g={padBody} />
      {!winter &&
        pads.map((p, i) =>
          p.flower && (spring || i % 2 === 0) ? (
            <group key={i} position={[p.x, p.y, p.z]} rotation-y={p.rot}>
              <Part color="#f6a8c4" position={[p.s * 0.2, 0.07, 0]} scale={[0.11, 0.08, 0.11]} outline={0.08}>
                <dodecahedronGeometry args={[1, 0]} />
              </Part>
            </group>
          ) : null,
        )}
      {reeds.map((r, i) => (
        <Reeds key={i} x={r.x} y={r.y} z={r.z} seed={r.seed} dry={winter} />
      ))}
    </>
  )
}

function Reeds({ x, y, z, seed, dry }: { x: number; y: number; z: number; seed: number; dry: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.3 + seed) * 0.06
  })
  const stem = dry ? '#c9b07a' : '#6fa64a'
  // 뿌리는 둑의 실제 땅 높이에 둔다(물 높이에 두면 물속에서 솟아 보인다).
  return (
    <group ref={ref} position={[x, y, z]}>
      {[-0.12, 0, 0.13].map((dx, i) => (
        <group key={i} position={[dx, 0, (i - 1) * 0.06]} rotation-z={dx * 0.9}>
          <mesh position-y={0.42 + i * 0.06}>
            <cylinderGeometry args={[0.02, 0.025, 0.85 + i * 0.12, 5]} />
            <Toon color={stem} />
          </mesh>
          {/* 부들 이삭 */}
          {i !== 1 && (
            <Part color="#8a5a35" position={[0, 0.86 + i * 0.12, 0]} scale={[0.05, 0.13, 0.05]} outline={0.1}>
              <capsuleGeometry args={[1, 0.6, 3, 6]} />
            </Part>
          )}
        </group>
      ))}
    </group>
  )
}

/** 나무다리: 가로 널판 + 양옆 난간. 가운데가 살짝 솟은 아치형. 조각을 한 묶음으로 굳혀 그린다(호출 수를 줄인다). */
function Bridge({ x, z, rot, len, w }: { x: number; z: number; rot: number; len: number; w: number }) {
  const g = useMergedBridge(len, w)
  return (
    <group ref={freeze} position={[x, 0, z]} rotation-y={rot}>
      <Merge g={g} />
    </group>
  )
}

/** 다리 한 개의 조각을 묶는다(널판·받침·난간 기둥·손잡이). 세로 여럿이 같은 재질로 한 번에 그려진다. */
function useMergedBridge(len: number, w: number) {
  return useMerged((b) => {
    const planks = Math.round(len / 0.32)
    const arch = (k: number) => Math.sin(k * Math.PI) * BRIDGE_ARCH
    for (let i = 0; i < planks; i++) {
      const k = (i + 0.5) / planks
      const zz = -len / 2 + k * len
      b.add(shape(THREE.BoxGeometry, w, 0.08, 0.28), xf([0, BRIDGE_DECK - 0.04 + arch(k), zz], [Math.cos(k * Math.PI) * -0.12, 0, 0]), i % 2 ? '#c48a55' : '#b77d4b', { outline: 0.04 })
    }
    // 널판 받침 두 줄
    for (const sd of [-1, 1]) b.add(shape(THREE.BoxGeometry, 0.12, 0.12, len), xf([sd * (w / 2 - 0.15), 0.94, 0]), '#8a5a35')
    for (const sd of [-1, 1]) {
      for (const k of [0, 0.5, 1]) {
        b.add(shape(THREE.CylinderGeometry, 0.07, 0.08, 0.62, 8), xf([sd * (w / 2 + 0.02), 1.32 + arch(k), -len / 2 + 0.1 + k * (len - 0.2)]), '#9b6a45', { outline: 0.06 })
      }
      // 난간 손잡이: 아치를 따라 두 토막
      for (const half of [-1, 1]) {
        b.add(shape(THREE.BoxGeometry, 0.1, 0.08, len / 2 - 0.05), xf([sd * (w / 2 + 0.02), 1.62 + arch(0.25) * 0.9, half * len * 0.25], [half * -0.1, 0, 0]), '#c48a55', { outline: 0.05 })
      }
    }
  }, [len, w])
}

/** 겨울 얼음: 연못 가장자리에 얇은 얼음 띠를 두르고, 깊은 겨울의 작은 연못은 수면 전체가 언다 */
function PondIce({ p, frozen }: { p: Pond; frozen: boolean }) {
  // 물결이 올라오는 높이보다 위에 얹는다(얇게 깔면 파도에 가려진다)
  const y = pondLevel(p) + 0.12
  const ring = useMemo(() => new THREE.RingGeometry(p.r - 0.7, p.r - 0.05, 40), [p.r])
  const disc = useMemo(() => new THREE.CircleGeometry(p.r - 0.1, 40), [p.r])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e8f6fb', transparent: true, opacity: 0.92, depthWrite: false }), [])
  useEffect(() => () => { ring.dispose(); disc.dispose(); mat.dispose() }, [ring, disc, mat])
  return (
    <group>
      <mesh geometry={ring} material={mat} position={[p.x, y, p.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10} />
      {frozen && <mesh geometry={disc} material={mat} position={[p.x, y, p.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10} />}
    </group>
  )
}

/** 섬 안의 연못·개울·폭포·다리 */
export function Waters() {
  const season = useSeason()
  const winter = season === 'winter'
  // 섬 정비로 지은 다리(지어진 것만). 맡긴 다리는 다음 날 아침에 나타난다.
  const infra = useGame((s) => s.infra)
  const day = useGame((s) => s.day)
  const built = useMemo(() => bridgeShapes(builtBridges(infra, day)), [infra, day])
  return (
    <>
      {PONDS.map((p, i) => (
        <PondSurface key={i} x={p.x} z={p.z} r={p.r} level={pondLevel(p)} />
      ))}
      <PondLife winter={winter} spring={season === 'spring'} />
      {winter && PONDS.map((p, i) => <PondIce key={`ice-${i}`} p={p} frozen={pondFrozen(p, day)} />)}
      <SpoutSurface />
      <Waterfall top={SPOUT_FALL.top} bottom={SPOUT_FALL.bottom} width={SPOUT.w * 2} />
      <StreamRibbon />
      <Waterfall top={FALLS.top} bottom={FALLS.bottom} width={STREAM_W * 1.9} />
      {BRIDGES.map((b, i) => (
        <Bridge key={i} {...b} />
      ))}
      {built.map((b) => (
        <Bridge key={`${b.x},${b.z}`} {...b} />
      ))}
    </>
  )
}
