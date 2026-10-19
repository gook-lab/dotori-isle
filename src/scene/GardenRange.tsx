import { useMemo } from 'react'
import * as THREE from 'three'
import { decodeGarden, gardenTileBlocker, isGardenItem } from '../core/gardenTiles'
import { fenceBlocker, isFence } from '../core/fence'
import { gardenRangeCells } from '../core/gardenRange'
import { HOME_SITE } from '../core/home'
import { heightAt } from '../core/island'
import { placeBlocker } from '../core/placement'
import { pathCellsOf } from '../core/paths'
import { useGame } from '../game/store'

/**
 * 울타리나 바닥 타일을 들고 놓기 상태일 때만, 집 둘레 3~6칸 띠 가운데 놓을 수 있는 칸을 옅은 초록으로 깐다.
 * 칸마다 사각형을 한 덩이 지오메트리로 모아 draw call 을 하나만 늘린다. 판정은 놓기 미리보기와 같은 함수를 쓴다.
 */
export function GardenRange() {
  const placing = useGame((s) => s.placing)
  const on = !!placing && (isFence(placing) || isGardenItem(placing))
  const placed = useGame((s) => s.placed)
  const tiles = useGame((s) => s.gardenTiles)
  const felled = useGame((s) => s.felled)
  const day = useGame((s) => s.day)
  const holes = useGame((s) => s.holes)
  const infraPaths = useGame((s) => s.infra.paths)

  const cells = useMemo(() => {
    if (!on || !placing) return []
    const live = { felled, day, holes, paths: pathCellsOf(infraPaths) }
    const ok = isGardenItem(placing)
      ? (x: number, z: number) => gardenTileBlocker(x, z, HOME_SITE, placed, decodeGarden(tiles), live) === null
      : (x: number, z: number) => placeBlocker(x, z, placed, [], live) === null && fenceBlocker(placing, x, z, HOME_SITE) === null
    return gardenRangeCells(HOME_SITE, ok)
  }, [on, placing, placed, tiles, felled, day, holes, infraPaths])

  const geometry = useMemo(() => {
    if (cells.length === 0) return null
    const pos: number[] = []
    for (const c of cells) {
      const y = heightAt(c.x, c.z) + 0.03
      const x0 = c.x - 0.5
      const x1 = c.x + 0.5
      const z0 = c.z - 0.5
      const z1 = c.z + 0.5
      // 두 삼각형으로 칸 하나를 채운다
      pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [cells])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshBasicMaterial color="#7ee081" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
