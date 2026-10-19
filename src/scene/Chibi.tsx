import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import type { Mood } from '../core/villagers'
import { Batch, Merge, mul, shape, useMerged, xf, type Merged } from './batching'
import type { DesignLayer } from './designPixels'
import { Part, casts } from './toon'

/** 2등신 캐릭터. 플레이어와 주민이 같이 쓴다. */

export interface Look {
  skin: string
  outfit: string
  /** 옷 앞판에 붙이는 그림(마이 디자인)의 색별 기하. 없으면 무늬 없는 옷이다. */
  print?: DesignLayer[] | null
  ears?: 'cat' | 'rabbit' | 'round' | 'bear' | 'droop' | 'lop'
  hair?: string
  /** 펭귄처럼 얼굴 앞쪽만 다른 색 */
  mask?: string
  beak?: string
  belly?: string
  earInner?: string
  /** 두더지처럼 크고 동그란 분홍 코 */
  snout?: string
  /** 고슴도치 가시 색 */
  spikes?: string
  /** 머리 위 솜털 뭉치 색(구 몇 개) */
  tuft?: string
  /** 정수리에 솟은 작은 잎 새싹 색 */
  sprout?: string
  /** 밤송이처럼 머리를 덮은 가시 후드 색. 작은 원뿔 가시가 사방으로 난다. */
  burr?: string
  /** 머리 위 줄무늬 색(태비) */
  stripes?: string
  /** 몸통을 가로로 두른 줄무늬 색 */
  bands?: string
  /** 입 주변만 둥글게 덮은 흰 주둥이 색 */
  muzzle?: string
  /** 통통한 볼. 볼을 부풀리는 자세(Pose.cheek)에서 커진다. */
  cheeks?: boolean
  /** 몸통 아랫부분 색(반구). 위는 outfit 색이다. */
  hem?: string
  /** 목둘레 줄과 달린 작은 장식. shape 에 따라 방울·조개·잎 모양이다. */
  collar?: { band: string; charm: string; shape: 'bell' | 'shell' | 'leaf' }
  /** 다리 색. 없으면 옷을 입었으면 바지색, 아니면 몸 색 */
  legs?: string
  /** 등 뒤 복슬복슬한 꼬리 색 */
  tail?: string
  /** 밤톨처럼 머리 위를 덮는 껍질 색 */
  shell?: string
  /** 외칠 때 벌리는 입 모양. plain 이면 혀 없이 까만 입이다. */
  mouth?: 'plain'
  /** 눈 크기 배율. 크면 하이라이트를 하나 더 넣어 반짝인다. */
  eyeScale?: number
  /** 엉덩이에 붙은 작고 동그란 꼬리 */
  puff?: string
  /** 몸 전체 크기 배율 */
  size?: number
  /** 쓰고 있는 모자(옷장 id) */
  hat?: string | null
}

/** 도구 동작이 걷기 모션을 덮어쓸 때 쓰는 값 */
export interface Pose {
  armL?: number
  /** 왼팔을 몸 바깥으로 벌린다(라디안). 정면 카메라에서 V자처럼 보이게 한다. */
  armLz?: number
  lean?: number
  jitter?: number
  hop?: number
  /** 오른팔 회전. 손에 든 도구가 없는 주민이 컵을 들거나 칼을 휘두를 때 쓴다. */
  armR?: number
  /** 오른팔을 몸 바깥으로 벌린다(라디안) */
  armRz?: number
  /** 의자에 앉은 정도(0~1). 다리를 앞으로 뻗는다. */
  sit?: number
  /** 침대에 누운 정도(0~1). 1 이면 등을 대고 눕는다. */
  lie?: number
  /** 옆으로 누운 각(라디안, 몸통을 z 축으로 돌린다). 침대 위 주민이 머리를 한쪽에 두고 눕는 자세다. */
  lieSide?: number
  /** 볼을 부풀린 정도(0~1). 볼이 빵빵해지는 몸짓에 쓴다. */
  cheek?: number
}

export interface Motion {
  moving: boolean
  /** 걷기 속도 배율(달리면 커진다) */
  pace: number
  talking: boolean
  /** 신나서 들뜬 정도(0~1). 귀를 파닥인다. */
  hype?: number
  /** 지금 표정. 기쁘면 ^^ 눈, 놀라면 큰 눈과 o 입, 시무룩하면 처진 눈과 눈썹 */
  mood?: Mood
  /** 말하는 중이라 입을 뻐끔거린다 */
  speaking?: boolean
}

