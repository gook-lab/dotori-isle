import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { SHOP, SHOP_DOOR } from '../core/world'
import { now, runtime } from '../game/runtime'
import { type Motion, type Pose } from './Chibi'
import { RaccoonClerk } from './RaccoonClerk'
import { Toon } from './toon'

/** 재개장 리본 연출이 보이는 시간(초). 앞쪽 3초는 리본, 그다음은 점원이 손을 흔든다. */
const CEREMONY_S = 7
const RIBBON_S = 3

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 공사 중 표지판: 노란 바탕에 검은 줄, 글씨는 굵게 */
function siteTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = '#f2c14e'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#2b2320'
    for (let i = -2; i < 10; i++) {
      g.beginPath()
      g.moveTo(i * 40, 128)
      g.lineTo(i * 40 + 20, 128)
      g.lineTo(i * 40 + 60, 0)
      g.lineTo(i * 40 + 40, 0)
      g.closePath()
      g.fill()
    }
    g.fillStyle = '#fdf6e3'
    g.fillRect(34, 34, 188, 60)
    g.fillStyle = '#2b2320'
    g.font = 'bold 40px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('공사 중', 128, 66)
  })
}

/** 공사 중 표지판: 상점 앞 왼쪽에 세운다. 공사 기간에만 그린다. */
export function ShopSiteSign() {
  const tex = useMemo(() => siteTexture(), [])
  const x = SHOP.x - 2.6
  const z = SHOP_DOOR.z + 1.6
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.06, 1.1, 0.06]} />
        <Toon color="#8a6a4a" />
      </mesh>
      <mesh position={[0, 1.0, 0.04]}>
        <planeGeometry args={[1.1, 0.55]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

/** 공사하는 점원: 밖에서 망치를 내리치는 idle 동작. 상점 쪽(-z)을 본다. */
export function ShopWorker() {
  const x = SHOP.x + 2.3
  const z = SHOP_DOOR.z + 1.2
  const y = heightAt(x, z)
  const motion = useMemo<() => Motion>(() => () => ({ moving: false, pace: 1, talking: false }), [])
  const pose = useMemo<() => Pose | null>(() => () => ({ armR: -1.2 + Math.sin(now() * 7) * 0.9, armRz: 0.15 }), [])
  return (
    <group position={[x, y, z]} rotation={[0, Math.PI, 0]}>
      <RaccoonClerk id="narl" seed={5} motion={motion} pose={pose}>
        {/* 망치: 손 끝에 쥔 자루와 머리 */}
        <group position={[0, -0.05, 0.1]}>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
            <Toon color="#8a6a4a" />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[0.2, 0.12, 0.12]} />
            <Toon color="#8f9aa6" />
          </mesh>
        </group>
      </RaccoonClerk>
    </group>
  )
}

/**
 * 재개장 아침 리본 커팅. 상점 문 앞에 리본을 걸고 점원 둘이 손을 흔든다. 한 번만 보이는 연출이다.
 * 시작 시각은 store 가 날이 넘어가며 상점을 새 단계로 열 때 runtime.shopRibbon 에 적는다.
 */
export function ShopReopenCeremony() {
  const ref = useRef<THREE.Group>(null)
  const ribbon = useRef<THREE.Group>(null)
  const wave = useMemo<() => Pose | null>(() => () => ({ armR: -2.2, armRz: 0.5 + Math.sin(now() * 12) * 0.35 }), [])
  const motion = useMemo<() => Motion>(() => () => ({ moving: false, pace: 1, talking: false, hype: 0.4 }), [])
  useFrame(() => {
    if (!ref.current) return
    const t = now() - runtime.shopRibbon
    ref.current.visible = t >= 0 && t < CEREMONY_S
    if (ribbon.current) ribbon.current.visible = t < RIBBON_S
  })
  const x = SHOP.x
  const z = SHOP_DOOR.z + 0.5
  const y = heightAt(x, z)
  return (
    <group ref={ref} visible={false}>
      <group ref={ribbon} position={[x, y, z]}>
        {/* 리본 기둥 두 개와 가로지른 빨간 리본 */}
        {[-1.4, 1.4].map((dx) => (
          <mesh key={dx} position={[dx, 1.0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2.0, 8]} />
            <Toon color="#8a6a4a" />
          </mesh>
        ))}
        <mesh position={[0, 1.55, 0]}>
          <boxGeometry args={[2.8, 0.22, 0.04]} />
          <Toon color="#d94b3b" />
        </mesh>
        <mesh position={[0, 1.55, 0.03]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Toon color="#f2c14e" />
        </mesh>
      </group>
      {/* 점원 둘이 문 양옆에서 길 쪽(+z)을 보고 인사한다 */}
      {[-1.9, 1.9].map((dx) => (
        <group key={dx} position={[x + dx, heightAt(x + dx, z + 1.2), z + 1.2]}>
          <RaccoonClerk id={dx < 0 ? 'garam' : 'narl'} seed={dx < 0 ? 6 : 7} motion={motion} pose={wave} />
        </group>
      ))}
    </group>
  )
}
