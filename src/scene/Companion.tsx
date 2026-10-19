import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ToolModel } from './Player'
import { SURFACE_Y } from '../core/diving'
import { companionBug, companionCatch, fishingSpot, followGoal, sideStand, stepToward } from '../core/companion'
import { currentHour, isNight } from '../core/clock'
import { groundAt, heightAt } from '../core/island'
import { hashString } from '../core/rng'
import { josa } from '../core/items'
import { VILLAGERS } from '../core/villagers'
import { burst, now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { Chibi, type Motion, type Pose } from './Chibi'
import { ItemModel } from './ItemModel'
import { ripple } from './waterMaterial'
import { Part, Toon } from './toon'
import { lookOf } from './Villagers'

const WALK = 3.2
/** 찌가 가라앉거나(낚시) 잠자리채를 휘두르는(벌레잡기) 시간(초) */
const BITE_SECONDS = 1.2
/** 잡은 것을 들어 보이는 시간(초) */
const HOLD_SECONDS = 1.8
/** 자리에 이 거리 안으로 들어오면 도착한 것으로 본다 */
const ARRIVE = 0.3
/** 플레이어가 벌레를 잡았을 때 박수 치는 시간(초) */
const CLAP_SECONDS = 1.4

interface Bite {
  t0: number
  id: string
  shown: boolean
}

/** 같이 다니는 주민. 낚시 동행은 옆 물가에 서서 찌를 드리우고, 벌레잡기 동행은 잠자리채를 들고 따라다닌다. */
export function Companion() {
  const villagerId = useGame((s) => s.companion?.villagerId ?? null)
  const until = useGame((s) => s.companion?.until ?? 0)
  if (!villagerId) return null
  return <Walker key={until} villagerId={villagerId} />
}

function Walker({ villagerId }: { villagerId: string }) {
  const body = useRef<THREE.Group>(null)
  const float = useRef<THREE.Group>(null)
  const motion = useRef<Motion>({ moving: false, pace: 1, talking: false })
  const pose = useRef<Pose | null>(null)
  const at = useRef({ x: 0, z: 0, ready: false, arrived: false })
  const stand = useRef<{ x: number; z: number } | null>(null)
  const bite = useRef<Bite | null>(null)
  const rodTip = useRef<THREE.Group>(null)
  const clapSeen = useRef(0)
  const clapT0 = useRef(-99)
  const [held, setHeld] = useState<string | null>(null)
  const mode = useGame.getState().companion?.mode ?? 'fish'
  // 낚싯줄은 매 프레임 꼭짓점만 옮긴다
  const lineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const obj = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }))
    obj.frustumCulled = false
    obj.visible = false
    return obj
  }, [])
  const name = VILLAGERS.find((v) => v.id === villagerId)?.name ?? '주민'

  // 1초마다 시간이 다 됐는지, 집에 들어갔는지 본다
  useEffect(() => {
    const id = setInterval(() => useGame.getState().tickCompanion(), 1000)
    return () => clearInterval(id)
  }, [])

  useFrame((_, delta) => {
    const g = body.current
    const f = float.current
    const c = useGame.getState().companion
    if (!g || !f || !c) return
    const dt = Math.min(delta, 0.05)
    const p = runtime.player
    const k = at.current
    const t_ = now()
    const isWater = (x: number, z: number) => groundAt(x, z) === 'water'
    if (!k.ready) {
      const goal = followGoal(p)
      k.x = goal.x
      k.z = goal.z
      k.ready = true
    }

    // 플레이어가 벌레를 잡으면 박수를 친다
    if (c.clapAt !== clapSeen.current) {
      clapSeen.current = c.clapAt
      if (c.clapAt > 0) {
        clapT0.current = t_
        useGame.getState().notify(`👏 ${josa(name, '이', '가')} 박수를 쳐요`)
      }
    }
    const clapping = t_ - clapT0.current < CLAP_SECONDS

    // 낚시 동행: 플레이어가 낚시를 시작하면 옆 물가 자리로 가고, 끝나면 다시 따라다닌다
    const fishing = mode === 'fish' && runtime.fishing.phase !== 'idle'
    if (!fishing) {
      stand.current = null
      k.arrived = false
    } else if (!stand.current) stand.current = sideStand(p, isWater)
    const standing = fishing && stand.current !== null
    const target = standing && stand.current ? stand.current : followGoal(p)
    const sp = standing && stand.current ? fishingSpot({ ...stand.current, facing: p.facing }, isWater) : null
    const st = stepToward(k, target, WALK, dt)
    k.x = st.x
    k.z = st.z
    if (standing && Math.hypot(target.x - k.x, target.z - k.z) < ARRIVE) k.arrived = true
    const arrived = standing && k.arrived
    motion.current.moving = st.moving
    motion.current.hype = clapping ? 1 : 0
    const wet = isWater(k.x, k.z)
    g.position.set(k.x, wet ? SURFACE_Y - 0.3 : heightAt(k.x, k.z), k.z)
    // 도착하면 물을 보고 서고, 걷는 중엔 가는 쪽을, 쉴 땐 플레이어를 본다
    const face = arrived && sp ? sp : st.moving ? target : p
    g.rotation.y = Math.atan2(face.x - k.x, face.z - k.z)

    // 잡기: 다음 시각이 오면 시작한다. 낚시는 도착해서 찌를 드리운 뒤에만, 벌레잡기는 언제든 한다.
    const canCatch = mode === 'bug' || (arrived && sp !== null)
    if (canCatch && !bite.current && Date.now() >= c.nextBite) {
      const night = isNight(currentHour())
      const id = mode === 'fish' ? companionCatch(night, Math.random) : companionBug(night, Math.random)
      bite.current = { t0: t_, id, shown: false }
      if (mode === 'fish' && sp) {
        burst({ kind: 'splash', x: sp.x, y: SURFACE_Y, z: sp.z })
        ripple(sp.x, sp.z, 1.2)
      }
    }
    const b = bite.current
    const t = b ? t_ - b.t0 : 0
    if (b) {
      if (t >= BITE_SECONDS && !b.shown) {
        // 잡은 것을 손에 들어 보인다
        b.shown = true
        setHeld(b.id)
      }
      if (t >= BITE_SECONDS + HOLD_SECONDS) {
        useGame.getState().recordCompanionCatch(b.id)
        bite.current = null
        setHeld(null)
      }
    }

    // 찌: 도착해서 낚시 중이면 물가에 띄우고, 입질 땐 깊이 가라앉았다 올라온다
    if (arrived && sp) {
      const dip = b && t < BITE_SECONDS ? Math.sin((t / BITE_SECONDS) * Math.PI) * 0.22 : 0
      f.visible = true
      f.position.set(sp.x, SURFACE_Y + 0.12 - dip, sp.z)
    } else f.visible = false
    // 낚싯줄: 낚싯대 끝에서 찌까지
    const ln = lineObj
    if (ln) {
      ln.visible = f.visible && !!rodTip.current
      const tip = rodTip.current
      if (ln.visible && tip) {
        const a = tip.localToWorld(new THREE.Vector3(0, 1.25, 0))
        const pos = ln.geometry.getAttribute('position') as THREE.BufferAttribute
        pos.setXYZ(0, a.x, a.y, a.z)
        pos.setXYZ(1, f.position.x, f.position.y + 0.05, f.position.z)
        pos.needsUpdate = true
      }
    }

    // 자세: 박수가 우선, 잡은 것을 든 채로 들고, 낚시는 낚싯대를 드리우고, 벌레잡기는 채를 휘두른다
    if (clapping) {
      const w = Math.sin((t_ - clapT0.current) * 18) * 0.3
      pose.current = { armL: -1.5 + w, armR: -1.5 - w, lean: 0 }
    } else if (b && held) pose.current = { armR: -2.6, lean: 0.1 }
    else if (b && mode === 'bug' && t < BITE_SECONDS) pose.current = { armR: -2.2 + (t / BITE_SECONDS) * 2.2, lean: 0.15 }
    else if (arrived && sp) pose.current = { armR: b && t < BITE_SECONDS ? -1.9 : -1.2, lean: 0.12 }
    else pose.current = null
  })

  return (
    <>
      <group ref={body}>
        <Chibi look={lookOf(villagerId)} motion={() => motion.current} pose={() => pose.current} seed={hashString(villagerId) % 100}>
          {mode === 'fish' && (
            <group rotation={[0.2, 0, -0.2]}>
              <group ref={rodTip}>
                <ToolModel tool="rod" />
              </group>
            </group>
          )}
          {mode === 'bug' && !held && <Net />}
          {held && (
            <group position={[0.02, -0.1, 0.14]} scale={2}>
              <ItemModel id={held} />
            </group>
          )}
        </Chibi>
      </group>
      <group ref={float} visible={false}>
        <mesh>
          <sphereGeometry args={[0.07, 10, 8]} />
          <Toon color="#ff5a5a" />
        </mesh>
      </group>
      <primitive object={lineObj} />
    </>
  )
}