interface Props {
  look: Look
  motion: () => Motion
  /** 오른손에 들 물건 */
  handRef?: RefObject<THREE.Group | null>
  pose?: () => Pose | null
  children?: ReactNode
  seed?: number
}

/** 고슴도치 가시: 머리 뒤쪽 반구 위 점들. 각 가시는 그 점의 바깥(법선) 방향을 본다. */
const SPIKES = (
  [
    [0, 0.75], [0.6, 0.6], [-0.6, 0.6], [0.3, 1.1], [-0.3, 1.1], [0.9, 0.95], [-0.9, 0.95], [0, 1.35], [0.55, 1.45], [-0.55, 1.45],
  ] as [number, number][]
).map(([a, b]) => {
  const n = new THREE.Vector3(Math.sin(b) * Math.sin(a), Math.cos(b), -Math.sin(b) * Math.cos(a))
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n))
  return { pos: n.clone().multiplyScalar(0.42).toArray() as V3, rot: [e.x, e.y, e.z] as V3 }
})

type V3 = [number, number, number]
const PI = Math.PI
const INK = '#2b2018'
const SPHERE = THREE.SphereGeometry
const CONE = THREE.ConeGeometry
const CAPSULE = THREE.CapsuleGeometry
const TORUS = THREE.TorusGeometry
const BOX = THREE.BoxGeometry
const CYL = THREE.CylinderGeometry

/** 구 겉면의 한 점(방위각 a, 극각 b)에서 바깥을 보는 위치와 회전. 머리 위 가시·줄무늬를 놓을 때 쓴다. */
function onSphere(a: number, b: number, r: number): { pos: V3; rot: V3 } {
  const n = new THREE.Vector3(Math.sin(b) * Math.sin(a), Math.cos(b), -Math.sin(b) * Math.cos(a))
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n))
  return { pos: n.multiplyScalar(r).toArray() as V3, rot: [e.x, e.y, e.z] as V3 }
}
/** 밤송이 가시: 정수리에서 옆까지 세 줄로 둘러 난다 */
const BURR_SPIKES = [0.45, 0.95, 1.3].flatMap((b, row) => Array.from({ length: 8 }, (_, i) => onSphere((i / 8) * PI * 2 + row * 0.4, b, 0.44)))

/**
 * Part 한 개를 묶음에 넣는다. base 는 부모 그룹의 행렬이다. 그림자 여부와 테두리 배율은 Part 와 같은 규칙을 쓴다.
 * 조각마다 메시를 따로 두면 그리기 호출이 두세 배로 늘어, 움직이지 않는 머리·몸 조각은 한 지오메트리로 굳힌다.
 */
function part(b: Batch, g: THREE.BufferGeometry, color: string, p: V3, r: V3, s: V3 | number, outline: number, base?: THREE.Matrix4) {
  const m = base ? mul(base, xf(p, r, s)) : xf(p, r, s)
  b.add(g, m, color, { outline, cast: casts(g, s) })
}
/** 일반 메시(Part 아님): 테두리 없이 그림자도 드리우지 않는다. */
function plain(b: Batch, g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) {
  b.add(g, m, color, { cast: false })
}
/** 빛을 받지 않는 얼굴 선·눈·입. */
function ink(b: Batch, g: THREE.BufferGeometry, color: string, m: THREE.Matrix4) {
  b.add(g, m, color, { unlit: true })
}

/** 한 번 만들어 모든 주민이 같이 쓰는 묶음(얼굴 표정 조각처럼 모양이 같은 것). 지우지 않는다. */
const fixed = new Map<string, Merged>()
function once(key: string, build: (b: Batch) => void): Merged {
  let g = fixed.get(key)
  if (!g) {
    const b = new Batch()
    build(b)
    fixed.set(key, (g = b.finish()))
  }
  return g
}

