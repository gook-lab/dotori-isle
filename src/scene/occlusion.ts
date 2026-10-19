import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { chainKey } from './worldFx'

const camToPlayer = new THREE.Vector3()
const camToObj = new THREE.Vector3()
const ndc = new THREE.Vector3()
/** DEV 전용 QA 훅: ?nofade 를 붙이면 가리는 물체가 투명해지지 않는다(배포 빌드에서는 항상 꺼져 있다) */
const NO_FADE = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofade')

/**
 * 카메라와 플레이어 사이를 가리는지. 물체 가운데에서 카메라→플레이어(가슴 높이) 선분까지 거리가
 * 반지름보다 가깝고, 물체가 플레이어보다 카메라 쪽에 있으면 가린 것이다.
 */
export function occludes(cx: number, cy: number, cz: number, radius: number, camera: THREE.Camera, hold = false): boolean {
  const cam = camera.position
  const p = runtime.player
  camToPlayer.set(p.x - cam.x, p.y + 0.8 - cam.y, p.z - cam.z)
  camToObj.set(cx - cam.x, cy - cam.y, cz - cam.z)
  const len = camToPlayer.length()
  // 카메라 코앞에 걸린 물체(지붕·나무 꼭대기)는 플레이어를 직접 가리지 않아도 화면 아래쪽을 크게 덮는다.
  // 플레이어보다 한참 카메라 쪽에 있고 화면 아래로 걸치면 같이 비켜 준다. 세로 화면처럼 카메라가 더 물러나도 같은 기준이 된다.
  if (camToObj.length() < len * 0.75) {
    ndc.set(cx, cy, cz).project(camera)
    if (ndc.z < 1 && ndc.y < (hold ? -0.28 : -0.35) && ndc.y > -3 && Math.abs(ndc.x) < 1.6) return true
  }
  const along = camToObj.dot(camToPlayer) / len
  if (along <= 0 || along >= len - 0.6) return false
  // 이미 비켜 준 동안엔 경계를 조금 넓혀 둔다. 경계 위를 오가도 반투명과 불투명이 번갈아 튀지 않게.
  const r = hold ? radius * 1.2 : radius
  return camToObj.lengthSq() - along * along < r * r
}

/** 묶음 안 재질들과 테두리 껍데기(뒷면만 그리는 메시)를 나눠 모은다. */
function collectParts(g: THREE.Object3D) {
  const mats: THREE.Material[] = []
  const outlines: THREE.Object3D[] = []
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material
    if (!m || Array.isArray(m)) return
    if (m.side === THREE.BackSide) outlines.push(o)
    else mats.push(m)
  })
  return { mats, outlines }
}

/**
 * 플레이어를 가리면 묶음 전체를 반투명하게 비켜 준다. center 는 고정 좌표다(프레임마다 높이를 다시 재지 않게).
 * 비켜 주는 동안엔 테두리 껍데기를 숨긴다(투명하면 안쪽이 비쳐 칙칙해 보인다).
 */
export function useOcclusionFade(ref: RefObject<THREE.Object3D | null>, center: readonly [number, number, number], radius: number, min = 0.28) {
  const st = useRef({ v: 1, parts: null as ReturnType<typeof collectParts> | null })
  useFrame(({ camera }, delta) => {
    const g = ref.current
    if (!g || NO_FADE) return
    const f = st.current
    const [x, y, z] = center
    const want = occludes(x, y, z, radius, camera, f.v < 1) ? min : 1
    if (want === f.v && f.v >= 1) return
    f.v = want < f.v ? Math.max(want, f.v - delta * 4) : Math.min(want, f.v + delta * 3)
    f.parts ??= collectParts(g)
    const see = f.v < 0.999
    for (const o of f.parts.outlines) o.visible = !see
    for (const m of f.parts.mats) {
      if (m.transparent !== see) {
        m.transparent = see
        m.depthWrite = !see
        m.needsUpdate = true
      }
      m.opacity = f.v
    }
    // 완전히 돌아오면 모은 목록을 비운다. 그사이 열매·눈 같은 메시가 새로 생겨도 다음엔 다시 모은다.
    if (!see) f.parts = null
  })
}

/**
 * 플레이어 주변을 비우는 구멍(x, y, z, 반지름). 절벽 벽·윗자락·돌이 플레이어를 가리면 그 부분만 잘라 낸다.
 * Player 가 매 프레임 갱신하고, withPlayerHole 로 감싼 재질들이 함께 읽는다.
 */
export const playerHole = { value: new THREE.Vector4(0, -99, 0, 0) }
/** 나무 잎용 좁은 구멍: 몸통 기둥만 비워 잎의 나머지는 그대로 둔다. */
export const bodyHole = { value: new THREE.Vector4(0, -99, 0, 0) }
/** 나무 테두리 껍데기용 구멍: 잎 안쪽(뒷면)이 비치지 않도록 몸통보다 넓게 비운다. */
export const outlineHole = { value: new THREE.Vector4(0, -99, 0, 0) }

/** 재질의 프래그먼트에서 플레이어 주변(반지름 안, 높이 ±2 안)을 버린다. 덮개나 땅에는 쓰지 않는다. */
export function withPlayerHole<T extends THREE.Material>(mat: T, hole: { value: THREE.Vector4 } = playerHole): T {
  const prevCompile = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(mat, shader, renderer)
    shader.uniforms.uHole = hole
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoleW;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n#ifdef USE_INSTANCING\nvHoleW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvHoleW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uHole;\nvarying vec3 vHoleW;')
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (distance(vHoleW.xz, uHole.xz) < uHole.w && abs(vHoleW.y - uHole.y) < 2.0) discard;',
      )
  }
  // 구멍 값만 다르고 셰이더 코드는 같으니 키를 하나로 둬서 프로그램을 공유한다(uniform 객체는 재질마다 따로 넘긴다).
  chainKey(mat, 'playerHole')
  return mat
}

/** 카메라 주변 구멍(x, y, z, 반지름). 카메라 코앞의 풀 덤불이 화면을 덮지 않게 자른다. */
export const cameraCut = { value: new THREE.Vector4() }

/**
 * 재질에 카메라 주변 구멍을 덧붙인다. 기존 onBeforeCompile(바람 흔들림 등)은 먼저 돌린다.
 * 인스턴싱된 메시에서도 정점 위치를 맞게 읽는다.
 */
export function withCameraCut<T extends THREE.Material>(mat: T): T {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    shader.uniforms.uCam = cameraCut
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n#ifdef USE_INSTANCING\nvCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uCam;\nvarying vec3 vCutW;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (distance(vCutW, uCam.xyz) < uCam.w) discard;')
  }
  chainKey(mat, 'cameraCut')
  return mat
}