/** 잠자리채: 긴 손잡이를 손 위로 세우고, 끝에 짙은 갈색 고리와 하늘색 그물(격자 선 네 가닥)을 단다. */
function Net() {
  const NET_Y = 1.05
  return (
    <group position={[0, -0.1, 0.05]}>
      <Part color="#b98a55" position={[0, 0.5, 0]} outline={0.04}>
        <cylinderGeometry args={[0.07, 0.07, 1.0, 6]} />
      </Part>
      <mesh position={[0, NET_Y, 0]}>
        <torusGeometry args={[0.2, 0.045, 6, 16]} />
        <Toon color="#5a3b22" />
      </mesh>
      <mesh position={[0, NET_Y, -0.02]}>
        <circleGeometry args={[0.19, 14]} />
        <meshBasicMaterial color="#cfe8f5" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {[-0.1, 0.1].map((d) => (
        <group key={d}>
          <mesh position={[0, NET_Y + d, 0]}>
            <boxGeometry args={[0.32, 0.012, 0.01]} />
            <meshBasicMaterial color="#7a5a3a" />
          </mesh>
          <mesh position={[d, NET_Y, 0]}>
            <boxGeometry args={[0.012, 0.32, 0.01]} />
            <meshBasicMaterial color="#7a5a3a" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
