import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mixHex } from '../core/reform'
import { weatherFor } from '../core/weather'
import { now } from '../game/runtime'
import { useGame } from '../game/store'

/** 처마 한 점마다 떨어지는 방울 수. 두 방울이 어긋나 번갈아 떨어진다. */
const DROPS_PER_EAVE = 2
/** 방울 하나가 처마에서 땅까지 떨어지는 시간(초). */
const FALL_S = 1.1
/** 방울 길이. 빗줄기처럼 세로로 늘여 기본 카메라 거리에서도 보이게 한다. */
const DROP_LEN = 0.3

/** 오늘 비가 오는지. 처마 물방울과 젖은 색 처리가 같이 쓴다. */
export function useRainy(): boolean {
  const day = useGame((s) => s.day)
  return weatherFor(day) === 'rain'
}

/** 비 오는 날 젖은 색: 바탕색을 어두운 슬레이트 쪽으로 조금 섞는다. 맑은 날엔 그대로다. */
export function wetTone(color: string, rainy: boolean): string {
  return rainy ? mixHex(color, '#26303a', 0.22) : color
}

/**
 * 처마 끝 빗방울. 비 오는 날에만 보이고, 점마다 방울이 가속하며 지면까지 떨어진다.
 * 점 좌표는 건물 그룹 기준(땅이 y=0)이라 건물과 함께 돈다. 건물 하나당 한 번(인스턴스)에 그린다.
 */
export function EaveDrips({ points }: { points: [number, number, number][] }) {
  const day = useGame((s) => s.day)
  const rain = weatherFor(day) === 'rain'
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = points.length * DROPS_PER_EAVE
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const im = ref.current
    if (!im || !rain) return
    const t = now()
    for (let i = 0; i < count; i++) {
      const [x, y, z] = points[Math.floor(i / DROPS_PER_EAVE)]
      const phase = (t / FALL_S + i * 0.37) % 1
      const s = phase > 0.9 ? 0 : 1
      // 방울은 세로로 길게 늘여 떨어뜨리고, 가장자리는 땅에서 방울 길이의 절반만큼 띄운다.
      const ly = y - phase * phase * (y - 0.02)
      m.makeScale(s, s, s)
      m.setPosition(x, ly + (DROP_LEN / 2) * s, z)
      im.setMatrixAt(i, m)
    }
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <group visible={rain}>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.05, DROP_LEN, 0.05]} />
        <meshBasicMaterial color="#dff0ff" transparent opacity={0.9} />
      </instancedMesh>
    </group>
  )
}
