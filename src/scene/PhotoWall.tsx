import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { HOME_ROOM_SIZES } from '../core/interior'
import { useGame } from '../game/store'

/** 집 뒤 벽의 사진 액자 자리. 창문 오른쪽에 걸고, 높이는 사진 비율을 따른다. */
const AT = { x: 2.4, y: 1.75 }
const WIDTH = 1.3
const FRAME = 0.07

/** 벽에 건 사진을 액자로 그린다. 걸린 사진이 없으면 아무것도 그리지 않는다. */
export function PhotoWall() {
  const stage = useGame((s) => s.home.stage)
  const src = useGame((s) => {
    const id = s.wallPhoto
    return id ? (s.album.find((p) => p.id === id)?.src ?? null) : null
  })
  const [aspect, setAspect] = useState(1.5)
  const tex = useMemo(() => {
    if (!src) return null
    const t = new THREE.TextureLoader().load(src, (loaded) => {
      if (loaded.image) setAspect(loaded.image.width / loaded.image.height)
    })
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [src])

  useEffect(() => () => tex?.dispose(), [tex])
  if (!tex) return null
  const h = WIDTH / aspect
  return (
    <group position={[AT.x, AT.y, -HOME_ROOM_SIZES[stage].d / 2 + 0.09]}>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[WIDTH + FRAME * 2, h + FRAME * 2, 0.06]} />
        <meshToonMaterial color="#8a5a3b" />
      </mesh>
      <mesh position={[0, 0, 0.066]}>
        <planeGeometry args={[WIDTH, h]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}
