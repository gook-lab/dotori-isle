import { useEffect, useMemo, type DependencyList } from 'react'
import * as THREE from 'three'
import { gradient, outlineMat } from './toon'

/**
 * 조각(Part·단순 메시)을 재질별로 한 지오메트리에 굳혀 드로콜을 줄인다.
 * 색은 정점 색으로 싣고, 테두리 껍데기는 조각마다 Part 와 같은 배율로 미리 키운 뒤 한 덩어리로 합친다.
 * 삼각형과 셰이딩은 Part 로 그린 것과 같다. 흔들리거나 페이드되는 묶음은 자기 재질을 따로 받는다.
 */

type V3 = [number, number, number]
type Buf = { pos: number[]; nor: number[]; col: number[] }
const blank = (): Buf => ({ pos: [], nor: [], col: [] })

const shapes = new Map<unknown, Map<string, THREE.BufferGeometry>>()
/** 같은 모양의 지오메트리는 한 번만 만든다(조각마다 새로 만들면 버퍼가 불어난다). */
export function shape<T extends THREE.BufferGeometry>(C: new (...a: never[]) => T, ...args: (number | boolean)[]): T {
  let m = shapes.get(C)
  if (!m) shapes.set(C, (m = new Map()))
  const k = args.join(',')
  let g = m.get(k) as T | undefined
  if (!g) {
    g = new (C as new (...a: (number | boolean)[]) => T)(...args)
    m.set(k, g)
  }
  return g
}

const unindexedCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
/** 정점을 펼친 복사본(인덱스 없음). 여러 모양을 이어 붙이려면 형식이 같아야 한다. */
function unindexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let u = unindexedCache.get(g)
  if (!u) {
    u = g.index ? g.toNonIndexed() : g
    unindexedCache.set(g, u)
  }
  return u
}

const _m = new THREE.Matrix4()
const _s = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _sc = new THREE.Vector3()
const _v = new THREE.Vector3()
const _n = new THREE.Vector3()
const _nm = new THREE.Matrix3()
const _c = new THREE.Color()

/** position·rotation(라디안, XYZ)·scale 로 행렬을 만든다. JSX 의 group 속성과 같은 뜻. */
export function xf(p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 | number = 1): THREE.Matrix4 {
  _q.setFromEuler(_e.set(r[0], r[1], r[2]))
  const sv = typeof s === 'number' ? ([s, s, s] as V3) : s
  return new THREE.Matrix4().compose(_p.set(p[0], p[1], p[2]), _q, _sc.set(sv[0], sv[1], sv[2]))
}

/** 행렬을 왼쪽부터 차례로 곱한다. mul(부모, 자식) 이면 자식이 부모 좌표계에 놓인다. */
export function mul(...ms: THREE.Matrix4[]): THREE.Matrix4 {
  const out = new THREE.Matrix4()
  for (const m of ms) out.multiply(m)
  return out
}

function push(buf: Buf, g: THREE.BufferGeometry, m: THREE.Matrix4, rgb: THREE.Color | null) {
  const p = g.attributes.position
  const n = g.attributes.normal
  _nm.getNormalMatrix(m)
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i).applyMatrix4(m)
    buf.pos.push(_v.x, _v.y, _v.z)
    if (!rgb) continue
    _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize()
    buf.nor.push(_n.x, _n.y, _n.z)
    buf.col.push(rgb.r, rgb.g, rgb.b)
  }
}

/** 한 묶음의 지오메트리 네 덩어리. 비어 있으면 null. */
export interface Merged {
  /** 그림자를 드리우는 밝은 조각 */
  cast: THREE.BufferGeometry | null
  /** 그림자를 드리우지 않는 밝은 조각 */
  keep: THREE.BufferGeometry | null
  /** 빛을 받지 않는 조각(반짝이·하얀 점·고리) */
  unlit: THREE.BufferGeometry | null
  /** 테두리 껍데기(뒷면) */
  hull: THREE.BufferGeometry | null
  dispose(): void
}

