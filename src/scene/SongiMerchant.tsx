import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { currentHour } from '../core/clock'
import { heightAt } from '../core/island'
import { songiOpen } from '../core/songi'
import { SONGI_SITE } from '../core/songiSite'
import { useGame } from '../game/store'
import { useSeason } from './Island'
import { Part } from './toon'

/**
 * 일요일 아침 송이 상인. 갓 같은 버섯 모자를 쓰고 바구니를 든 떠돌이다.
 * 상인이 와 있는 시간(songiOpen)에만 세우고, 말을 걸면 송이 패널이 열린다(core/actions).
 */
export function SongiMerchant() {
  const day = useGame((s) => s.day)
  const season = useSeason()
  const [hour, setHour] = useState(currentHour)
  const ref = useRef<THREE.Group>(null)
  useEffect(() => {
    const id = setInterval(() => setHour(currentHour()), 15_000)
    return () => clearInterval(id)
  }, [])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.12
  })
  if (!SONGI_SITE || !songiOpen(day, hour)) return null
  const { x, z } = SONGI_SITE
  return (
    <group ref={ref} position={[x, heightAt(x, z), z]}>
      {/* 몸: 짙은 갈색 두루마기 */}
      <Part color="#7d5a40" position={[0, 0.5, 0]} outline={0.08}>
        <cylinderGeometry args={[0.3, 0.4, 1, 10]} />
      </Part>
      {/* 겨울엔 버섯 갓 위에 눈이 소복이 쌓인다(갓 반구의 윗부분을 덮는다). */}
      {season === 'winter' && (
        <Part color="#fff6e6" position={[0, 1.3, 0]} outline={0.04}>
          <sphereGeometry args={[0.41, 14, 6, 0, Math.PI * 2, 0, Math.PI / 4]} />
        </Part>
      )}
      {/* 얼굴 */}
      <Part color="#f4dcc0" position={[0, 1.13, 0]} outline={0.07}>
        <sphereGeometry args={[0.22, 12, 10]} />
      </Part>
      {/* 버섯 갓: 붉은 윗면과 흰 점 */}
      <Part color="#c8553b" position={[0, 1.3, 0]} outline={0.07}>
        <sphereGeometry args={[0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </Part>
      <Part color="#fff6e6" position={[0.14, 1.52, 0.12]} outline={0}>
        <sphereGeometry args={[0.06, 8, 6]} />
      </Part>
      <Part color="#fff6e6" position={[-0.16, 1.45, 0.1]} outline={0}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </Part>
      <Part color="#fff6e6" position={[0.02, 1.6, -0.12]} outline={0}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </Part>
      {/* 바구니와 그 안의 송이 */}
      <Part color="#c99a5b" position={[0.5, 0.25, 0.25]} outline={0.07}>
        <cylinderGeometry args={[0.22, 0.17, 0.3, 10]} />
      </Part>
      <Part color="#8e6a4a" position={[0.5, 0.42, 0.25]} outline={0.04}>
        <sphereGeometry args={[0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </Part>
    </group>
  )
}
