import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import { furnitureNote } from '../core/furnitureActions'
import { ITEMS } from '../core/items'
import { useQuality } from '../game/quality'
import { FurnitureModel } from '../scene/Furniture'
import { Fit } from './ItemThumb'

/** 미리보기가 도는 속도(라디안/초) */
const SPIN = 0.6

/** 고른 가구를 천천히 돌린다. 낮은 화질에서는 돌리지 않는다(demand 모드가 한 장만 그린다). */
function Spin({ on, children }: { on: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (on && group.current) group.current.rotation.y += dt * SPIN
  })
  return <group ref={group}>{children}</group>
}

/** 가구가 바뀌면 demand 모드에서도 한 번 다시 그리게 한다 */
function Redraw({ id }: { id: string }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    invalidate()
  }, [id, invalidate])
  return null
}

/**
 * 가구 목록 위에 두는 작은 3D 미리보기. 캔버스는 이 칸에 하나뿐이고, 목록 줄마다 만들지 않는다.
 * 실제 방과 같은 FurnitureModel(Shape)을 그리고, 칸 높이는 고정이라 패널 크기가 바뀌지 않는다.
 * id 가 없으면 캔버스를 만들지 않고 안내 한 줄만 둔다.
 */
export function FurniturePeek({ id }: { id: string | null }) {
  const { quality } = useQuality()
  const still = quality === 'low'
  return (
    <div className="peek-box">
      {id ? (
        <>
          <div className="peek-stage" aria-hidden="true">
            <Canvas frameloop={still ? 'demand' : 'always'} dpr={1} gl={{ alpha: true, antialias: !still }} camera={{ position: [0, 0, 2.2], fov: 28 }}>
              <ambientLight intensity={1.1} />
              <directionalLight position={[1, 2, 2]} intensity={1.4} />
              <Fit key={id} fill={0.75}>
                <Spin on={!still}>
                  <FurnitureModel itemId={id} night={false} />
                </Spin>
              </Fit>
              <Redraw id={id} />
            </Canvas>
          </div>
          <p className="peek-name">{ITEMS[id]?.name}</p>
          {furnitureNote(id) && <small className="peek-note">{furnitureNote(id)}</small>}
        </>
      ) : (
        <p className="peek-empty">가구 이름에 마우스를 올리거나 누르면 여기서 돌아가요</p>
      )}
    </div>
  )
}
