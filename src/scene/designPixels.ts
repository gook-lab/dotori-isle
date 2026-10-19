import * as THREE from 'three'
import { DESIGN_SIZE, decodeCells, PALETTE } from '../core/design'

/** 한 색으로 칠한 칸들의 기하와 그 색 */
export interface DesignLayer {
  color: string
  geo: THREE.BufferGeometry
}

/** 저장된 그림마다 한 번만 만든다. 깃발과 티셔츠가 같은 기하를 나눠 쓴다. */
const cache = new Map<string, DesignLayer[]>()

/**
 * 16×16 그림을 색마다 한 장의 기하로 묶는다. 칸은 사각형 두 개씩이고, 투명 칸은 만들지 않아 뒤가 비친다.
 * 가운데가 원점인 width×height 판이다. 한 색당 메시 하나(평범한 color 재질)라서 칸이 번지지 않고,
 * 텍스처나 정점 색 경로에 기대지 않는다. 풀 수 없는 문자열이면 null.
 */
export function designLayers(cells: string, width: number, height: number): DesignLayer[] | null {
  const key = `${cells}|${width}|${height}`
  const hit = cache.get(key)
  if (hit) return hit
  const px = decodeCells(cells)
  if (!px) return null
  const cw = width / DESIGN_SIZE
  const ch = height / DESIGN_SIZE
  const byColor = new Map<number, { pos: number[]; idx: number[] }>()
  px.forEach((v, i) => {
    if (!PALETTE[v]) return
    const bucket = byColor.get(v) ?? { pos: [], idx: [] }
    byColor.set(v, bucket)
    const x0 = -width / 2 + (i % DESIGN_SIZE) * cw
    const y1 = height / 2 - Math.floor(i / DESIGN_SIZE) * ch
    const base = bucket.pos.length / 3
    bucket.pos.push(x0, y1 - ch, 0, x0 + cw, y1 - ch, 0, x0 + cw, y1, 0, x0, y1, 0)
    bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const layers: DesignLayer[] = [...byColor].map(([v, b]) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
    geo.setIndex(b.idx)
    return { color: PALETTE[v] as string, geo }
  })
  cache.set(key, layers)
  return layers
}
