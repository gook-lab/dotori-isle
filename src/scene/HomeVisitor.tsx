import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type * as THREE from 'three'
import { exitOf, HOME_ROOM, HOME_ROOM_SIZES, ROOM_FLOOR, roomCenter } from '../core/interior'
import { hashString, mulberry32 } from '../core/rng'
import { interiorComment, pickSpot, VISIT_AVOID_R, VISIT_FADE, VISIT_TOTAL, visitGreeting, visitorFor, visitPhase, VISIT_USE, VISIT_WALK, type VisitState } from '../core/visits'
import { VILLAGERS } from '../core/villagers'
import { now, runtime } from '../game/runtime'
import { play } from '../game/sfx'
import { useGame } from '../game/store'
import { Chibi, type Motion, type Pose } from './Chibi'
import { lookOf } from './Villagers'

/** 플레이어 몸을 비켜 가도록 방문객 자리를 고친다. 가까우면 몸 둘레 바깥으로 밀어낸다. */
function avoid(x: number, z: number, px: number, pz: number): { x: number; z: number } {
  const dx = x - px
  const dz = z - pz
  const d = Math.hypot(dx, dz)
  if (d >= VISIT_AVOID_R) return { x, z }
  // 정확히 겹치면 방향이 없으니 오른쪽으로 비킨다
  if (d < 1e-4) return { x: px + VISIT_AVOID_R, z }
  return { x: px + (dx / d) * VISIT_AVOID_R, z: pz + (dz / d) * VISIT_AVOID_R }
}

/** 방 안에서 보는 집들이 방문객. 방에 들어와 있는 날 한 번 찾아오고, 가구를 쓴 뒤 나간다. 좌표는 방 가운데 기준이다. */
export function HomeVisitor() {
  const inHome = useGame((s) => s.inHome)
  const [visitor, setVisitor] = useState<VisitState | null>(null)
  const group = useRef<THREE.Group>(null)
  const motion = useRef<Motion>({ moving: false, pace: 1, talking: false })
  const pose = useRef<Pose | null>(null)
  // 문 소리는 한 번 방문당 두 번(들어올 때, 나갈 때)만 낸다
  const doorSound = useRef({ start: -1, end: -1 })

  // 방에 있는 동안 1초마다 방문이 올지, 끝났는지 본다
  useEffect(() => {
    if (!inHome) return
    const tick = () => {
      const s = useGame.getState()
      if (runtime.visit) {
        if (now() - runtime.visit.start < VISIT_TOTAL) return
        const name = VILLAGERS.find((v) => v.id === runtime.visit?.villagerId)?.name ?? '주민'
        s.notify(interiorComment(name, s.homeFurniture))
        runtime.visit = null
        runtime.visitPos = null
        setVisitor(null)
        return
      }
      if (runtime.visitDone === s.day) return
      const who = visitorFor(s.day, s.houses)
      if (!who) return
      const v = VILLAGERS.find((x) => x.id === who)
      if (!v) return
      const spot = pickSpot(s.homeFurniture, mulberry32(hashString(`visit-spot:${s.day}`)))
      runtime.visitDone = s.day
      const next: VisitState = { villagerId: who, spot, start: now() }
      runtime.visit = next
      setVisitor(next)
      s.notify(visitGreeting(v.name, spot))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [inHome])

  // 방을 떠나면 방문도 그 자리에서 끝난다(다시 들어오면 같은 날엔 다시 오지 않는다)
  useEffect(() => {
    if (inHome) return
    runtime.visit = null
    runtime.visitPos = null
    setVisitor(null)
  }, [inHome])

  useFrame(() => {
    const v = runtime.visit
    const g = group.current
    if (!v || !g) {
      if (runtime.visitPos) runtime.visitPos = null
      return
    }
    const t = now() - v.start
    const spot = v.spot
    const door = exitOf(HOME_ROOM_SIZES[useGame.getState().home.stage])
    // 가구 앞에 서서 쓴다. 앉기는 의자 자리에 앉는다.
    const at = spot ? { x: spot.x, z: spot.z } : door
    const dx = door.x - at.x
    const dz = door.z - at.z
    const len = Math.hypot(dx, dz) || 1
    const front = spot ? { x: at.x + (dx / len) * 0.8, z: at.z + (dz / len) * 0.8 } : door
    const seat = spot?.use === 'sit' ? at : front
    const phase = visitPhase(t, spot)
    let from = door
    let to = front
    let k = 0
    let moving = false
    let p: Pose | null = null
    if (phase === 'walk-in') {
      k = t / VISIT_WALK
      moving = true
    } else if (phase === 'use') {
      from = front
      to = seat
      k = 0
      p = spot?.use === 'sit' ? { sit: 1 } : { lean: 0.05 }
    } else if (phase === 'walk-out') {
      const start = spot ? VISIT_WALK + VISIT_USE : VISIT_WALK
      k = (t - start) / VISIT_WALK
      from = spot ? seat : front
      to = door
      moving = true
    }
    const kk = Math.min(1, Math.max(0, k))
    let x = from.x + (to.x - from.x) * kk
    let z = from.z + (to.z - from.z) * kk
    // 플레이어 몸은 방 가운데 기준으로 옮겨 와서 비켜 간다
    const c = roomCenter(HOME_ROOM)
    const avoided = avoid(x, z, runtime.player.x - c.x, runtime.player.z - c.z)
    x = avoided.x
    z = avoided.z
    runtime.visitPos = { x, z }
    g.position.set(x, ROOM_FLOOR, z)
    // 걷는 쪽을 보고, 쓰는 동안엔 가구 쪽을 본다
    const face = phase === 'use' && spot ? { x: spot.x, z: spot.z } : to
    g.rotation.y = Math.atan2(face.x - x, face.z - z)
    // 문 매트에서 커지며 나타나고, 끝나기 직전 작아지며 사라진다
    const grow = Math.min(1, t / VISIT_FADE)
    const shrink = Math.min(1, Math.max(0, (VISIT_TOTAL - t) / VISIT_FADE))
    const size = phase === 'done' ? 0 : Math.max(0, Math.min(grow, shrink))
    g.scale.setScalar(size)
    if (doorSound.current.start !== v.start) {
      doorSound.current = { start: v.start, end: -1 }
      play('door')
    }
    if (phase === 'walk-out' && t > VISIT_TOTAL - VISIT_FADE && doorSound.current.end !== v.start) {
      doorSound.current.end = v.start
      play('door')
    }
    motion.current.moving = moving
    pose.current = p
  })

  if (!inHome || !visitor) return null
  return (
    <group ref={group}>
      <Chibi look={lookOf(visitor.villagerId)} motion={() => motion.current} pose={() => pose.current} seed={hashString(visitor.villagerId) % 100} />
    </group>
  )
}