/** 얼굴 밖 머리 조각: 머리 구, 껍질, 귀, 가시, 코·부리, 고정 눈썹·볼선. 머리와 함께 움직인다. */
function buildHead(b: Batch, look: Look) {
  part(b, shape(SPHERE, 0.46, 24, 18), look.skin, [0, 0, 0], [0, 0, 0], [1.14, 0.95, 1.02], 0.06)
  if (look.shell) {
    // 밤 껍질: 정수리를 덮는 반구와 뾰족한 꼭지
    const base = xf([0, 0.06, -0.01])
    part(b, shape(SPHERE, 0.47, 22, 14, 0, PI * 2, 0, PI * 0.42), look.shell, [0, 0, 0], [0, 0, 0], [1.17, 0.85, 1.06], 0.04, base)
    part(b, shape(CONE, 0.09, 0.16, 10), look.shell, [0, 0.42, 0], [0, 0, 0], 1, 0.1, base)
  }
  if (look.burr) {
    // 밤송이 후드: 정수리를 덮는 초록 반구와 그 위로 난 짧은 가시
    part(b, shape(SPHERE, 0.475, 22, 14, 0, PI * 2, 0, PI * 0.46), look.burr, [0, 0.02, 0], [0, 0, 0], [1.16, 0.9, 1.07], 0.05)
    for (const sp of BURR_SPIKES) part(b, shape(CONE, 0.06, 0.26, 5), look.burr, sp.pos, sp.rot, 1, 0.07)
  }
  if (look.mask) part(b, shape(SPHERE, 0.4, 20, 14), look.mask, [0, -0.06, 0.18], [0, 0, 0], [0.9, 0.75, 0.7], 0)
  if (look.hair) part(b, shape(SPHERE, 0.46, 20, 14, 0, PI * 2, 0, PI * 0.62), look.hair, [0, 0.12, -0.05], [0, 0, 0], [1.12, 0.78, 1.08], 0.04)
  if (look.tuft)
    // 솜털 뭉치: 정수리에 구 세 개가 몽글몽글 붙어 있다
    for (const [x, y, z, r] of [[-0.14, 0.4, 0.03, 0.12], [0.14, 0.4, 0.03, 0.12], [0, 0.46, -0.04, 0.14]] as [number, number, number, number][])
      part(b, shape(SPHERE, r, 12, 10), look.tuft, [x, y, z], [0, 0, 0], 1, 0.06)
  if (look.sprout) {
    // 정수리의 줄기와 두 장의 잎
    part(b, shape(CYL, 0.012, 0.018, 0.16, 5), look.sprout, [0, 0.5, 0], [0, 0, 0], 1, 0.06)
    for (const sd of [-1, 1]) part(b, shape(SPHERE, 0.08, 10, 8), look.sprout, [sd * 0.08, 0.6, 0], [0, 0, -sd * 0.6], [1.3, 0.35, 0.8], 0.08)
  }
  if (look.stripes)
    // 태비 무늬: 정수리에 앞뒤로 긴 줄 세 개
    for (const a of [-0.45, 0, 0.45]) {
      const sp = onSphere(a, 0.5, 0.47)
      part(b, shape(BOX, 0.05, 0.03, 0.2), look.stripes, sp.pos, sp.rot, 1, 0)
    }
  if (look.ears === 'cat')
    for (const s of [-1, 1]) part(b, shape(CONE, 0.14, 0.26, 4), look.skin, [s * 0.28, 0.4, 0], [0, 0, -s * 0.35], 1, 0.08)
  if (look.ears === 'rabbit')
    for (const s of [-1, 1]) {
      const base = xf([s * 0.16, 0.5, -0.02], [0, 0, -s * 0.15])
      part(b, shape(CAPSULE, 0.09, 0.38, 4, 10), look.skin, [0, 0.2, 0], [0, 0, 0], 1, 0.08, base)
      plain(b, shape(CAPSULE, 0.09, 0.38, 4, 10), look.earInner ?? '#ffb3c1', mul(base, xf([0, 0.2, 0.06], [0, 0, 0], [0.55, 0.85, 0.4])))
    }
  if (look.ears === 'bear')
    for (const s of [-1, 1]) part(b, shape(SPHERE, 0.1, 12, 10), look.skin, [s * 0.27, 0.36, -0.02], [0, 0, 0], [1, 1, 0.6], 0.1)
  if (look.ears === 'droop')
    // 조금 큰 곰 귀의 끝이 아래로 살짝 처진다
    for (const s of [-1, 1]) {
      part(b, shape(SPHERE, 0.12, 12, 10), look.earInner ?? look.skin, [s * 0.3, 0.36, -0.02], [0, 0, 0], [1, 0.95, 0.6], 0.08)
      part(b, shape(SPHERE, 0.07, 10, 8), look.earInner ?? look.skin, [s * 0.36, 0.22, -0.03], [0, 0, 0], [1, 1.2, 0.6], 0.08)
    }
  if (look.ears === 'round')
    for (const s of [-1, 1]) part(b, shape(SPHERE, 0.1, 10, 8), look.skin, [s * 0.33, 0.3, -0.05], [0, 0, 0], [1, 1, 0.5], 0.1)
  if (look.spikes) {
    // 머리 뒤쪽에 동그랗게 둘러 난 가시
    const base = xf([0, 0.05, -0.1])
    for (const sp of SPIKES) part(b, shape(CONE, 0.1, 0.32, 6), look.spikes, sp.pos, sp.rot, 1, 0.08, base)
  }
  if (look.muzzle) part(b, shape(SPHERE, 0.16, 14, 10), look.muzzle, [0, -0.11, 0.36], [0, 0, 0], [1.1, 0.9, 0.6], 0.04)
  if (look.snout) part(b, shape(SPHERE, 0.1, 12, 10), look.snout, [0, -0.08, 0.43], [0, 0, 0], [1.2, 0.9, 0.9], 0.08)
  else if (look.beak) part(b, shape(CONE, 0.07, 0.16, 8), look.beak, [0, -0.08, 0.45], [PI / 2, 0, 0], 1, 0.1)
}

