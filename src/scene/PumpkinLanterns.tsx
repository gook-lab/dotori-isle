import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { MARKET_SITE } from '../core/market'
import { lanternSpotsAround } from '../core/pumpkin'
import { SHOP_DOOR } from '../core/world'
import { useGame } from '../game/store'
import { clearSpot, LAMP_SPOTS } from './StreetLamps'
import { useOutdoorFrame } from './outdoorFrame'

/** 광장 둘레 호박 등불 자리(고정 각도, 가로등과 겹치면 건너뜀) + 상점 문 앞 두 자리 */
const SHOP_FRONT = [
  { x: SHOP_DOOR.x - 1.8, z: SHOP_DOOR.z + 1.6 },
  { x: SHOP_DOOR.x + 1.8, z: SHOP_DOOR.z + 1.6 },
].filter((p) => clearSpot(p.x, p.z))
const SPOTS = [...(MARKET_SITE ? lanternSpotsAround(MARKET_SITE, LAMP_SPOTS, clearSpot) : []), ...SHOP_FRONT]

/** 얼굴 구멍 여섯 개(눈 둘, 코, 입 셋)의 자리. 호박 앞면(+z)에 뚫려 있다. */
const FACE = [
  { x: -0.1, y: 0.42, z: 0.3, w: 0.1, h: 0.11 },
  { x: 0.1, y: 0.42, z: 0.3, w: 0.1, h: 0.11 },
  { x: 0, y: 0.32, z: 0.3, w: 0.05, h: 0.05 },
  { x: -0.1, y: 0.22, z: 0.285, w: 0.08, h: 0.06 },
  { x: 0, y: 0.2, z: 0.29, w: 0.1, h: 0.07 },
  { x: 0.1, y: 0.22, z: 0.285, w: 0.08, h: 0.06 },
]
const BODY_Y = 0.35

/**
 * 호박 등불 밤 불빛. 호박 몸통, 얼굴 구멍(어두운 바탕 + 따뜻한 빛), 바닥 웅덩이를 종류별 인스턴스로 묶어 그린다.
 * 밤(17시~자정)에만 보이고, 촛불처럼 빛의 세기가 살짝 흔들린다. 행사 밖에서는 보이지 않는다.
 */
export function PumpkinLanterns() {
  const n = SPOTS.length
  const root = useRef<THREE.Group>(null)
  const bodies = useRef<THREE.InstancedMesh>(null)
  const stems = useRef<THREE.InstancedMesh>(null)
  const holes = useRef<THREE.InstancedMesh>(null)
  const glows = useRef<THREE.InstancedMesh>(null)
  const pools = useRef<THREE.InstancedMesh>(null)
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f08a2a', roughness: 0.7 }), [])
  const stem = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b8e3d', roughness: 0.8 }), [])
  const hole = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2a1d12' }), [])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }), [])
  // 바닥 웅덩이: 가운데가 진하고 가장자리로 흐려지는 원 무늬를 한 번 그려 쓴다
  const pool = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,170,80,1)')
    grad.addColorStop(1, 'rgba(255,170,80,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  }, [])

  // 한 번 놓고 움직이지 않는다. 행렬을 한 번만 채운다.
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const put = (im: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (!im) return
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)))
    }
    SPOTS.forEach((p, i) => {
      const base = heightAt(p.x, p.z)
      put(bodies.current, i, p.x, base + BODY_Y, p.z, 1, 1, 1)
      put(stems.current, i, p.x, base + BODY_Y + 0.34, p.z, 1, 1, 1)
      // 웅덩이는 바닥에 눕힌 원
      const pos = new THREE.Vector3(p.x, base + 0.03, p.z)
      pools.current?.setMatrixAt(i, new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1.1, 1.1, 1)))
      FACE.forEach((f, k) => {
        const idx = i * FACE.length + k
        put(holes.current, idx, p.x + f.x, base + BODY_Y + f.y, p.z + f.z, f.w, f.h, 0.02)
        // 구멍 안쪽의 빛은 구멍보다 조금 작게, 살짝 앞에 둔다
        put(glows.current, idx, p.x + f.x, base + BODY_Y + f.y, p.z + f.z + 0.012, f.w * 0.7, f.h * 0.7, 0.02)
      })
    })
    for (const im of [bodies.current, stems.current, holes.current, glows.current, pools.current]) if (im) im.instanceMatrix.needsUpdate = true
  }, [])

  useOutdoorFrame(({ clock }) => {
    const night = useGame.getState().pumpkinNightOn
    if (root.current) root.current.visible = night
    // 촛불처럼 빛이 살짝 흔들린다. 여러 등불이 같은 재질을 나눠 쓰니 한 번만 계산한다.
    const t = clock.elapsedTime
    const flick = 0.85 + 0.12 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 17.1)
    glow.color.setRGB(1, 0.82 * flick, 0.48 * flick)
    pool.opacity = (night ? 0.75 : 0) * flick
    body.emissive.setRGB(0.25 * flick, 0.1 * flick, 0)
  })

  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={bodies} args={[undefined, undefined, n]} material={body}>
        <sphereGeometry args={[0.3, 14, 10]} />
      </instancedMesh>
      <instancedMesh ref={stems} args={[undefined, undefined, n]} material={stem}>
        <cylinderGeometry args={[0.05, 0.06, 0.12, 6]} />
      </instancedMesh>
      <instancedMesh ref={holes} args={[undefined, undefined, n * FACE.length]} material={hole}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, n * FACE.length]} material={glow}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, undefined, n]} material={pool}>
        <circleGeometry args={[1, 16]} />
      </instancedMesh>
    </group>
  )
}
