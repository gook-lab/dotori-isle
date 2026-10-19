import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HALL_R, HALL_SITE } from '../core/hall'
import { heightAt, byWater, isWalkable } from '../core/island'
import { MARKET_SITE } from '../core/market'
import { streetLampSpots } from '../core/streetLamps'
import { blockedByProps, SHOP, SHOP_MAX } from '../core/world'
import { glowMaterial, nightLevel } from './glow'
import { gradient, Toon } from './toon'
import { useSeason } from './Island'
import { weatherFor } from '../core/weather'
import { useGame } from '../game/store'
import { useOutdoorFrame } from './outdoorFrame'

/** 광장(장터) → 상점 → 마을회관 길. 세 건물 가운데 없는 것은 길에서 뺀다. */
const ROUTE = [MARKET_SITE, SHOP, HALL_SITE].filter((p): p is { x: number; z: number } => p !== null)

/** 건물과 광장 주변은 가로등을 세우지 않는다. 물가와 소품 자리도 피한다. */
const SHOP_CLEAR = Math.max(SHOP_MAX.w, SHOP_MAX.d) / 2 + 1.2
const HALL_CLEAR = HALL_R + 1.2
const MARKET_CLEAR = 3.5

export function clearSpot(x: number, z: number): boolean {
  if (!isWalkable(x, z) || byWater(x, z, 0.5) || blockedByProps(x, z, 0.6)) return false
  if (Math.hypot(x - SHOP.x, z - SHOP.z) < SHOP_CLEAR) return false
  if (HALL_SITE && Math.hypot(x - HALL_SITE.x, z - HALL_SITE.z) < HALL_CLEAR) return false
  if (MARKET_SITE && Math.hypot(x - MARKET_SITE.x, z - MARKET_SITE.z) < MARKET_CLEAR) return false
  return true
}

/** 섬이 바뀌지 않으므로 가로등 자리는 한 번만 고른다. */
const LAMPS = streetLampSpots(ROUTE, clearSpot)
/** 가로등 자리. 호박 등불은 이 자리를 피해서 놓는다. */
export const LAMP_SPOTS = LAMPS

/**
 * 밤 가로등: 길가에 낮은 기둥과 등불을 세운다. 밤에만 켜지고, 등불 아래 불빛 웅덩이가 번진다.
 * 등불 재질과 웅덩이 재질은 모든 가로등이 나눠 쓴다. 낮에는 아무것도 보이지 않는다.
 */
export function StreetLamps() {
  const lantern = useMemo(() => new THREE.MeshToonMaterial({ color: '#fff1c9', emissive: '#ffb860', gradientMap: gradient }), [])
  const pool = useMemo(() => glowMaterial('#ffd27a'), [])
  // 젖은 바닥 반사는 같은 빛 색을 길게 늘인 웅덩이로 그린다.
  const wet = useMemo(() => glowMaterial('#ffe2a0'), [])
  const season = useSeason()
  const rainy = useGame((s) => weatherFor(s.day) === 'rain')
  const root = useRef<THREE.Group>(null)
  const poles = useRef<THREE.InstancedMesh>(null)
  const lanterns = useRef<THREE.InstancedMesh>(null)
  const caps = useRef<THREE.InstancedMesh>(null)
  const snow = useRef<THREE.InstancedMesh>(null)
  const pile = useRef<THREE.InstancedMesh>(null)
  const puddles = useRef<THREE.InstancedMesh>(null)
  // 가로등은 한 번 놓고 움직이지 않는다. 기둥·등불·갓·눈 모자·웅덩이는 종류별 인스턴스로 묶고, 밤에만 그린다.
  useLayoutEffect(() => {
    const at = (p: { x: number; z: number }, y: number) => new THREE.Matrix4().makeTranslation(p.x, heightAt(p.x, p.z) + y, p.z)
    const lie = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    LAMPS.forEach((p, i) => {
      poles.current?.setMatrixAt(i, at(p, 0.5))
      lanterns.current?.setMatrixAt(i, at(p, 1.08))
      caps.current?.setMatrixAt(i, at(p, 1.22))
      // 갓 아랫 테두리(1.16~1.21)를 따라 눈이 두툼하게 둘린다. 갓 원뿔 경사에 맞춘 뿔대 모양이다.
      snow.current?.setMatrixAt(i, at(p, 1.185))
      // 기둥 밑동에 납작한 눈 더미(반구를 절반 높이로 눌러 깐다).
      pile.current?.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) + 0.02, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 0.5, 1)))
      const pos = new THREE.Vector3(p.x, heightAt(p.x, p.z) + 0.03, p.z)
      puddles.current?.setMatrixAt(i, new THREE.Matrix4().compose(pos, lie, new THREE.Vector3(0.9, 1.9, 1)))
    })
    for (const im of [poles.current, lanterns.current, caps.current, snow.current, pile.current, puddles.current]) if (im) im.instanceMatrix.needsUpdate = true
  }, [])
  useOutdoorFrame(() => {
    const n = nightLevel()
    lantern.emissiveIntensity = 0.2 + n * 1.4
    // 비 오는 밤엔 웅덩이 빛이 더 세다.
    pool.opacity = n * (rainy ? 0.8 : 0.5)
    wet.opacity = n * 0.6
    if (root.current) root.current.visible = n > 0.02
    if (puddles.current) puddles.current.visible = rainy
  })
  const n = LAMPS.length
  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={poles} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[0.04, 0.05, 1.0, 6]} />
        <Toon color="#4a4038" />
      </instancedMesh>
      <instancedMesh ref={lanterns} args={[undefined, undefined, n]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <primitive object={lantern} attach="material" />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, n]}>
        <coneGeometry args={[0.18, 0.12, 6]} />
        <Toon color="#4a4038" />
      </instancedMesh>
      <instancedMesh ref={snow} args={[undefined, undefined, n]} visible={season === 'winter'}>
        <cylinderGeometry args={[0.11, 0.19, 0.05, 6, 1, true]} />
        <Toon color="#f7fbff" />
      </instancedMesh>
      <instancedMesh ref={pile} args={[undefined, undefined, n]} visible={season === 'winter'}>
        <sphereGeometry args={[0.12, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color="#f7fbff" />
      </instancedMesh>
      <instancedMesh ref={puddles} args={[undefined, undefined, n]} visible={rainy}>
        <circleGeometry args={[1, 16]} />
        <primitive object={wet} attach="material" />
      </instancedMesh>
      {LAMPS.map((p, i) => (
        <sprite key={i} position={[p.x, heightAt(p.x, p.z) + 0.08, p.z]} scale={[2.6, 2.6, 1]} material={pool} />
      ))}
    </group>
  )
}