/** 통통한 볼 한 쪽: 원점에 그려 두고 볼 그룹이 원점 기준으로 부풀린다. */
function buildCheek(b: Batch, look: Look) {
  part(b, shape(SPHERE, 0.12, 12, 10), look.skin, [0, 0, 0], [0, 0, 0], [1, 0.95, 0.9], 0.06)
}

/** 모자: 머리 그룹 기준. 모자 종류가 바뀔 때만 다시 굳힌다. */
function buildHat(b: Batch, id: string | null | undefined) {
  switch (id) {
    case 'straw-hat': {
      const base = xf([0, 0.3, -0.02], [-0.12, 0, 0])
      part(b, shape(CYL, 0.66, 0.68, 0.04, 28), '#f2d38a', [0, 0, 0], [0, 0, 0], 1, 0.04, base)
      part(b, shape(CYL, 0.32, 0.37, 0.24, 22), '#f2d38a', [0, 0.13, 0], [0, 0, 0], 1, 0.05, base)
      plain(b, shape(CYL, 0.375, 0.375, 0.07, 22), '#e46a52', mul(base, xf([0, 0.06, 0])))
      break
    }
    case 'beanie': {
      const base = xf([0, 0.12, -0.02])
      part(b, shape(SPHERE, 0.49, 22, 14, 0, PI * 2, 0, PI * 0.5), '#e46a52', [0, 0, 0], [0, 0, 0], [1.08, 0.82, 1.05], 0.04, base)
      plain(b, shape(TORUS, 0.49, 0.06, 8, 26), '#fdf6e3', mul(base, xf([0, 0, 0], [PI / 2, 0, 0], [1.08, 1.05, 1])))
      part(b, shape(SPHERE, 0.12, 12, 10), '#fdf6e3', [0, 0.45, 0], [0, 0, 0], 1, 0.08, base)
      break
    }
    case 'cap': {
      const base = xf([0, 0.14, 0])
      part(b, shape(SPHERE, 0.48, 22, 14, 0, PI * 2, 0, PI * 0.5), '#3f6fb5', [0, 0, 0], [0, 0, 0], [1.07, 0.75, 1.05], 0.04, base)
      part(b, shape(CYL, 0.3, 0.3, 0.035, 18, 1, false, -PI / 2, PI), '#3f6fb5', [0, 0.02, 0.48], [0.12, 0, 0], [1, 1, 0.75], 0.06, base)
      part(b, shape(SPHERE, 0.05, 8, 6), '#fdf6e3', [0, 0.37, 0], [0, 0, 0], 1, 0.1, base)
      break
    }
    case 'flower-crown': {
      const base = xf([0, 0.33, -0.02], [-0.1, 0, 0])
      plain(b, shape(TORUS, 0.36, 0.04, 6, 24), '#6cc26a', mul(base, xf([0, 0, 0], [PI / 2, 0, 0])))
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2
        part(b, shape(SPHERE, 0.075, 10, 8), ['#ff9fb5', '#ffd166', '#ffffff', '#b8c0ff'][i % 4], [Math.sin(a) * 0.36, 0.04, Math.cos(a) * 0.36], [0, 0, 0], 1, 0.1, base)
      }
      break
    }
    case 'acorn-hat': {
      const base = xf([0, 0.16, -0.02])
      part(b, shape(SPHERE, 0.5, 22, 14, 0, PI * 2, 0, PI * 0.5), '#8a5a3b', [0, 0, 0], [0, 0, 0], [1.1, 0.72, 1.08], 0.04, base)
      plain(b, shape(TORUS, 0.5, 0.05, 6, 26), '#6b4528', mul(base, xf([0, 0, 0], [PI / 2, 0, 0], [1.1, 1.08, 1])))
      part(b, shape(CYL, 0.035, 0.05, 0.18, 6), '#6b4528', [0.03, 0.42, 0], [0, 0, -0.3], 1, 0.1, base)
      break
    }
  }
}

