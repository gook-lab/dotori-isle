import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type * as THREE from 'three'
import { burst, CATCH_FLY, FLY_TIME, now, runtime, type FlyFx } from '../game/runtime'
import { ItemModel } from './ItemModel'

/** 줍는 순간 팝 연출 길이(초) */
const POP_TIME = 0.12

/** 주운 물건: 바닥 → 손 → 머리 위로 쏙 올라가며 작아져 주머니에 들어간다. */
function Flying({ fx }: { fx: FlyFx }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const k = Math.min(1, (now() - fx.t0) / FLY_TIME)
    const p = runtime.player
    const hand = [p.x + Math.sin(p.facing) * 0.35, p.y + 0.55, p.z + Math.cos(p.facing) * 0.35]
    const [fx0, fy0, fz0] = fx.from
    if (k < 0.45) {
      const f = k / 0.45
      g.position.set(fx0 + (hand[0] - fx0) * f, fy0 + (hand[1] - fy0) * f + Math.sin(f * Math.PI) * 0.3, fz0 + (hand[2] - fz0) * f)
      // 집어 드는 순간 한 번 톡 부풀었다가 제자리로 돌아온다(1→1.35→1).
      g.scale.setScalar(1 + Math.sin(Math.min(1, (now() - fx.t0) / POP_TIME) * Math.PI) * 0.35)
    } else {
      // 손에서 머리 위로 톡 올라가며 사라진다.
      const f = (k - 0.45) / 0.55
      g.position.set(p.x, hand[1] + f * 1.6, p.z)
      g.scale.setScalar(Math.max(0, 1 + Math.sin(f * Math.PI) * 0.3 - f))
    }
    g.rotation.y += 0.2
  })
  return (
    <group ref={ref}>
      <ItemModel id={fx.itemId} />
    </group>
  )
}

/** 잡은 벌레·물고기를 머리 위로 들어 보인다. 커졌다가 살짝 줄어드는 팝 연출과 반짝이. 물고기가 손에 닿은 뒤에 뜬다. */
function ShowOff({ itemId, t0 }: { itemId: string; t0: number }) {
  const ref = useRef<THREE.Group>(null)
  const sparkled = useRef(false)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const k = (now() - t0 - CATCH_FLY) / 1.2
    if (k < 0) {
      g.scale.setScalar(0)
      return
    }
    const p = runtime.player
    if (!sparkled.current && k > 0.1) {
      sparkled.current = true
      if (runtime.swim) {
        // 바다에서 잡았으면 물방울이 몸 둘레에서 튀었다 떨어진다
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          burst({ kind: 'spray', x: p.x + Math.cos(a) * 0.45, y: p.y + 0.3, z: p.z + Math.sin(a) * 0.45 })
        }
      } else burst({ kind: 'confetti', x: p.x, y: p.y + 2.4, z: p.z })
    }
    const pop = k < 0.2 ? (k / 0.2) * 1.4 : k < 0.35 ? 1.4 - ((k - 0.2) / 0.15) * 0.4 : k > 0.9 ? Math.max(0, 1 - (k - 0.9) * 10) : 1
    g.position.set(p.x, p.y + 2.15 + Math.sin(k * 6) * 0.04, p.z)
    // 카메라(+z) 쪽으로 옆모습이 보이게 세운다.
    g.rotation.set(0, Math.sin(k * 4) * 0.3, 0)
    g.scale.setScalar(pop * 1.8)
  })
  return (
    <group ref={ref}>
      <ItemModel id={itemId} />
    </group>
  )
}

/**
 * runtime 의 연출 목록은 React 상태가 아니라서, 프레임마다 목록이 바뀌었는지 보고 다시 그린다.
 * 끝난 연출은 여기서 정리한다.
 */
export function Effects() {
  const [, setVersion] = useState(0)
  const sig = useRef('')
  useFrame(() => {
    const t = now()
    runtime.fly = runtime.fly.filter((f) => t - f.t0 < FLY_TIME)
    if (runtime.show && t - runtime.show.t0 > 1.2 + CATCH_FLY) runtime.show = null
    const next = runtime.fly.map((f) => f.key).join(',') + '|' + (runtime.show?.t0 ?? '')
    if (next !== sig.current) {
      sig.current = next
      setVersion((v) => v + 1)
    }
  })
  return (
    <>
      {runtime.fly.map((f) => (
        <Flying key={f.key} fx={f} />
      ))}
      {runtime.show && <ShowOff key={runtime.show.t0} itemId={runtime.show.itemId} t0={runtime.show.t0} />}
    </>
  )
}
