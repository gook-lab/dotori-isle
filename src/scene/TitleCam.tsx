import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { EPILOGUE_MS } from '../core/story'

/**
 * 타이틀 화면의 카메라. 섬을 천천히 한 바퀴씩 돌다가, 시작을 누르면 1.2초 동안 플레이어 뒤쪽 평소 시점으로 내려온다.
 * Player 가 먼저 카메라를 잡은 뒤 이 컴포넌트가 덮어쓰도록 Canvas 안에서 Player 다음에 둔다.
 */

const ORBIT_R = 36
const ORBIT_H = 22
/** 한 바퀴 도는 데 약 2분(라디안/초) */
const ORBIT_SPEED = 0.05
const CENTER = new THREE.Vector3(0, 1.5, 0)
const GLIDE_SECONDS = 1.2
/** 평소 시점과 같은 뒤쪽 오프셋(Player 의 CAM_OFFSET 과 맞춘다) */
const BEHIND = new THREE.Vector3(0, 6.6, 10.5)

export function TitleCam() {
  const camera = useThree((s) => s.camera)
  const glideFrom = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const look = useRef(new THREE.Vector3())
  const end = useRef(new THREE.Vector3())
  const aim = useRef(new THREE.Vector3())

  useFrame((state) => {
    // 에필로그 동안에도 섬 하늘을 도는 카메라를 쓴다(끝나면 평소 시점으로 돌아간다)
    const ending = useGame.getState().storyEnding
    const epilogue = ending !== null && Date.now() - ending < EPILOGUE_MS
    if (useGame.getState().title || epilogue) {
      const a = state.clock.elapsedTime * ORBIT_SPEED
      camera.position.set(Math.cos(a) * ORBIT_R, ORBIT_H, Math.sin(a) * ORBIT_R)
      camera.lookAt(CENTER)
      return
    }
    const t0 = runtime.titleEndAt
    if (t0 === null) return
    const k = (now() - t0) / GLIDE_SECONDS
    if (k >= 1) return
    // 시작 순간의 카메라 자리에서 출발한다
    if (!glideFrom.current) glideFrom.current = { pos: camera.position.clone(), look: CENTER.clone() }
    const p = runtime.player
    end.current.set(p.x, p.y, p.z).add(BEHIND)
    aim.current.set(p.x, p.y + 1.1, p.z - 1.2)
    const e = k * k * (3 - 2 * k)
    camera.position.lerpVectors(glideFrom.current.pos, end.current, e)
    look.current.lerpVectors(glideFrom.current.look, aim.current, e)
    camera.lookAt(look.current)
  })
  return null
}