/** 몸통 조각: 옷 몸통·배·꼬리·엉덩이 방울·줄무늬·목걸이. 몸 그룹과 함께 움직이므로 한 묶음이다. */
function buildBody(b: Batch, look: Look) {
  part(b, shape(SPHERE, 0.3, 18, 14), look.outfit, [0, 0.5, 0], [0, 0, 0], [1.08, 1, 0.95], 0.06)
  if (look.hem) part(b, shape(SPHERE, 0.31, 18, 14, 0, PI * 2, PI * 0.5, PI * 0.5), look.hem, [0, 0.5, 0], [0, 0, 0], [1.08, 1, 0.95], 0.04)
  if (look.belly) part(b, shape(SPHERE, 0.26, 16, 12), look.belly, [0, 0.48, 0.14], [0, 0, 0], [0.8, 0.9, 0.5], 0)
  if (look.puff) part(b, shape(SPHERE, 0.09, 12, 10), look.puff, [0, 0.32, -0.3], [0, 0, 0], 1, 0.08)
  if (look.tail) part(b, shape(SPHERE, 0.22, 14, 12), look.tail, [0, 0.55, -0.34], [-0.5, 0, 0], [0.9, 1.3, 0.8], 0.05)
  if (look.bands)
    // 몸통을 가로로 두른 줄 세 개(구의 적도 근처일수록 넓다)
    for (const y of [0.42, 0.5, 0.58]) part(b, shape(TORUS, 0.3 * Math.sqrt(1 - ((y - 0.5) / 0.3) ** 2) + 0.01, 0.018, 6, 30), look.bands, [0, y, 0], [PI / 2, 0, 0], 1, 0)
  if (look.collar) {
    const { band, charm, shape: kind } = look.collar
    part(b, shape(TORUS, 0.27, 0.03, 6, 28), band, [0, 0.68, 0], [PI / 2, 0, 0], 1, 0.05)
    const sc: V3 = kind === 'bell' ? [1, 1, 1] : kind === 'shell' ? [1.25, 0.8, 0.5] : [0.8, 1.3, 0.3]
    part(b, shape(SPHERE, 0.06, 10, 8), charm, [0, 0.6, 0.3], [0, 0, kind === 'leaf' ? -0.5 : 0], sc, 0.06)
  }
}

/** 두 눈: 눈 크기 배율마다 한 번만 굳힌다. 눈 그룹이 깜빡이며 scale 을 바꾼다. */
function buildEyes(b: Batch, eyeScale: number) {
  for (const x of [-0.17, 0.17]) {
    const e = xf([x, 0, 0], [0, x * 1.6, 0], eyeScale)
    ink(b, shape(SPHERE, 0.062, 12, 10), INK, mul(e, xf([0, 0, 0], [0, 0, 0], [0.85, 1, 0.5])))
    ink(b, shape(SPHERE, 0.019, 8, 6), '#ffffff', mul(e, xf([0.018, 0.024, 0.03])))
    if (eyeScale > 1) ink(b, shape(SPHERE, 0.01, 6, 5), '#ffffff', mul(e, xf([-0.02, -0.022, 0.03])))
  }
}

/** 기쁜 눈 ^ ^ */
function buildHappy(b: Batch) {
  for (const x of [-0.17, 0.17]) ink(b, shape(TORUS, 0.045, 0.013, 5, 12, PI), INK, xf([x, -0.02, 0], [0, x * 1.6, 0]))
}

