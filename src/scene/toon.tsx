import { Children, createContext, isValidElement, useContext, type ReactElement, type ReactNode } from 'react'
import * as THREE from 'three'
import { mixHex, type Variant } from '../core/reform'

/** 3단 명암 셀 셰이딩. 모든 둥근 모델이 같은 단계를 써야 한 세계처럼 보인다. */
export const gradient = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
})()

export const OUTLINE = '#3b2a20'

/** 테두리 껍데기 재질은 모든 Part 가 함께 쓴다. 색·면 설정이 같고 아무도 바꾸지 않으므로 공유해도 안전하다. */
export const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide })

/** 같은 모양의 지오메트리는 한 번만 만든다. 나무·꽃·잎처럼 수백 번 복제되는 것들이 버퍼를 공유한다. */
const geoCache = new Map<string, THREE.BufferGeometry>()

/** 자식이 `<sphereGeometry args={...} />` 한 개뿐이면 캐시된 지오메트리를 돌려준다. 그 밖은 null(자식 그대로 그린다). */
function sharedGeometry(children: ReactNode): THREE.BufferGeometry | null {
  const kids = Children.toArray(children)
  if (kids.length !== 1 || !isValidElement(kids[0])) return null
  const el = kids[0] as ReactElement<{ args?: unknown[] }>
  const type = el.type
  if (typeof type !== 'string' || !type.endsWith('Geometry')) return null
  if (Object.keys(el.props).some((k) => k !== 'args')) return null
  const args = el.props.args ?? []
  const key = type + JSON.stringify(args)
  let g = geoCache.get(key)
  if (!g) {
    const Ctor = (THREE as unknown as Record<string, new (...a: unknown[]) => THREE.BufferGeometry>)[type[0].toUpperCase() + type.slice(1)]
    g = new Ctor(...args)
    geoCache.set(key, g)
  }
  return g
}

/** 그림자를 드리울 만큼 큰지. 그림자 맵(44칸에 2048px)에서 반지름 0.22 아래 조각(작은 돌·풀꽃·버섯)은 그림자 모양이 거의 안 보이고 그림자 패스 draw call 만 늘리므로 생략한다. */
const SHADOW_MIN_R = 0.22

export function casts(geo: THREE.BufferGeometry, scale: Vec3 | number | undefined): boolean {
  return radiusOf(geo, scale) >= SHADOW_MIN_R
}

/** 테두리(뒤집은 껍데기)를 그릴 만큼 큰지. 반지름 0.2 아래 작은 조각은 테두리가 한두 픽셀이라 생략해 그리기 호출을 줄인다. */
const OUTLINE_MIN_R = 0.2

function radiusOf(geo: THREE.BufferGeometry, scale: Vec3 | number | undefined): number {
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  const s = scale === undefined ? 1 : typeof scale === 'number' ? scale : Math.max(...scale)
  return geo.boundingSphere!.radius * s
}

/** 한 번 놓고 움직이지 않는 가지(돌·그루터기·통나무·다리·부두)에 붙인다. 행렬을 한 번만 계산하고 매 프레임 재계산을 끈다.
 * 흔들리거나 맞아서 움직이는 것, 집처럼 스케일을 애니메이션하는 것엔 쓰지 않는다. */
export function freeze(o: THREE.Object3D | null) {
  o?.traverse((c) => {
    c.updateMatrix()
    c.matrixAutoUpdate = false
  })
}

/** 리폼한 가구 안에서만 켜지는 색 변형. 아래 Toon 이 원래 색을 이 변형 색 쪽으로 섞는다. 바깥에서는 null 이라 색이 그대로다. */
export const TintContext = createContext<Variant | null>(null)

export function Toon({ color, emissive, transparent, opacity }: { color: string; emissive?: string; transparent?: boolean; opacity?: number }) {
  const tint = useContext(TintContext)
  const shade = tint && /^#[0-9a-f]{6}$/i.test(color) ? mixHex(color, tint.color, tint.mix) : color
  return (
    <meshToonMaterial
      color={shade}
      gradientMap={gradient}
      emissive={emissive ?? tint?.emissive ?? '#000000'}
      transparent={transparent}
      opacity={opacity ?? 1}
    />
  )
}

type Vec3 = [number, number, number]

interface PartProps {
  color: string
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3 | number
  /** 테두리 두께(배율). 0 이면 테두리 없음 */
  outline?: number
  /** 그림자를 드리울지. 생략하면 크기로 정한다(작으면 안 드리움). 얇은 가로대처럼 그림자가 거의 안 보이는 것은 끈다. */
  cast?: boolean
  children: ReactNode
}

/**
 * 셀 셰이딩 메시 + 뒤집은 껍데기 테두리. 지오메트리는 children 으로 받아 두 메시가 같이 쓴다.
 * 볼록한 모양에서만 테두리가 깔끔하다. 단순 기하면 캐시된 지오메트리를 공유한다.
 * 몸체 재질은 페이드(occlusion)가 건드리므로 Part 마다 따로 둔다.
 */
export function Part({ color, position, rotation, scale, outline = 0.06, cast, children }: PartProps) {
  const shared = sharedGeometry(children)
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow={cast ?? (shared ? casts(shared, scale) : true)} geometry={shared ?? undefined}>
        {shared ? null : children}
        <Toon color={color} />
      </mesh>
      {outline > 0 && (!shared || radiusOf(shared, scale) >= OUTLINE_MIN_R) && (
        <mesh scale={1 + outline} geometry={shared ?? undefined} material={outlineMat}>
          {shared ? null : children}
        </mesh>
      )}
    </group>
  )
}