export class Batch {
  private cast = blank()
  private keep = blank()
  private unlit = blank()
  private hull = blank()

  /**
   * 조각 하나. g 를 m 에 놓고 color 로 칠한다.
   * outline 은 Part 의 테두리 배율(0 이면 없음), cast 는 그림자 여부, unlit 은 빛을 받지 않는 재질이다.
   */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, color: string, o: { outline?: number; cast?: boolean; unlit?: boolean } = {}): this {
    const u = unindexed(g)
    _c.set(color)
    const buf = o.unlit ? this.unlit : o.cast === false ? this.keep : this.cast
    push(buf, u, m, _c)
    if (o.outline && !o.unlit) {
      // Part 의 테두리는 조각 자신의 중심에서 (1+o) 배 키운 뒤 뒤집어 그린다. 같은 배율을 행렬에 미리 곱해 둔다.
      _s.makeScale(1 + o.outline, 1 + o.outline, 1 + o.outline)
      push(this.hull, u, _m.copy(m).multiply(_s), null)
    }
    return this
  }

  finish(): Merged {
    const mk = (b: Buf, color: boolean, normal: boolean): THREE.BufferGeometry | null => {
      if (!b.pos.length) return null
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
      if (normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3))
      if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
      return g
    }
    const out = {
      cast: mk(this.cast, true, true),
      keep: mk(this.keep, true, true),
      unlit: mk(this.unlit, true, true),
      hull: mk(this.hull, false, false),
    }
    return { ...out, dispose: () => Object.values(out).forEach((g) => g?.dispose()) }
  }
}

/** 빛 받는 정점 색 재질. 묶음끼리 같은 재질을 나눠 쓴다(페이드하지 않는 것만). */
const sharedToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient })
const sharedBasic = new THREE.MeshBasicMaterial({ vertexColors: true })

/** 페이드되는 묶음은 자기 재질이 있어야 한다(한 나무만 반투명해야 하므로). */
export function vertexToonMaterial(): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient })
}
export function vertexBasicMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true })
}

/** 묶음을 만든다. deps 가 바뀔 때만 다시 굳히고, 이전 지오메트리는 버린다. */
export function useMerged(build: (b: Batch) => void, deps: DependencyList): Merged {
  const g = useMemo(() => {
    const b = new Batch()
    build(b)
    return b.finish()
  }, deps)
  useEffect(() => () => g.dispose(), [g])
  return g
}

/**
 * 묶음 렌더. lit·basic 을 주면 그 재질을 쓴다(건물·나무처럼 페이드하는 것은 자기 재질을 줘야 한 채만 반투명해진다).
 * 안 주면 모든 묶음이 공유하는 재질을 쓴다.
 * 묶음 메시의 행렬은 항등이다(정점을 이미 제자리에 굳혔다). 그래서 매 프레임 행렬을 다시 짤 필요가 없다.
 */
export function Merge({ g, lit, basic, hull }: { g: Merged; lit?: THREE.Material; basic?: THREE.Material; hull?: THREE.Material }) {
  return (
    <>
      {g.cast && <mesh castShadow matrixAutoUpdate={false} geometry={g.cast} material={lit ?? sharedToon} />}
      {g.keep && <mesh matrixAutoUpdate={false} geometry={g.keep} material={lit ?? sharedToon} />}
      {g.unlit && <mesh matrixAutoUpdate={false} geometry={g.unlit} material={basic ?? sharedBasic} />}
      {g.hull && <mesh matrixAutoUpdate={false} geometry={g.hull} material={hull ?? outlineMat} />}
    </>
  )
}

/** 묶음이 쓸 밝은·단색 재질을 한 번 만들고 언마운트 때 버린다. */
export function useOwnMaterials() {
  const lit = useMemo(() => vertexToonMaterial(), [])
  const basic = useMemo(() => vertexBasicMaterial(), [])
  useEffect(() => () => {
    lit.dispose()
    basic.dispose()
  }, [lit, basic])
  return { lit, basic }
}