/** 시무룩 눈썹 八 자 */
function buildBrows(b: Batch) {
  for (const sd of [-1, 1]) ink(b, shape(BOX, 0.11, 0.024, 0.012), INK, xf([sd * 0.15, 0.085, 0.44], [-0.15, sd * 0.32, sd * -0.4]))
}

/** 볼터치: 크고 진한 분홍. 머리 안에서 반투명하게 그린다. */
function buildBlush(b: Batch) {
  for (const x of [-0.29, 0.29]) ink(b, shape(SPHERE, 0.088, 12, 8), '#ffa3b6', xf([x, -0.12, 0.362], [0, x * 1.8, 0], [1, 0.62, 0.3]))
}

/** 벌린 입: 까만 타원 안에 분홍 혀(tongue 이 false 면 혀 없이 까만 입) */
function buildOpenMouth(b: Batch, tongue: boolean) {
  ink(b, shape(SPHERE, 0.06, 14, 10), '#3b1f1a', xf([0, 0, 0], [0, 0, 0], [1.25, 0.9, 0.35]))
  if (tongue) ink(b, shape(SPHERE, 0.045, 12, 8), '#ff8fa3', xf([0, -0.025, 0.014], [0, 0, 0], [1, 0.55, 0.3]))
}

/** 작은 ω 입 */
function buildIdleMouth(b: Batch) {
  for (const x of [-0.022, 0.022]) ink(b, shape(TORUS, 0.022, 0.007, 4, 10, PI), INK, xf([x, 0, 0], [0, 0, PI]))
}

const blushMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })

