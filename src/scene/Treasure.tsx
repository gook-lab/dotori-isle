import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { GLINT_RADIUS, parseMapId } from '../core/bottle'
import { heightAt } from '../core/island'
import { burst, now, runtime } from '../game/runtime'
import { useGame } from '../game/store'

/** 가방의 보물 지도 목표 자리 근처에 가면 땅에 작은 반짝임이 난다(힌트) */
export function TreasureGlint() {
  const inventory = useGame((s) => s.inventory)
  const targets = useMemo(() => inventory.flatMap((slot) => {
    const t = parseMapId(slot.id)
    return t ? [t] : []
  }), [inventory])
  const last = useRef(0)
  useFrame(() => {
    if (targets.length === 0) return
    const t = now()
    if (t - last.current < 0.7) return
    const p = runtime.player
    const hit = targets.find((m) => Math.hypot(p.x - m.x, p.z - m.z) < GLINT_RADIUS)
    if (!hit) return
    last.current = t
    burst({ kind: 'sparks', x: hit.x, y: heightAt(hit.x, hit.z) + 0.3, z: hit.z })
  })
  return null
}
