import { useMemo } from 'react'
import { groundCell } from '../core/placement'
import { ISLAND_R, heightAt } from '../core/island'
import { isTouchDevice } from '../ui/device'
import { useGame } from '../game/store'

/**
 * 손가락 화면에서 섬에 놓는 중일 때 땅 전체를 덮는 투명 판.
 * 탭한 광선이 지형 높이와 만나는 칸을 골라 미리보기 칸으로 둔다. 집 안은 RoomGhost 가 맡는다.
 */
export function PlaceTap() {
  const placing = useGame((s) => s.placing)
  const touch = useMemo(() => isTouchDevice(), [])
  if (!touch || !placing) return null
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, 0.02, 0]}
      onPointerDown={(e) => {
        e.stopPropagation()
        const r = e.ray
        const cell = groundCell(r.origin.x, r.origin.y, r.origin.z, r.direction.x, r.direction.y, r.direction.z, heightAt)
        if (cell) useGame.getState().setPlaceCell(cell)
      }}
    >
      <planeGeometry args={[ISLAND_R * 2.6, ISLAND_R * 2.6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
