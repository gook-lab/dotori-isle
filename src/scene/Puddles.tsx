import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { currentHour } from '../core/clock'
import { groundAt, heightAt, isWalkable } from '../core/island'
import { decodePaths } from '../core/paths'
import { prevDay } from '../core/skyEvents'
import { weatherFor } from '../core/weather'
import { puddleDay, puddleLevel, puddleSpots, PUDDLE_MAX } from '../core/weatherFx'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useOutdoorFrame } from './outdoorFrame'

/** 모래밭 후보 자리. 한 번만 훑어 두고, 날마다 그중 일부를 고른다. */
let sandCandidates: { x: number; z: number }[] | null = null
function sandSpots() {
  if (sandCandidates) return sandCandidates
  const out: { x: number; z: number }[] = []
  for (let x = -40; x <= 40; x += 2) for (let z = -40; z <= 40; z += 2) if (groundAt(x, z) === 'sand' && isWalkable(x, z)) out.push({ x, z })
  sandCandidates = out
  return out
}

/**
 * 웅덩이: 비 오는 날 길과 모래밭 여기저기에 생기고, 비 갠 다음 날 아침 두 시간에 걸쳐 마른다.
 * 자리는 날짜로 정해지고, 한 번에 그리는 인스턴스 하나로 끝낸다.
 */
export function Puddles() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const paths = useGame((s) => s.infra.paths)
  const day = useGame((s) => s.day)
  const rainDay = puddleDay(day, prevDay(day), weatherFor(day))
  const spots = useMemo(() => {
    const onPaths = decodePaths(paths).map((t) => ({ x: t.x, z: t.z }))
    return puddleSpots(rainDay, [...onPaths, ...sandSpots()])
  }, [rainDay, paths])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])

  useOutdoorFrame(() => {
    const s = useGame.getState()
    const level = puddleLevel(weatherFor(prevDay(s.day)), weatherFor(s.day), currentHour())
    runtime.puddleSpots = level > 0 ? spots : []
    runtime.puddleLevel = level
    const im = mesh.current
    if (!im) return
    im.count = level > 0 ? spots.length : 0
    spots.forEach((w, i) => {
      // 자리마다 크기를 조금씩 다르게 해서 똑같아 보이지 않게 한다
      const k = 0.7 + 0.3 * ((i * 37) % 10) / 10
      m.compose(v.set(w.x, heightAt(w.x, w.z) + 0.03, w.z), q, sc.set(k * level, k * level, 1))
      im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PUDDLE_MAX]} frustumCulled={false}>
      <circleGeometry args={[0.9, 12]} />
      <meshBasicMaterial color="#6f8fa8" transparent opacity={0.6} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
    </instancedMesh>
  )
}