export function Chibi({ look, motion, handRef, pose, children, seed = 0 }: Props) {
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const happyEyes = useRef<THREE.Group>(null)
  const brows = useRef<THREE.Group>(null)
  const mouthIdle = useRef<THREE.Group>(null)
  const mouthOpen = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const earL = useRef<THREE.Group>(null)
  const earR = useRef<THREE.Group>(null)
  const cheekL = useRef<THREE.Group>(null)
  const cheekR = useRef<THREE.Group>(null)

  // 머리·몸·모자는 주민 외형이 바뀔 때만 굳힌다. 얼굴 표정 조각은 모든 주민이 같이 쓴다.
  const headKey = [look.skin, look.ears, look.hair, look.mask, look.beak, look.shell, look.burr, look.snout, look.spikes, look.earInner, look.tuft, look.sprout, look.stripes, look.muzzle].join('|')
  const headG = useMerged((b) => buildHead(b, look), [headKey])
  const bodyKey = [look.outfit, look.belly, look.puff, look.tail, look.hem, look.bands, look.collar ? [look.collar.band, look.collar.charm, look.collar.shape].join(',') : ''].join('|')
  const bodyG = useMerged((b) => buildBody(b, look), [bodyKey])
  const cheekG = useMerged((b) => buildCheek(b, look), [look.skin])
  const hatG = useMerged((b) => buildHat(b, look.hat), [look.hat])
  const eyeG = once(`eyes${look.eyeScale ?? 1}`, (b) => buildEyes(b, look.eyeScale ?? 1))
  const happyG = once('happy', buildHappy)
  const browG = once('brows', buildBrows)
  const blushG = once('blush', buildBlush)
  const openG = once(look.mouth === 'plain' ? 'mouth-plain' : 'mouth-open', (b) => buildOpenMouth(b, look.mouth !== 'plain'))
  const idleG = once('mouth-idle', buildIdleMouth)

  useFrame((state, delta) => {
    const m = motion()
    const t = state.clock.elapsedTime + seed
    phase.current += delta * (m.moving ? 11 * m.pace : 0)
    const ph = phase.current

    // 걸을 때 통통 튀고, 착지할 때 살짝 눌린다(스쿼시 & 스트레치).
    const hop = m.moving ? Math.abs(Math.sin(ph)) : 0
    const squash = m.moving ? 1 + (hop - 0.5) * 0.12 : 1 + Math.sin(t * 2.2) * 0.02
    if (body.current) {
      body.current.position.y = hop * 0.14
      body.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
      body.current.rotation.z = m.moving ? Math.sin(ph) * 0.06 : 0
    }
    if (head.current) {
      head.current.rotation.x = m.talking ? Math.sin(t * 9) * 0.08 : m.moving ? 0.05 : Math.sin(t * 1.3) * 0.03
      head.current.rotation.z = m.moving ? 0 : Math.sin(t * 0.9) * 0.05
    }
    const swing = m.moving ? Math.sin(ph) * 0.8 : 0
    const ps = pose?.()
    if (armL.current) {
      armL.current.rotation.x = ps?.armL ?? swing
      armL.current.rotation.z = ps?.armLz ?? 0
    }
    if (body.current) {
      // 누우면 몸통을 등 쪽으로 눕힌다(머리는 뒷벽 쪽, 얼굴은 위를 본다).
      body.current.rotation.x = ps?.lie ? -(Math.PI / 2) * ps.lie : (ps?.lean ?? 0)
      if (ps?.lieSide) body.current.rotation.z = ps.lieSide
      body.current.position.x = ps?.jitter ?? 0
      body.current.position.y += ps?.hop ?? 0
    }
    if (armR.current && !handRef) {
      armR.current.rotation.x = ps?.armR ?? -swing
      armR.current.rotation.z = ps?.armRz ?? 0
    }
    // 볼 부풀리기: 각 볼을 자기 중심에서 키운다
    const puff = 1 + 0.55 * (ps?.cheek ?? 0)
    cheekL.current?.scale.setScalar(puff)
    cheekR.current?.scale.setScalar(puff)
    const sit = ps?.sit ?? 0
    if (legL.current) legL.current.rotation.x = sit ? -1.4 * sit + Math.sin(t * 2.5) * 0.12 * sit : -swing * 0.9
    if (legR.current) legR.current.rotation.x = sit ? -1.4 * sit - Math.sin(t * 2.5) * 0.12 * sit : swing * 0.9

    // 긴 귀: 가끔 한쪽만 쫑긋 접혔다 펴지고, 신나면 양쪽을 파닥인다.
    if (earL.current && earR.current) {
      const hype = m.hype ?? 0
      if (look.ears === 'lop') {
        // 늘어진 귀: 아래로 처진 채 살랑이고, 신나면 파닥인다.
        const droop = PI - 0.85
        earL.current.rotation.z = droop + Math.sin(t * 1.1 + seed) * 0.05 + Math.sin(t * 22) * 0.25 * hype
        earR.current.rotation.z = -droop - Math.sin(t * 1.1 + seed + 1) * 0.05 - Math.sin(t * 22 + 1) * 0.25 * hype
      } else {
        const flick = (k: number) => Math.max(0, Math.sin(t * 0.9 + k) - 0.93) * 9
        earL.current.rotation.z = 0.12 + flick(seed) * 0.5 + Math.sin(t * 22) * 0.35 * hype
        earR.current.rotation.z = -0.12 - flick(seed + 2.1) * 0.5 - Math.sin(t * 22 + 1) * 0.35 * hype
      }
      earL.current.rotation.x = Math.sin(ph) * 0.12
      earR.current.rotation.x = Math.sin(ph + 0.5) * 0.12
    }
    // 3~4초마다 한 번 깜빡인다.
    const blink = (t * 0.3 + seed * 0.1) % 1 < 0.04
    const mood = m.mood ?? 'calm'
    const wide = mood === 'surprised' ? 1.25 : 1
    // 누우면 눈을 감는다. 감은 눈은 웃는 눈(^^) 모양으로 그린다.
    const asleep = !!ps?.lie || !!ps?.lieSide
    if (eyes.current) {
      eyes.current.visible = !asleep && mood !== 'happy'
      eyes.current.scale.set(wide, blink ? 0.12 : mood === 'sad' ? 0.62 : wide, 1)
    }
    if (happyEyes.current) happyEyes.current.visible = asleep || mood === 'happy'
    if (brows.current) brows.current.visible = mood === 'sad'
    // 말할 땐 입이 열렸다 닫혔다, 놀라면 동그랗게 벌린 채 굳는다.
    const flap = m.speaking ? Math.abs(Math.sin(t * 13)) : 0
    if (mouthOpen.current) {
      const open = mood === 'surprised' || flap > 0.3
      mouthOpen.current.visible = open
      if (mood === 'surprised') mouthOpen.current.scale.set(0.75, 1.35, 1)
      else mouthOpen.current.scale.set(1, 0.45 + flap * 0.65, 1)
      if (mouthIdle.current) mouthIdle.current.visible = !open
    }
  })

  const ear = look.ears
  return (
    <group ref={body}>
      {/* 다리: 각자 따로 흔들리므로 다리마다 한 조각씩 둔다 */}
      {[-0.13, 0.13].map((x, i) => (
        <group key={x} ref={i === 0 ? legL : legR} position={[x, 0.28, 0]}>
          <Part color={look.legs ?? (look.outfit === look.skin ? look.skin : '#5b4a6a')} position={[0, -0.12, 0]} outline={0.1}>
            <capsuleGeometry args={[0.08, 0.12, 4, 8]} />
          </Part>
        </group>
      ))}
      {/* 몸통·배·꼬리·엉덩이 방울: 몸 그룹과 함께 움직이므로 한 묶음 */}
      <Merge g={bodyG} />
      {look.print && (
        <group position={[0, 0.5, 0.292]}>
          {look.print.map((l) => (
            <mesh key={l.color} geometry={l.geo}>
              <meshBasicMaterial color={l.color} toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
      {/* 팔: 각자 흔들리고 도구를 들므로 따로 둔다 */}
      <group ref={armL} position={[-0.3, 0.62, 0]}>
        <Part color={look.skin} position={[-0.04, -0.14, 0]} outline={0.1}>
          <capsuleGeometry args={[0.045, 0.14, 4, 8]} />
        </Part>
        <Part color={look.skin} position={[-0.04, -0.3, 0]} outline={0.1}>
          <sphereGeometry args={[0.085, 10, 8]} />
        </Part>
      </group>
      <group ref={handRef ?? armR} position={[0.3, 0.62, 0]}>
        <Part color={look.skin} position={[0.04, -0.14, 0]} outline={0.1}>
          <capsuleGeometry args={[0.045, 0.14, 4, 8]} />
        </Part>
        <Part color={look.skin} position={[0.04, -0.3, 0]} outline={0.1}>
          <sphereGeometry args={[0.085, 10, 8]} />
        </Part>
        <group position={[0.04, -0.3, 0.04]}>{children}</group>
      </group>

      {/* 머리 */}
      <group ref={head} position={[0, 1.08, 0]}>
        {/* 움직이지 않는 머리 조각(구·껍질·귀·가시·코·고정 선)은 한 묶음 */}
        <Merge g={headG} />
        <Merge g={hatG} />
        {ear === 'lop' &&
          // 긴 귀가 옆으로 늘어져 아래를 향한다. 머리 옆 위쪽을 축으로 흔든다.
          ([-1, 1] as const).map((s) => (
            <group key={s} ref={s < 0 ? earL : earR} position={[s * 0.3, 0.38, -0.02]}>
              <Part color={look.skin} position={[0, 0.26, 0]} outline={0.07}>
                <capsuleGeometry args={[0.06, 0.42, 4, 10]} />
              </Part>
            </group>
          ))}
        {/* 볼: 통통한 주민만 가진다. 볼을 부풀릴 때 커진다. */}
        {look.cheeks &&
          ([-1, 1] as const).map((s) => (
            <group key={s} ref={s < 0 ? cheekL : cheekR} position={[s * 0.3, -0.15, 0.27]}>
              <Merge g={cheekG} />
            </group>
          ))}
        {/* 눈: 얼굴 아래쪽에 넓게 벌어진 작은 까만 알 + 반짝 하이라이트 */}
        <group ref={eyes} position={[0, -0.02, 0.432]}>
          <Merge g={eyeG} />
        </group>
        {/* 기쁜 눈: 위로 둥근 ^ ^ */}
        <group ref={happyEyes} position={[0, -0.01, 0.44]} visible={false}>
          <Merge g={happyG} />
        </group>
        {/* 시무룩 눈썹: 눈 바로 위에서 안쪽 끝이 올라간 八 자 */}
        <group ref={brows} visible={false}>
          <Merge g={browG} />
        </group>
        {/* 볼터치 */}
        {blushG.unlit && <mesh geometry={blushG.unlit} material={blushMat} />}
        {!look.snout && !look.beak && (
          <>
            {/* 벌린 입: 말하거나 놀랄 때만 연다. */}
            <group ref={mouthOpen} position={[0, -0.13, 0.448]} rotation-x={-0.2} visible={false}>
              <Merge g={openG} />
            </group>
            {/* 작은 ω 입 */}
            <group ref={mouthIdle} position={[0, -0.12, 0.452]} rotation-x={-0.25}>
              <Merge g={idleG} />
            </group>
          </>
        )}
      </group>
    </group>
  )
}
