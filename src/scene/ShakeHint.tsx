import { useFrame } from '@react-three/fiber'
import { isIndoor } from '../game/indoor'
import * as THREE from 'three'
import { fruitTreesByDistance, shakeHintOn } from '../core/guide'
import { heightAt } from '../core/island'
import { TREES } from '../core/world'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

const top = new THREE.Vector3()
/** 위쪽 HUD 줄 아래 나무를 먼저 고르고, 그런 나무가 없으면 화면 안의 가장 가까운 나무를 쓴다 */
const HUD_TOP = 120

/** 나무가 화면 밖에 있을 때: 화면 중심에서 나무 쪽 방향으로 가장자리 안쪽에 놓는다. 나무가 카메라 뒤면 방향을 뒤집는다. */
const EDGE_INSET = 44
function edgeArrow(tree: { x: number; z: number; scale: number }, camera: THREE.Camera, size: { width: number; height: number }) {
  top.set(tree.x, heightAt(tree.x, tree.z) + 3.6 * tree.scale, tree.z).project(camera)
  const sign = top.z > 1 ? -1 : 1
  const dx = top.x * sign
  const dy = -top.y * sign
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const cx = size.width / 2
  const cy = size.height / 2
  // 가장자리 상자 안에 닿을 때까지 중심에서 늘린다
  const sx = ux === 0 ? Infinity : (cx - EDGE_INSET) / Math.abs(ux)
  const sy = uy === 0 ? Infinity : (cy - EDGE_INSET) / Math.abs(uy)
  const k = Math.min(sx, sy)
  const x = cx + ux * k
  const y = Math.min(size.height - EDGE_INSET, Math.max(HUD_TOP, cy + uy * k))
  return { x, y, behind: false, angle: (Math.atan2(uy, ux) * 180) / Math.PI + 90 }
}

/** 첫 나무 흔들기 안내의 화면 위치를 매 프레임 정한다. 말풍선은 ui/ShakeHint.tsx 가 그린다. */
export function ShakeHintTracker() {
  useFrame(({ camera, size }) => {
    const s = useGame.getState()
    runtime.shakeHint = null
    runtime.shakeHintEdge = null
    // 집·박물관·동굴·주민 집 안에서는 바깥 나무가 보이지 않으니 안내를 띄우지 않는다
    if (!shakeHintOn(s.stats, s.questsDone) || isIndoor(s)) return
    // 흔들었거나 베어 넘긴 나무는 안내하지 않는다
    const gone = [...s.shaken, ...Object.keys(s.felled)]
    const trees = fruitTreesByDistance(TREES, gone, runtime.player.x, runtime.player.z)
    // 가장 가까운 나무의 가장자리 화살표는 항상 준비해 둔다. 말풍선이 HUD 에 가리면 UI 가 이쪽을 쓴다.
    runtime.shakeHintEdge = trees[0] ? edgeArrow(trees[0], camera, size) : null
    let fallback: { x: number; y: number; behind: boolean } | null = null
    for (const tree of trees) {
      top.set(tree.x, heightAt(tree.x, tree.z) + 3.6 * tree.scale, tree.z).project(camera)
      const x = ((top.x + 1) / 2) * size.width
      const y = ((1 - top.y) / 2) * size.height
      if (top.z > 1 || x < 0 || x > size.width || y < 0 || y > size.height) continue
      if (y >= HUD_TOP) {
        runtime.shakeHint = { x, y, behind: false }
        return
      }
      fallback ??= { x, y, behind: false }
    }
    if (fallback) {
      runtime.shakeHint = fallback
      return
    }
    // 화면 밖이면 가장 가까운 나무 쪽을 가리키는 화살표만 가장자리에 둔다
    runtime.shakeHint = runtime.shakeHintEdge
  })
  return null
}
