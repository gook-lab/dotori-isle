import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { ItemModel } from '../scene/ItemModel'

/** 카메라(z=2.2, 세로 시야 28도)에서 한 장면 높이가 차지하는 길이 */
const VIEW_HEIGHT = 2 * 2.2 * Math.tan(THREE.MathUtils.degToRad(14))
/** 칸 안에서 모델이 차지하는 비율 */
const FILL = 0.85

/**
 * 모델의 경계 상자 가운데를 화면 가운데에 맞추고, 가장 긴 변이 칸의 FILL 비율이 되게 줄이거나 키운다.
 * 한 번만 맞추고 demand 모드가 그 결과를 한 번 그린다.
 */
export function Fit({ children, fill = FILL }: { children: ReactNode; fill?: number }) {
  const group = useRef<THREE.Group>(null)
  const done = useRef(false)
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => {
    const o = group.current
    if (!o || done.current) return
    const box = new THREE.Box3().setFromObject(o)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z) || 1
    const s = (fill * VIEW_HEIGHT) / longest
    o.scale.setScalar(s)
    o.position.copy(center).multiplyScalar(-s)
    done.current = true
    invalidate()
  })
  return <group ref={group}>{children}</group>
}

/**
 * 가방 칸에 3D 모델을 작게 그린다. 바다 해산물처럼 이모지보다 모양이 중요한 물건에 쓴다.
 * 움직임이 없으니 한 번만 그리는 demand 모드로 돌린다.
 */
export function ItemThumb({ id }: { id: string }) {
  return (
    <span className="slot-icon model" aria-hidden="true">
      <Canvas frameloop="demand" dpr={1} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 2.2], fov: 28 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[1, 2, 2]} intensity={1.4} />
        <Fit>
          <ItemModel id={id} />
        </Fit>
      </Canvas>
    </span>
  )
}
