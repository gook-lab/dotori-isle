import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { currentHour } from '../core/clock'
import { FIREFLY_COUNT, fireflyGlow, fireflyHidden, fireflyOn, fireflyPlace, fireflySeed } from '../core/fireflies'
import { BUSHES } from '../core/scenery'
import { seasonFor } from '../core/season'
import { weatherFor } from '../core/weather'
import { now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { useOutdoorFrame } from './outdoorFrame'

/**
 * 여름 밤 반딧불이. 덤불 둘레를 떠돌며 개체마다 따로 깜빡인다. 한 번 만든 인스턴스를 매 프레임 움직인다.
 * 여름 저녁이 아니면 숨기고, 잡힌 개체는 잠깐 사라졌다 다른 덤불에서 다시 나온다.
 * 규칙은 core/fireflies.ts 가 정한다.
 */
export function Fireflies() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  useOutdoorFrame(() => {
    const g = mesh.current
    if (!g) return
    const st = useGame.getState()
    const on = fireflyOn(seasonFor(st.day), currentHour(), weatherFor(st.day))
    g.visible = on
    if (!on) return
    const t = now()
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const seed = fireflySeed(i)
      const gone = runtime.fireflyGone[i]
      fireflyPlace(i, gone?.shift ?? 0, BUSHES, t, pos)
      // 빛이 꺼져 있거나 잡혀 사라진 동안에는 아주 작게 줄여 안 보이게 한다
      const k = fireflyHidden(gone, t) ? 0 : 0.15 + fireflyGlow(seed, t) * 0.85
      sc.setScalar(k)
      m.compose(pos, q, sc)
      g.setMatrixAt(i, m)
    }
    g.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FIREFLY_COUNT]} frustumCulled={false} visible={false}>
      <icosahedronGeometry args={[0.11, 0]} />
      <meshBasicMaterial color="#d8ff7a" toneMapped={false} fog={false} />
    </instancedMesh>
  )
}
