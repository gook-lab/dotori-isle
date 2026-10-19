import { useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { footprintDepth } from '../core/weatherFx'
import { weatherFor } from '../core/weather'
import { now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useOutdoorFrame } from './outdoorFrame'

export const FOOTPRINT_MAX = 48
/** 발자국이 남아 있는 시간(초). 끝 무렵엔 작아지며 사라진다. */
const LIFE = 9

const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const s = new THREE.Vector3()

/** 모래·눈 위 발자국. 모래는 짙은 모래색, 눈은 푸르스름한 그림자색 자국이다. */
export function Footprints() {
  const sand = useRef<THREE.InstancedMesh>(null)
  const snow = useRef<THREE.InstancedMesh>(null)
  useOutdoorFrame(() => {
    const t = now()
    runtime.footprints = runtime.footprints.filter((f) => t - f.t0 < LIFE)
    // 눈 오는 날엔 눈 위 발자국이 더 깊게 찍힌다
    const depth = footprintDepth(weatherFor(useGame.getState().day))
    const counts = [0, 0]
    for (const f of runtime.footprints) {
      const mesh = f.snow ? snow.current : sand.current
      if (!mesh) continue
      const k = (t - f.t0) / LIFE
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      q.setFromEuler(e.set(-Math.PI / 2, 0, f.rot))
      const deep = f.snow ? depth : 1
      m.compose(v.set(f.x, heightAt(f.x, f.z) + 0.015, f.z), q, s.set(0.065 * fade * deep, 0.1 * fade * deep, 1))
      mesh.setMatrixAt(counts[f.snow ? 1 : 0]++, m)
    }
    for (const [mesh, n] of [
      [sand.current, counts[0]],
      [snow.current, counts[1]],
    ] as const) {
      if (!mesh) continue
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <>
      {/* 발바닥 하나: 세로로 긴 타원 */}
      <instancedMesh ref={sand} args={[undefined, undefined, FOOTPRINT_MAX]} frustumCulled={false}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial color="#b89a64" transparent opacity={0.45} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      <instancedMesh ref={snow} args={[undefined, undefined, FOOTPRINT_MAX]} frustumCulled={false}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial color="#a9bccb" transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
    </>
  )
}
