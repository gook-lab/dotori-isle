import { useFrame, useThree } from '@react-three/fiber'
import { indoorKind, isIndoor } from '../game/indoor'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { CAST_TIME, REEL_TIME, tickFishing } from '../core/fishing'
import { groundAt, heightAt, onTrip, sightClearance, waterLevelAt } from '../core/island'
import { DIVE_SECONDS, SURFACE_Y, swimOK, swimPushback } from '../core/diving'
import { bodyHole, cameraCut, outlineHole, playerHole } from './occlusion'
import { VIEWPOINT } from '../core/viewpoint'
import { CLIMB_TIME } from '../core/ladder'
import { inRoomArea, HOME_ROOM, roomCamPull, roomCenter, roomSizeAt, roomViewBlocked, roomWalkable } from '../core/interior'
import { seasonFor } from '../core/season'
import { blockedByPlaced } from '../core/placement'
import { blockedByProps, DOCKS, SHOP_DOOR } from '../core/world'
import { blockedByHoles } from '../core/holes'
import { TALK_EYE_HEIGHT, terrainBlocksSight } from '../core/talkShot'
import { blockedByScenery, canWalk, slideStep } from '../core/scenery'
import { findAction, hasPlot, onFishingEvent, presentVillagers, standUp, villagerAt } from '../game/actions'
import { isTouchDevice } from '../ui/device'
import { footstep, play } from '../game/sfx'
import { isWalkable } from '../core/island'
import { footY } from '../core/footSettle'
import { onStepSpot } from '../core/tiers'
import { currentHour } from '../core/clock'
import { festivalOn } from '../core/festivals'
import { isMeteorNight, meteorHours, prevDay, rainbowDay, rainbowHour } from '../core/skyEvents'
import { HASTE_MUL } from '../core/cooking'
import { orbitCamera, type PhotoPose } from '../core/photo'
import { weatherFor } from '../core/weather'
import { carriedUmbrella, desaturate, isWet, sneezeAt, UMBRELLA_COLOR } from '../core/weatherLife'
import { onBridge } from '../core/waters'
import { moodOf, VILLAGERS, type Mood } from '../core/villagers'
import { onKey } from '../game/controls'
import { bindInput, bindZoom, enterBelongsToBag, isHeld, spaceBelongsToUi } from '../game/input'
import { ACT_TIME, burst, CATCH_FLY, DRESS_SWAP, DRESS_TIME, HIT_STOP, KICK_AMP, KICK_TIME, now, rippleAt, runtime, SHAKE_TIME, WATER_FX_TIME } from '../game/runtime'
import { type CanLevel } from '../core/watering'
import { MARKET_SITE } from '../core/market'
import { FOOTPRINT_MAX } from './Footprints'
import { useGame } from '../game/store'
import { ripple } from './waterMaterial'
import { blockedByHouses } from '../core/villagers'
import { designLayers } from './designPixels'
import { WEAR_BY_ID } from '../core/wardrobe'
import { Chibi, type Look, type Motion, type Pose } from './Chibi'
import { Part, Toon } from './toon'
import { ItemModel } from './ItemModel'

const touchDevice = isTouchDevice()

const WALK = 4.2
/** 수영 속도 */
const SWIM_SPEED = 2.8
const VILLAGER_R = 0.75
const RUN = 8.5
/** 달리기 속도로 올라가거나 내려오는 데 걸리는 시간(초) */
const RAMP_TIME = 0.15
/** 누운 주인공의 뿌리 높이: 침대 면 위로 띄우는 값. 머리가 이불에 살짝 묻히는 정도다. */
const LIE_LIFT = 0.3
// 주인공도 같은 그림체: 머리카락 대신 작은 곰 귀가 달린 말랑한 연살구색 몸
const BASE_LOOK: Look = { skin: '#ffe6cc', outfit: '#6aa9e9', ears: 'bear', legs: '#ffe6cc' }

/** 대화 중엔 주민 말에 따라 같이 웃거나 놀란다. 시무룩한 말엔 덤덤하게 듣는다. */
const listenMood = (): Mood => {
  const d = useGame.getState().dialog
  if (!d) return 'calm'
  const m = moodOf(d.lines[d.index] ?? '')
  return m === 'sad' ? 'calm' : m
}

const motion = (): Motion => {
  // 먹는 동안엔 입이 오물오물 움직이고 고개가 살짝 끄덕인다
  const eating = runtime.act?.kind === 'eat'
  return {
    moving: runtime.player.moving,
    pace: runtime.player.running ? 1.5 : 1,
    talking: eating,
    speaking: eating,
    // 사진 모드에서는 고른 표정을 쓴다
    mood: useGame.getState().photoMood ?? (now() < runtime.happyUntil ? 'happy' : listenMood()),
  }
}

/** 사진 모드 자세: 왼팔과 몸을 자세에 맞춘다. 오른손 자세는 손 그룹에서 따로 맞춘다. */
function photoPosePose(id: PhotoPose, t: number): Pose {
  switch (id) {
    case 'v':
      return { armL: -3.1, armLz: -0.9, lean: 0.04 }
    case 'wave':
      return { armL: -2.8 + Math.sin(t * 8) * 0.35, lean: 0.03 }
    case 'jump':
      return { armL: -2.2, hop: 0.2 + 0.2 * Math.abs(Math.sin(t * 3.5)) }
    case 'sit':
      return { sit: 1, armL: -0.35 }
    case 'heart':
      return { armL: -1.4, lean: 0.06 }
  }
}

// 얼굴이 보이도록 비스듬히 낮춘 시점(약 32도)
const CAM_OFFSET = new THREE.Vector3(0, 6.6, 10.5)
/** 백화점 문 앞에서 시선을 올리는 높이(월드 단위) */
const SHOP_LOOK_LIFT = 2.6
/** DEV 전용 카메라 고정값. null 이면 추적 카메라가 그대로 움직인다. */
let devCamFreeze: { pos: [number, number, number]; look: [number, number, number] } | null = null
export function setDevCamFreeze(v: typeof devCamFreeze) {
  devCamFreeze = v
}
/** 세로 화면의 동굴 방: 뒤로 덜 빼고 더 내려다보게 해서 방 깊이가 화면 세로를 채우게 한다 */
const CAVE_CAM_OFFSET = new THREE.Vector3(0, 16, 14)

const ease = (k: number) => 1 - (1 - k) * (1 - k)

/**
 * 도구 동작별 오른손 회전(rx)과 나머지 몸 포즈. k 는 0~1 진행도.
 * 오른손 rx 는 양수일수록 도구 끝이 앞으로 내려간다(내려치기), 음수면 어깨 뒤로 넘어간다(들어올리기).
 */
function actPose(kind: string, k: number, t: number): { rx: number; rz?: number; pose: Pose } {
  switch (kind) {
    case 'shake':
      // 두 팔로 줄기를 잡고 앞뒤로 흔든다.
      return { rx: -1.5 + Math.sin(t * 45) * 0.15, pose: { armL: -1.5 + Math.sin(t * 45) * 0.15, jitter: Math.sin(t * 50) * 0.05, lean: 0.12 } }
    case 'swing':
      return { rx: Math.sin(k * Math.PI) * 1.6, pose: { lean: Math.sin(k * Math.PI) * 0.12 } }
    case 'dig': {
      // 들어올렸다가 → 푹 꽂고 → 흙을 떠낸다.
      const rx = k < 0.35 ? -1.2 * ease(k / 0.35) : k < 0.55 ? -1.2 + 2.7 * ease((k - 0.35) / 0.2) : 1.5 - 0.6 * ((k - 0.55) / 0.45)
      return { rx, pose: { armL: -0.9, lean: k > 0.35 ? 0.28 : 0, hop: k > 0.35 && k < 0.5 ? 0.05 : 0 } }
    }
    case 'hit':
    case 'chop': {
      // 크게 들어올리고 → 빠르게 내려친 뒤 → 반동으로 살짝 튕긴다.
      const rx = k < 0.45 ? -2.3 * ease(k / 0.45) : k < 0.6 ? -2.3 + 3.6 * ((k - 0.45) / 0.15) : 1.3 - 0.5 * ((k - 0.6) / 0.4)
      const impact = k > 0.58 && k < 0.75
      return { rx, pose: { armL: rx * 0.8, lean: k > 0.5 ? 0.2 : -0.08, jitter: impact ? Math.sin(t * 70) * 0.04 : 0 } }
    }
    case 'water':
      // 물뿌리개를 앞으로 기울여 천천히 좌우로 흔든다.
      return { rx: 0.9 + Math.sin(t * 6) * 0.08, pose: { armL: -0.3, lean: 0.08 } }
    case 'pick':
      // 무릎을 굽혀 앞으로 숙이며 줍는다.
      return { rx: Math.sin(k * Math.PI) * 0.9, pose: { armL: -Math.sin(k * Math.PI) * 1.1, lean: Math.sin(k * Math.PI) * 0.45, hop: -Math.sin(k * Math.PI) * 0.12 } }
    case 'show':
      // 잡은 것을 두 손으로 번쩍! 처음에 살짝 뛰어오른다.
      return { rx: -2.9, pose: { armL: -2.9, hop: k < 0.25 ? Math.sin((k / 0.25) * Math.PI) * 0.2 : 0 } }
    case 'look':
      // 한 손을 이마에 대고 몸을 젖혀 하늘을 올려다본다.
      return { rx: 0, pose: { armL: -2.4, lean: -0.18 } }
    case 'pat':
      // 손등으로 톡톡 두세 번 쓰다듬는다.
      return { rx: -0.9 + Math.sin(k * Math.PI * 4) * 0.35, pose: { armL: -0.4, lean: 0.12 } }
    case 'wipe':
      // 천으로 둥글게 문지른다.
      return { rx: -0.8 + Math.sin(t * 16) * 0.3, pose: { armL: -0.6 + Math.cos(t * 16) * 0.2, lean: 0.14 } }
    case 'peek':
      // 망원경에 눈을 대듯 몸을 앞으로 숙인다.
      return { rx: -1.4, pose: { armL: -1.2, lean: 0.22 } }
    case 'eat': {
      // 손을 입 가까이 들었다가 내린다. 두 번 베어 무는 사이에 잠깐 멈춘다.
      const bite = k < 0.2 ? ease(k / 0.2) : k < 0.8 ? 1 - 0.15 * Math.abs(Math.sin((k - 0.2) * Math.PI * 4)) : 1 - ease((k - 0.8) / 0.2)
      // 손을 볼 옆으로 벌려 올린다(정면 카메라에서 몸에 가리지 않게)
      return { rx: -2.5 * bite, rz: 0.8 * bite, pose: { lean: -0.05 * bite } }
    }
    case 'sip':
      // 찻잔을 입가까지 들었다가 내린다.
      return { rx: k < 0.4 ? -2.0 * ease(k / 0.4) : k < 0.6 ? -2.0 : -2.0 + 2.0 * ease((k - 0.6) / 0.4), pose: { lean: -0.05 } }
    case 'build':
      // 완공! 두 팔을 번쩍 들고 깡충 뛴다.
      return { rx: -2.9, pose: { armL: -2.9, hop: Math.abs(Math.sin(k * Math.PI * 2)) * 0.25 } }
    default:
      return { rx: 0, pose: {} }
  }
}

let currentPose: Pose | null = null

type V3 = [number, number, number]
/** 동작 한 번의 자세. grip 이면 두 손으로 자루를 쥔다. */
interface ActCarry {
  hand: V3
  tool: V3
  lean: number
  pose: Pose
  grip: boolean
}
/** 도구별로 들고 다니는 자세: 손(어깨 그룹)과 도구 래퍼의 회전. 0 은 팔이 아래로 늘어진 자세다. */
const CARRY: Record<string, { hand: V3; tool: V3 }> = {
  hand: { hand: [0, 0, 0], tool: [0, 0, 0] },
  // 어깨에 비스듬히 걸친다: 날은 머리 뒤 위쪽, 자루는 앞쪽 아래
  shovel: { hand: [-0.5, 0, -0.25], tool: [0, 0, 0] },
  axe: { hand: [-0.5, 0, -0.2], tool: [0, 0, 0] },
  // 그물 테는 어깨 너머 뒤로 넘긴다
  net: { hand: [-0.45, 0, -0.15], tool: [0, 0, 0] },
  // 낚싯대는 가볍게 쥐고 앞쪽 위로
  rod: { hand: [0.15, 0, 0], tool: [0.2, 0, -0.2] },
  // 물뿌리개는 손잡이를 쥐고 몸 옆에 늘어뜨린다
  can: { hand: [0, 0, 0], tool: [0, 0, 0] },
  // 사다리는 한 손에 세워 든다
  ladder: { hand: [-0.2, 0, -0.1], tool: [0.1, 0, 0] },
}
/** 동작할 때 도구 기울기(예전 고정값) */
const ACT_TOOL: V3 = [0.35, 0, -0.55]
/** 들고 있는 자세와 동작 자세를 섞는 시간(초) */
const ACT_BLEND = 0.12
let carryPh = 0
let actW = 0
let actLast: ActCarry | null = null
/** 던지기: 처음 0.15초는 팔을 뒤로 젖히고(와인드업), 나머지 동안 앞으로 휘두른다. 찌는 휘두르는 중간에 놓인다. */
const CAST_WIND = 0.15
const CAST_RELEASE = 0.3
function castArm(t: number): number {
  if (t < CAST_WIND) {
    const k = t / CAST_WIND
    return -1.2 - 0.3 * k * k
  }
  const k = Math.min(1, (t - CAST_WIND) / (CAST_TIME - CAST_WIND))
  return -1.5 + 2.2 * k * k
}
/** 입질 때 낚싯대가 휘는 정도(라디안). 매 프레임 목표 쪽으로 부드럽게 옮긴다. */
let rodBend = 0

/** 몸동작 시각이 닿은 효과를 터뜨린다. 무거운 타격이면 잠깐 멈추고 카메라를 흔든다. */
function flushImpacts(t: number) {
  const q = runtime.impacts
  for (let i = q.length - 1; i >= 0; i--) {
    const im = q[i]
    if (im.at > t) continue
    q.splice(i, 1)
    im.fn()
    if (im.heavy) {
      runtime.hitStop = HIT_STOP
      runtime.kick = KICK_TIME
    }
  }
}
const pose = () => currentPose

function lerpAngle(a: number, b: number, t: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + d * t
}

/** 물뿌리개 단계별 크기와 통 색. 단계가 오를수록 커지고 띠가 따뜻한 색으로 바뀐다. */
const CAN_SCALE: Record<CanLevel, number> = { 1: 1, 2: 1.2, 3: 1.4 }
const CAN_BAND: Record<CanLevel, string> = { 1: '#5aa9c9', 2: '#e8a13a', 3: '#e0683a' }
/** 물줄기 부채꼴 폭(라디안)과 날아가는 거리 배율. 1 칸은 기본값을 그대로 쓴다. */
const SPRAY: Record<CanLevel, { cone?: number; reach: number }> = { 1: { reach: 1 }, 2: { cone: 1.1, reach: 1.5 }, 3: { cone: 1.6, reach: 2.1 } }

/** 손에 든 도구. 원점이 손이고 +y 가 손잡이 끝(앞으로 들어 올리는 쪽)이다. */
/** 손에 든 우산. 비 오는 날엔 펼쳐 머리 위에 받치고, 맑은 날엔 접어 든다. 원점은 손잡이 자리다. */
function UmbrellaModel({ color, open }: { color: string; open: boolean }) {
  return (
    <group position={[0, -0.02, 0.04]}>
      <Part color="#7a5a3a" position={[0, 0.8, 0]} outline={0.05}>
        <cylinderGeometry args={[0.018, 0.018, 1.6, 6]} />
      </Part>
      {open ? (
        <Part color={color} position={[0, 1.62, 0]} scale={[1, 0.42, 1]} outline={0.08}>
          <sphereGeometry args={[0.52, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </Part>
      ) : (
        <Part color={color} position={[0, 1.2, 0]} outline={0.06}>
          <capsuleGeometry args={[0.05, 0.36, 3, 6]} />
        </Part>
      )}
    </group>
  )
}

export function ToolModel({ tool, level = 1, gold = false, rodRef }: { tool: string; level?: CanLevel; gold?: boolean; rodRef?: RefObject<THREE.Group | null> }) {
  switch (tool) {
    case 'ladder':
      return (
        <group rotation-x={-0.2}>
          {/* 두 기둥과 발판 몇 개. 손잡이 쪽이 아래다. */}
          <Part color="#c9a26b" position={[-0.14, 0.55, 0]} outline={0.1}>
            <boxGeometry args={[0.05, 1.1, 0.05]} />
          </Part>
          <Part color="#c9a26b" position={[0.14, 0.55, 0]} outline={0.1}>
            <boxGeometry args={[0.05, 1.1, 0.05]} />
          </Part>
          {[0.2, 0.45, 0.7, 0.95].map((y) => (
            <Part key={y} color="#e0b77e" position={[0, y, 0]} outline={0.08}>
              <boxGeometry args={[0.3, 0.05, 0.05]} />
            </Part>
          ))}
        </group>
      )
    case 'net':
      return (
        <group rotation-x={-0.5}>
          {/* 손잡이: 나무 자루와 감은 손잡이 테이프 */}
          <Part color="#c9a26b" position={[0, 0.5, 0]} outline={0.12}>
            <cylinderGeometry args={[0.028, 0.032, 1.05, 8]} />
          </Part>
          <Part color="#e46a52" position={[0, 0.06, 0]} outline={0.1}>
            <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
          </Part>
          {/* 테와 테를 잇는 쇠고리 */}
          <Part color="#8d97a5" position={[0, 1.03, 0]} outline={0.1}>
            <cylinderGeometry args={[0.035, 0.03, 0.08, 8]} />
          </Part>
          {/* 테는 자루와 같은 평면에 서고, 그물 주머니는 테 뒤로 처진다. */}
          <group position={[0, 1.3, 0]}>
            <mesh>
              <torusGeometry args={[0.24, 0.022, 6, 20]} />
              <Toon color="#8d97a5" />
            </mesh>
            <mesh position={[0, -0.04, -0.2]} rotation-x={-Math.PI / 2 - 0.25}>
              <coneGeometry args={[0.23, 0.42, 14, 1, true]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh position={[0, -0.04, -0.2]} rotation-x={-Math.PI / 2 - 0.25}>
              <coneGeometry args={[0.232, 0.42, 10, 3, true]} />
              <meshBasicMaterial color="#e8eef2" wireframe />
            </mesh>
          </group>
        </group>
      )
    case 'rod':
      return (
        // 옆으로 기울인 손목 틀을 되돌려 낚싯대가 앞쪽 위를 향하게 한다.
        <group rotation={[0.75, 0, 0.55]}>
          {/* 코르크 손잡이와 릴 */}
          <Part color="#d9a877" position={[0, 0.05, 0]} outline={0.1}>
            <cylinderGeometry args={[0.035, 0.04, 0.32, 10]} />
          </Part>
          <Part color="#3b2a20" position={[0, 0.23, 0]} outline={0.1}>
            <cylinderGeometry args={[0.03, 0.03, 0.05, 8]} />
          </Part>
          <group position={[0, 0.18, 0.07]}>
            <Part color="#8d97a5" rotation-x={Math.PI / 2} outline={0.08}>
              <cylinderGeometry args={[0.06, 0.06, 0.05, 14]} />
            </Part>
            <mesh position={[0.045, 0, 0.03]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.01, 0.01, 0.07, 5]} />
              <Toon color="#3b2a20" />
            </mesh>
            <mesh position={[0.085, 0, 0.03]}>
              <sphereGeometry args={[0.017, 8, 6]} />
              <Toon color="#e46a52" />
            </mesh>
          </group>
          {/* 장대: 굵은 아랫단에서 가는 끝으로, 빨간 띠와 줄 고리. 손잡이 끝을 축으로 휘어진다. */}
          <group ref={rodRef} position={[0, 0.22, 0]}>
            <Part color="#3f6fb5" position={[0, 0.63, 0]} outline={0.12}>
              <cylinderGeometry args={[0.012, 0.024, 1.25, 7]} />
            </Part>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.04, 8]} />
              <Toon color="#e46a52" />
            </mesh>
            {[0.33, 0.68, 0.98, 1.22].map((y, i) => (
              <mesh key={y} position={[0, y, 0.025 - i * 0.003]} rotation-y={Math.PI / 2}>
                <torusGeometry args={[0.022 - i * 0.003, 0.004, 4, 10]} />
                <Toon color="#c9d2dc" />
              </mesh>
            ))}
          </group>
        </group>
      )
    case 'shovel':
      return (
        <group>
          <Part color="#b07a45" position={[0, 0.42, 0]} outline={0.12}>
            <cylinderGeometry args={[0.032, 0.036, 0.88, 8]} />
          </Part>
          {/* 손잡이 끝 그립 */}
          <Part color="#5fa35f" position={[0, -0.02, 0]} outline={0.1}>
            <capsuleGeometry args={[0.045, 0.12, 4, 8]} />
          </Part>
          {/* 쇠 목과 삽날: 둥근 날 위에 가운데 골 */}
          <Part color="#8d97a5" position={[0, 0.9, 0]} outline={0.1}>
            <cylinderGeometry args={[0.04, 0.05, 0.1, 8]} />
          </Part>
          <Part color="#b9c7d3" position={[0, 1.08, 0.02]} scale={[1, 1.2, 0.3]} outline={0.08}>
            <sphereGeometry args={[0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          </Part>
          <mesh position={[0, 1.08, 0.065]} scale={[0.15, 1, 0.15]}>
            <boxGeometry args={[0.1, 0.22, 0.1]} />
            <Toon color="#8d97a5" />
          </mesh>
        </group>
      )
    case 'axe':
      return (
        <group>
          {/* 살짝 휜 자루: 두 토막을 이어 붙인다 */}
          <Part color="#b07a45" position={[0, 0.3, 0]} outline={0.12}>
            <cylinderGeometry args={[0.034, 0.04, 0.62, 8]} />
          </Part>
          <Part color="#b07a45" position={[0, 0.7, 0.02]} rotation-x={0.1} outline={0.12}>
            <cylinderGeometry args={[0.032, 0.034, 0.24, 8]} />
          </Part>
          <Part color="#3b2a20" position={[0, 0.05, 0]} outline={0.1}>
            <cylinderGeometry args={[0.045, 0.045, 0.1, 8]} />
          </Part>
          {/* 도끼머리: 쐐기 모양 쇠와 반짝이는 날 */}
          <group position={[0, 0.8, 0.03]}>
            <Part color="#7d8a96" position={[0, 0, 0.06]} scale={[0.5, 1, 1]} outline={0.08}>
              <boxGeometry args={[0.1, 0.16, 0.16]} />
            </Part>
            <Part color="#b9c7d3" position={[0, 0, 0.17]} rotation-x={Math.PI / 2} scale={[0.35, 1, 1]} outline={0.08}>
              <cylinderGeometry args={[0.15, 0.08, 0.1, 3]} />
            </Part>
          </group>
        </group>
      )
    case 'can':
      return (
        <group position={[0, -0.12, 0.08]} scale={CAN_SCALE[level]}>
          {/* 통: 둥근 몸통과 테두리 띠 */}
          {/* 황금 물뿌리개(별 다섯 개 보상)는 통 색만 금빛으로 바꾼다 */}
          <Part color={gold ? '#f2c14e' : '#7ec8e3'} outline={0.08}>
            <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
          </Part>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.152, 0.152, 0.03, 16]} />
            <Toon color={CAN_BAND[level]} />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.172, 0.172, 0.03, 16]} />
            <Toon color={CAN_BAND[level]} />
          </mesh>
          {/* 앞쪽 물방울 그림 */}
          <mesh position={[0, 0, 0.165]} scale={[1, 1.3, 0.3]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* 주둥이와 꽃잎처럼 구멍 뚫린 물뿌리개 머리 */}
          <Part color="#7ec8e3" position={[0, 0.06, 0.27]} rotation={[1.1, 0, 0]} outline={0.12}>
            <cylinderGeometry args={[0.022, 0.04, 0.34, 8]} />
          </Part>
          <group position={[0, 0.15, 0.43]} rotation-x={1.1}>
            <Part color="#f5d25a" outline={0.1}>
              <cylinderGeometry args={[0.06, 0.035, 0.05, 12]} />
            </Part>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <mesh key={i} position={[Math.cos(i) * 0.032, 0.026, Math.sin(i) * 0.032]}>
                <sphereGeometry args={[0.008, 5, 4]} />
                <meshBasicMaterial color="#3b2a20" />
              </mesh>
            ))}
          </group>
          {/* 위 손잡이 */}
          <mesh position={[0, 0.17, -0.02]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.1, 0.022, 6, 12, Math.PI]} />
            <Toon color="#5aa9c9" />
          </mesh>
        </group>
      )
    default:
      return null
  }
}

/** 대화 상대가 서 있는 곳. 펠리컨은 가장 가까운 부두에 있다. */
function talkPartner(id: string | undefined): { x: number; z: number } | null {
  if (!id) return null
  // 집들이 손님은 방 안에 있어서 바깥 섬 기준의 대화 구도를 쓰지 않는다(방 카메라를 그대로 둔다)
  if (runtime.visit && id === runtime.visit.villagerId) return null
  const p = runtime.player
  if (id === 'pelican') {
    const d = DOCKS.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b))
    return { x: d.x, z: d.z }
  }
  const v = VILLAGERS.find((x) => x.id === id)
  return v ? villagerAt(v, useGame.getState().houses) : null
}

/** 카메라와 두 얼굴 사이를 가리는 게 있는지. 나무·바위·상점·집·다른 주민을 본다. */
function blocksView(x: number, z: number, houses: readonly string[], skip: string): boolean {
  if (inRoomArea(x)) return roomViewBlocked(x, z)
  if (blockedByProps(x, z, 0.9) || blockedByHouses(x, z, houses, 0.7)) return true
  // 아직 안 지은 집터의 말뚝과 표지판도 카메라 바로 앞에 오면 화면을 가린다.
  const recruits = useGame.getState().recruits
  if (VILLAGERS.some((v) => hasPlot(v, recruits) && Math.hypot(v.house.x - x, v.house.z - z) < 1.9)) return true
  return presentVillagers(houses).some((v) => {
    if (v.id === skip) return false
    const q = villagerAt(v, houses)
    return Math.hypot(q.x - x, q.z - z) < 0.6
  })
}

function clearLine(ax: number, az: number, bx: number, bz: number, houses: readonly string[], skip: string): boolean {
  // 끝(얼굴) 바로 앞은 대화 상대 자신이니 빼고 본다.
  for (let i = 0; i <= 14; i++) {
    const k = (i / 14) * 0.8
    if (blocksView(ax + (bx - ax) * k, az + (bz - az) * k, houses, skip)) return false
  }
  return true
}

/**
 * 대화 구도 고르기. 기본은 플레이어 어깨 너머 3/4 구도이고, 나무나 집이 가리면 반대편·각도·거리를 바꿔 본다.
 * 다 막히면 위에서 내려다보는 높은 구도로 물러난다.
 */
function pickTalkShot(p: { x: number; z: number }, partner: { x: number; z: number }, houses: readonly string[], skip: string, pull: number, my: number) {
  const dx = partner.x - p.x
  const dz = partner.z - p.z
  const sep = Math.max(0.5, Math.hypot(dx, dz))
  const ux = dx / sep
  const uz = dz / sep
  // 두 사람을 잇는 선에 수직인 방향 중 원래 카메라 쪽(+z)을 먼저 본다.
  const pref = -ux >= 0 ? 1 : -1
  // 주민 쪽으로 무게를 둬서 주민이 화면 가운데 가깝게 온다.
  const lx = p.x + dx * 0.7
  const lz = p.z + dz * 0.7
  // 절벽·둑 윗면에 가려지는지: 얼굴은 지면에서 머리 높이, 카메라는 두 발 평균 높이 위에 있다.
  const faces = [p, partner].map((q) => ({ x: q.x, z: q.z, y: heightAt(q.x, q.z) + TALK_EYE_HEIGHT }))
  const hiddenByTerrain = (x: number, z: number, h: number) => terrainBlocksSight({ x, y: my + h, z }, faces, heightAt)
  // 벽·나무에 안 막힌 자리 중 플레이어 머리를 가장 잘 비켜 가는 곳을 고른다.
  // 플레이어가 카메라에 너무 붙으면 뒤통수가 화면 절반을 덮으니, 둘까지 거리가 비슷한(옆에 가까운) 자리를 먼저 본다.
  let best: { x: number; z: number; h: number; lx: number; lz: number } | null = null
  let bestScore = 0
  for (const scale of [1, 0.78, 0.6]) {
    for (const side of [pref, -pref]) {
      for (const back of [0.55, 0.3, 0.85, 1.2]) {
        const nx = -uz * side - ux * back
        const nz = ux * side - uz * back
        const nl = Math.hypot(nx, nz)
        const dist = (4.4 + sep * 0.8) * pull * scale
        const x = lx + (nx / nl) * dist
        const z = lz + (nz / nl) * dist
        if (blocksView(x, z, houses, skip)) continue
        if (!clearLine(x, z, p.x, p.z, houses, skip) || !clearLine(x, z, partner.x, partner.z, houses, skip)) continue
        const h = 1.75 * (0.6 + scale * 0.4)
        if (hiddenByTerrain(x, z, h)) continue
        const shot = { x, z, h, lx, lz }
        const gap = segDist(p.x, p.z, x, z, partner.x, partner.z)
        const near = Math.hypot(p.x - x, p.z - z) / Math.hypot(partner.x - x, partner.z - z)
        if (gap >= 0.85 && near >= 0.72) return shot
        const score = Math.min(gap, 1) * Math.min(near, 1)
        if (gap > 0.35 && score > bestScore) [best, bestScore] = [shot, score]
      }
    }
  }
  if (best) return best
  // 다 막히면 카메라를 점점 높여 위에서 내려다보는 구도로 간다. 끝까지 막히면 가장 높은 자리를 쓴다.
  const nx = -uz * pref - ux * 0.6
  const nz = ux * pref - uz * 0.6
  const nl = Math.hypot(nx, nz)
  const tops = [4.2, 6, 8].map((h) => ({ x: lx + (nx / nl) * 3.2, z: lz + (nz / nl) * 3.2, h, lx, lz }))
  return tops.find((s) => !hiddenByTerrain(s.x, s.z, s.h)) ?? tops[tops.length - 1]
}

/** 점 (px,pz) 에서 선분 a→b 까지의 거리 */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax
  const vz = bz - az
  const k = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)))
  return Math.hypot(px - (ax + vx * k), pz - (az + vz * k))
}

/**
 * 자랑 구도: 지금 카메라가 있는 쪽에서 시작해 좌우로 돌려 가며 가리지 않는 자리를 찾는다.
 * 주인공은 그 카메라를 향해 돌아서서 잡은 것을 들어 보인다. 다 막히면 평소 카메라 그대로.
 */
function pickShowShot(p: { x: number; z: number }, houses: readonly string[], cam: THREE.Vector3): { x: number; z: number; a: number } | null {
  const a0 = Math.atan2(cam.x - p.x, cam.z - p.z)
  for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
    const a = a0 + da
    const x = p.x + Math.sin(a) * 4.3
    const z = p.z + Math.cos(a) * 4.3
    if (!blocksView(x, z, houses, '') && clearLine(x, z, p.x, p.z, houses, '')) return { x, z, a }
  }
  return null
}

let showShot: { x: number; z: number; a: number } | null = null
const showPos = new THREE.Vector3()
const showLook = new THREE.Vector3()

/** 대화할 때 두 캐릭터 사이 최소 거리. 머리 지름보다 넉넉하다. */
const TALK_GAP = 1.7

let stepClock = 0.5
/** 지금 달리는 속도(RUN 쪽으로 RAMP_TIME 동안 올라간다) */
let moveSpeed = WALK
let wasRunning = false
/** 카메라에 이번 프레임 더한 흔들림 오프셋. 다음 프레임에 빼 준다. */
const kickOff = new THREE.Vector3()

let talkShot: { key: string; x: number; z: number; h: number; lx: number; lz: number } | null = null

const talkPos = new THREE.Vector3()
const talkLook = new THREE.Vector3()
const followLook = new THREE.Vector3()
/** 벤치에 앉아 바다를 보는 시선: 0~1 로 천천히 올라간다 */
let benchCam = 0
const benchSea = new THREE.Vector3()
/** 장터 패널을 열면 카메라가 가판대 앞으로 옮겨 간다. */
const marketPos = new THREE.Vector3()
const marketLook = new THREE.Vector3()
const firePos = new THREE.Vector3()
const fireLook = new THREE.Vector3()
const skyPos = new THREE.Vector3()
const skyLook = new THREE.Vector3()
const smooth = (k: number) => k * k * (3 - 2 * k)

export function Player() {
  const root = useRef<THREE.Group>(null)
  const hand = useRef<THREE.Group>(null)
  const tool = useGame((s) => s.tool)
  const canLevel = useGame((s) => s.canLevel)
  const goldCan = useGame((s) => s.goldCan)
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const toolWrap = useRef<THREE.Group>(null)
  const ladderRef = useRef<THREE.Group>(null)
  const rodTip = useRef<THREE.Group>(null)
  /** 두 손으로 쥘 때 왼손이 자루에 붙는 자리 */
  const grip = useRef<THREE.Group>(null)
  // 갈아입는 중이면 새 옷은 연기가 피는 순간(DRESS_SWAP)에 그린다
  const wearNow = useGame((s) => s.wear)
  const [wear, setWear] = useState(wearNow)
  useEffect(() => {
    if (wearNow === wear) return
    if (!runtime.dress) return setWear(wearNow)
    const id = setTimeout(() => {
      setWear(wearNow)
      const p = runtime.player
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        burst({ kind: 'puff', x: p.x + Math.cos(a) * 0.45, y: p.y + 0.35 + (i % 2) * 0.5, z: p.z + Math.sin(a) * 0.45 })
      }
      burst({ kind: 'sparks', x: p.x, y: p.y + 1.1, z: p.z })
    }, DRESS_SWAP * 1000)
    return () => clearTimeout(id)
  }, [wearNow, wear])
  // 무지 티셔츠에 입힌 마이 디자인 앞판
  const shirtCells = useGame((s) => (s.shirtDesign ? s.designs.find((d) => d.id === s.shirtDesign)?.cells : undefined))
  const print = useMemo(() => (wear.outfit === 'shirt-plain' && shirtCells ? designLayers(shirtCells, 0.34, 0.34) : null), [wear.outfit, shirtCells])
  const wet = useGame((s) => s.wet)
  // 주머니의 첫 우산을 손에 든다. 비가 오면 펼쳐 머리 위에 받친다.
  const umbrella = useGame((s) => carriedUmbrella(s.inventory))
  const rainyNow = useGame((s) => weatherFor(s.day) === 'rain')
  // 젖으면 옷과 몸의 색을 조금 바랜 회색 쪽으로 옮긴다
  const look = useMemo<Look>(() => {
    const base: Look = { ...BASE_LOOK, outfit: WEAR_BY_ID[wear.outfit]?.color ?? BASE_LOOK.outfit, hat: wear.hat, print }
    if (!wet) return base
    const out = { ...base } as Record<string, unknown>
    for (const k of Object.keys(out)) if (typeof out[k] === 'string') out[k] = desaturate(out[k] as string, 0.45)
    return out as unknown as Look
  }, [wear, print, wet])
  const gl = useThree((s) => s.gl)

  useEffect(() => bindInput(onKey, (e) => {
    // 대화(talk)는 Space 로 넘기므로 패널로 치지 않는다
    const panel = useGame.getState().panel
    // 타이틀 화면 동안에는 키를 게임 입력으로 받지 않는다(Enter·Space 시작은 Title 이 받는다)
    if (useGame.getState().title) return true
    return enterBelongsToBag(e.code, e.target) || spaceBelongsToUi(e.code, e.target, panel !== null && panel !== 'talk')
  }), [])
  useEffect(() => bindZoom(gl.domElement), [gl])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = useGame.getState()
    const p = runtime.player

    const wasBite = runtime.fishing.phase === 'bite'
    if (runtime.fishing.phase !== 'idle') {
      // 도구를 바꾸거나 상점을 열면 낚시는 그대로 접는다.
      if (s.tool !== 'rod' || s.panel) {
        // 찌를 띄운 채 패널을 열었으면 접었다고 알려 준다(말없이 사라지면 버그처럼 보인다).
        if (s.panel && s.panel !== 'talk' && runtime.fishing.phase !== 'reel') s.notify('🎣 낚싯줄을 거뒀어요')
        runtime.fishing = { phase: 'idle' }
      }
      else {
        const prev = runtime.fishing
        const [next, ev] = tickFishing(prev, dt)
        runtime.fishing = next
        // 낚아 올리거나 놓치면 그 자리에 큰 파문이 남는다.
        if (ev?.type === 'escaped' && 'x' in prev) ripple(prev.x, prev.z, 1.6)
        onFishingEvent(ev)
        if (next.phase !== 'idle') {
          // 찌가 물에 닿으면 작은 파문, 입질이 오면 크게 두 번 퍼진다.
          if (!wasBite && next.phase === 'bite') {
            // 입질은 물이 확 튀는 순간: 가까운 파문 하나, 조금 큰 파문 하나, 물보라 두 줄기.
            const wy = waterLevelAt(next.x, next.z) ?? 0
            ripple(next.x, next.z, 1.4)
            rippleAt(next.x, next.z, 2.3)
            burst({ kind: 'splash', x: next.x, y: wy + 0.05, z: next.z })
            burst({ kind: 'splash', x: next.x, y: wy + 0.14, z: next.z })
          }
        }
        if (!wasBite && next.phase === 'bite') play('bite')
      }
    }

    const act = runtime.act
    if (act) {
      // 타격 순간엔 몸동작 시계를 잠깐 세워 힘이 실린 느낌을 준다(히트스톱).
      if (runtime.hitStop > 0) runtime.hitStop = Math.max(0, runtime.hitStop - dt)
      else act.t += dt
      flushImpacts(act.t)
      if (act.t >= ACT_TIME[act.kind]) runtime.act = null
    } else if (runtime.impacts.length) flushImpacts(Infinity)
    // 사진 모드에서는 걷지 않는다(WASD 는 카메라를 돌린다)
    const locked = s.panel !== null || runtime.fishing.phase !== 'idle' || runtime.act !== null || runtime.climb !== null || s.photo || runtime.dive !== null
    let ix = (isHeld('KeyD', 'ArrowRight') ? 1 : 0) - (isHeld('KeyA', 'ArrowLeft') ? 1 : 0) + runtime.stick.x
    let iz = (isHeld('KeyS', 'ArrowDown') ? 1 : 0) - (isHeld('KeyW', 'ArrowUp') ? 1 : 0) + runtime.stick.z
    const len = Math.hypot(ix, iz)
    // 앉아 있다가 움직이려 하면 일어난다.
    if (runtime.seat && !s.panel && !s.photo && len > 0.15) standUp()
    // 망원경으로 올려다보다 움직이면 내려온다.
    if (runtime.telescope && len > 0.15) runtime.telescope = false
    const seat = runtime.seat
    p.moving = !locked && !seat && len > 0.15
    if (p.moving) {
      // 조이스틱을 끝까지 밀면 달리기, 조금 밀면 걷기
      const push = Math.min(1, len)
      ix /= len
      iz /= len
      p.running = isHeld('ShiftLeft', 'ShiftRight') || Math.hypot(runtime.stick.x, runtime.stick.z) > 0.92
      // 달리기는 바로 최고 속도가 되지 않고 RAMP_TIME 동안 올라간다.
      // 요리 효과(파이·쿠키)가 남아 있으면 달리기가 더 빨라진다
      // 수영 중엔 물살을 가르느라 느리게 간다
      const target = runtime.swim ? SWIM_SPEED * Math.max(0.5, push) : p.running ? RUN * (now() < runtime.hasteUntil ? HASTE_MUL : 1) : WALK * Math.max(0.5, push)
      const step = ((RUN - WALK) / RAMP_TIME) * dt
      moveSpeed += Math.max(-step, Math.min(step, target - moveSpeed))
      const speed = moveSpeed
      const villagers = presentVillagers(s.houses).map((v) => villagerAt(v, s.houses))
      // 반경 pad 만큼 몸을 두고 그 자리에 설 수 있는지. 덤불·통나무·물건·집·울타리 모두 본다.
      const standsAt = (x: number, z: number, pad: number) =>
        (inRoomArea(x) ? roomWalkable(x, z, pad) : isWalkable(x, z) && !blockedByProps(x, z, pad, s.felled, s.day) && !blockedByHoles(x, z, s.holes, pad)) &&
        !blockedByScenery(x, z, pad) &&
        !blockedByPlaced(x, z, s.placed, pad) &&
        !blockedByHouses(x, z, s.houses, pad)
      const solid = (x: number, z: number) => standsAt(x, z, 0.3) && !villagers.some((v) => (v.x - x) ** 2 + (v.z - z) ** 2 < VILLAGER_R * VILLAGER_R)
      // 가장 가까운 물건까지 남은 여유(대략). 큰 값일수록 멀리 떨어진 자리다.
      const clearance = (x: number, z: number) => {
        for (let pad = 1.5; pad > -1.5; pad -= 0.1) if (standsAt(x, z, pad)) return pad
        return -2
      }
      // 어떤 이유로든 물건 안에 서 있게 되면(방금 지은 집 등) 지금보다 덜 막힌 쪽으로만 움직이게 풀어 준다.
      const stuck = !solid(p.x, p.z)
      const cur = stuck ? clearance(p.x, p.z) : 0
      // 수영 중엔 물 위도 다닐 수 있다. 범위(섬 둘레 안)만 본다.
      const ok = (x: number, z: number) => (runtime.swim ? swimOK(x, z) : stuck ? (inRoomArea(x) ? roomWalkable(x, z, 0) : isWalkable(x, z)) && clearance(x, z) >= cur : solid(x, z))
      // 축마다 따로 막아서 벽을 따라 미끄러지게 한다.
      const x0 = p.x
      const z0 = p.z
      const nx = p.x + ix * speed * dt
      if (ok(nx, p.z)) p.x = nx
      const nz = p.z + iz * speed * dt
      if (ok(p.x, nz)) p.z = nz
      // 두 축 모두 막혔으면 방향을 틀어 물건 모서리를 돌아간다.
      if (p.x === x0 && p.z === z0) {
        const slid = slideStep(p.x, p.z, ix * speed * dt, iz * speed * dt, ok)
        if (slid) {
          p.x += slid[0]
          p.z += slid[1]
        }
      }
      p.facing = lerpAngle(p.facing, Math.atan2(ix, iz), 1 - Math.exp(-14 * dt))
    } else moveSpeed = WALK
    // 달리다 멈추면 발밑에서 먼지가 한 번 인다.
    if (wasRunning && !p.moving) burst({ kind: 'puff', x: p.x - Math.sin(p.facing) * 0.25, y: p.y + 0.08, z: p.z - Math.cos(p.facing) * 0.25 })
    wasRunning = p.moving && p.running
    // 발소리: 걸음 박자마다 밟은 땅에 맞는 소리. 물 위면 부두·다리 나무 판자다.
    if (p.moving) {
      const before = stepClock
      stepClock += dt * (p.running ? 5.2 : 3.4)
      if (Math.floor(stepClock) !== Math.floor(before)) {
        // 개울 다리도 나무 판자 소리
        const g = onBridge(p.x, p.z) ? 'water' : groundAt(p.x, p.z)
        const winter = !onTrip(p.x) && seasonFor(s.day) === 'winter'
        // 얕은 개울을 걸어 건널 땐 발밑에서 물이 튀고 파문이 퍼진다.
        const wl = waterLevelAt(p.x, p.z)
        const wading = !onBridge(p.x, p.z) && wl !== null && heightAt(p.x, p.z) < wl
        // 웅덩이를 밟으면 첨벙 소리와 물방울이 튄다(짧은 간격으로만)
        if (!wading && runtime.puddleLevel > 0.5 && runtime.puddleSpots.some((w) => (w.x - p.x) ** 2 + (w.z - p.z) ** 2 < 0.7 * 0.7) && now() - lastSplash > 0.35) {
          lastSplash = now()
          play('splash')
          burst({ kind: 'water', x: p.x, y: p.y + 0.05, z: p.z, dir: p.facing })
        }
        if (wading) {
          ripple(p.x, p.z, 0.7)
          burst({ kind: 'water', x: p.x, y: wl + 0.05, z: p.z, dir: p.facing })
        } else if (g === 'sand' || (winter && g === 'grass')) {
          // 모래·눈밭엔 발자국이 왼발·오른발 번갈아 찍힌다.
          leftFoot = !leftFoot
          const side = leftFoot ? 0.09 : -0.09
          runtime.footprints.push({ x: p.x + Math.cos(p.facing) * side, z: p.z - Math.sin(p.facing) * side, rot: p.facing, t0: now(), snow: g !== 'sand' })
          if (runtime.footprints.length > FOOTPRINT_MAX) runtime.footprints.shift()
          if (p.running && g === 'sand') burst({ kind: 'puff', x: p.x - Math.sin(p.facing) * 0.25, y: p.y + 0.08, z: p.z - Math.cos(p.facing) * 0.25 })
        } else if (p.running && !winter && g !== 'water') {
          // 달릴 땐 발뒤꿈치에서 흙먼지가 폴폴 인다.
          burst({ kind: 'puff', x: p.x - Math.sin(p.facing) * 0.25, y: p.y + 0.08, z: p.z - Math.cos(p.facing) * 0.25 })
        }
        footstep(wading ? 'sand' : g === 'water' ? 'wood' : g === 'sand' ? 'sand' : winter ? 'snow' : 'grass', p.running ? 1.2 : 1)
      }
    } else stepClock = 0.5
    // 사다리로 절벽을 오르내리는 중: 출발에서 도착까지 가는 동안 가운데를 살짝 띄운다.
    const climb = runtime.climb
    if (climb) {
      climb.t += dt
      const k = Math.min(1, climb.t / CLIMB_TIME)
      const e = k * k * (3 - 2 * k)
      p.x = climb.from.x + (climb.to.x - climb.from.x) * e
      p.z = climb.from.z + (climb.to.z - climb.from.z) * e
      p.y = climb.from.y + (climb.to.y - climb.from.y) * e + Math.sin(k * Math.PI) * 0.3
      p.moving = false
      if (k >= 1) runtime.climb = null
    }
    if (ladderRef.current) {
      ladderRef.current.visible = !!climb
      if (climb) {
        // 사다리는 절벽 면 앞에 세운다. 바닥에서 윗가장자리까지 높이만큼 늘린다.
        const dx = climb.to.x - climb.from.x
        const dz = climb.to.z - climb.from.z
        const dh = Math.hypot(dx, dz) || 1
        const bottom = Math.min(climb.from.y, climb.to.y)
        const top = Math.max(climb.from.y, climb.to.y)
        // 올라갈 때는 낮은 쪽 절벽 앞에 세운다. 내려갈 때는 윗자락 바깥 끝에 걸어 세워야 위에서 보인다(윗자락 아래는 가려진다).
        const ax = climb.up ? (climb.from.x + climb.to.x) / 2 - (dx / dh) * 0.6 : climb.from.x + (dx / dh) * 0.3
        const az = climb.up ? (climb.from.z + climb.to.z) / 2 - (dz / dh) * 0.6 : climb.from.z + (dz / dh) * 0.3
        ladderRef.current.position.set(ax, bottom - 0.3, az)
        ladderRef.current.rotation.y = Math.atan2(-dx, -dz)
        ladderRef.current.scale.y = top - bottom + 0.6
      }
    }
    if (seat) {
      p.x = seat.x
      p.z = seat.z
      // 몸통 바닥(로컬 0.2)이 앉는 면에 닿도록 내린다.
      // 누우면 몸통이 이불 위에 놓이도록 띄운다(몸통 두께 0.25, 머리 반지름 0.4). 앉으면 엉덩이가 의자 면에 닿게 내린다.
      p.y = seat.lie ? seat.y + LIE_LIFT : seat.y - 0.2
      p.facing = lerpAngle(p.facing, seat.facing, 1 - Math.exp(-12 * dt))
    } else if (!climb) {
      if (runtime.swim) p.y = swimY(runtime.dive)
      else {
        // 발 높이는 footY 가 정한다. 계단 위에서 한 칸(STEP_RISER) 이하로 낮아지면 바로 붙고, 그 밖의 1 미만 차이는 짧게 따라간다.
        // 오를 때는 발이 땅 밑에 묻히지 않게 거의 바로(200), 내려갈 때는 부드럽게(12) 따라간다. 1 이상(절벽 밑 등)은 바로 지면으로 간다.
        p.y = footY(p.y, heightAt(p.x, p.z), onStepSpot(p.x, p.z), dt)
      }
    }

    const t = state.clock.elapsedTime
    if (runtime.swim) {
      // 범위 밖으로 나가려 하면 가운데 쪽으로 부드럽게 되밀고 한 번 알려 준다
      const pb = swimPushback(p.x, p.z, dt)
      p.x += pb.dx
      p.z += pb.dz
      if (pb.far && now() - runtime.swimWarnAt > 2.5) {
        runtime.swimWarnAt = now()
        useGame.getState().notify('🌊 너무 멀어요. 여기까지만 갈 수 있어요')
      }
      // 물에 들어갔다가 물가에 다시 닿으면 걸어 나온다
      const under = groundAt(p.x, p.z)
      if (under === 'water') runtime.swim.wet = true
      else if (runtime.swim.wet) useGame.getState().stopSwim()
      // 잠수가 수면으로 솟는 순간 물보라를 한 번 낸다
      if (runtime.dive && now() - runtime.dive.t0 >= DIVE_RISE && diveSplashT0 !== runtime.dive.t0) {
        diveSplashT0 = runtime.dive.t0
        burst({ kind: 'splash', x: p.x, y: SURFACE_Y, z: p.z })
      }
    }
    if (root.current) {
      // 물에 있는 동안은 몸 그림자를 끈다(수면에 어두운 얼룩으로 비쳐 보인다)
      const inWater = !!runtime.swim
      if (inWater !== waterShadowOff && root.current) {
        waterShadowOff = inWater
        root.current.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = !inWater
        })
      }
      root.current.position.set(p.x, p.y, p.z)
      // 갈아입기: 천천히 시작해 빠르게 한 바퀴 돌고 살짝 뛴다
      let spin = 0
      if (runtime.dress) {
        const k = (now() - runtime.dress.t0) / DRESS_TIME
        if (k >= 1) runtime.dress = null
        else {
          const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
          spin = e * Math.PI * 2
          root.current.position.y += Math.sin(k * Math.PI) * 0.12
        }
      }
      root.current.rotation.y = p.facing + spin
    }

    if (runtime.shake) {
      runtime.shake.t += dt
      if (runtime.shake.t > SHAKE_TIME) runtime.shake = null
    }
    // 자랑하거나 앉았거나 대화하는 동안엔 도구를 넣는다. 긴 낚싯대가 상대 얼굴을 뚫지 않게.
    if (toolWrap.current) toolWrap.current.visible = runtime.act?.kind !== 'show' && !runtime.seat && !runtime.climb && s.panel !== 'talk' && !s.caption
    if (hand.current && toolWrap.current) {
      const f = runtime.fishing
      const a = runtime.act
      // 입질이 오면 낚싯대가 찌 쪽으로 휘며 떨린다. 풀리면 천천히 제자리로 돌아온다.
      const bendTo = f.phase === 'bite' ? 0.35 + Math.sin(t * 34) * 0.05 : 0
      rodBend += (bendTo - rodBend) * (1 - Math.exp(-dt * 14))
      if (rodTip.current) rodTip.current.rotation.x = rodBend
      // 들고 다니는 자세: 걸으면 도구 자세가 살짝 출렁이고(팔은 휘두르지 않는다), 달리면 조금 앞으로 숙인다.
      carryPh += dt * (p.moving ? 11 * (p.running ? 1.5 : 1) : 0)
      const bob = p.moving ? Math.sin(carryPh) : 0
      const run = p.moving && p.running ? 1 : 0
      const c = CARRY[s.tool] ?? CARRY.hand
      const carryHand: V3 = [c.hand[0] - run * 0.12 + bob * 0.03, 0, c.hand[2] + bob * 0.05]
      const carryTool: V3 = [c.tool[0] + bob * 0.03, 0, c.tool[2]]
      const carryLean = (p.moving ? 0.04 : 0) + run * 0.1
      let act: ActCarry | null = null
      if (a) {
        const r = actPose(a.kind, Math.min(1, a.t / ACT_TIME[a.kind]), t)
        // 축 두 손 동작: 자루를 두 손으로 쥐고 내려친다(팔이 닿는 도끼·삽만).
        const grip = (s.tool === 'axe' || s.tool === 'shovel') && (a.kind === 'chop' || a.kind === 'hit' || a.kind === 'dig')
        act = { hand: [r.rx, 0, r.rz ?? 0], tool: ACT_TOOL, lean: r.pose.lean ?? 0, pose: r.pose, grip }
        // 물뿌리개는 동작하는 동안 주둥이에서 물줄기가 계속 나온다. 넓은 통일수록 부채꼴로 멀리 뿌린다.
        if (a.kind === 'water' && Math.floor(a.t / 0.08) !== Math.floor((a.t - dt) / 0.08)) {
          const fx = runtime.waterFx
          const sp = SPRAY[fx?.level ?? 1]
          const dir = fx?.dir ?? p.facing
          burst({ kind: 'water', x: p.x + Math.sin(dir) * 0.8, y: p.y + 0.55, z: p.z + Math.cos(dir) * 0.8, dir, cone: sp.cone, reach: sp.reach })
        }
      } else if (runtime.seat) {
        // 무릎에 손을 얹고 다리를 살랑살랑 (도구는 toolWrap 이 숨긴다). 누웠으면 몸을 눕힌다.
        act = { hand: [-0.35, 0, 0], tool: ACT_TOOL, lean: 0, pose: runtime.seat.lie ? { lie: 1, armL: 0 } : { sit: 1, armL: -0.35 }, grip: false }
      } else if (f.phase === 'cast') act = { hand: [castArm(f.t), 0, 0], tool: ACT_TOOL, lean: 0, pose: {}, grip: false }
      else if (runtime.climb) act = { hand: [-1.3 + Math.sin(runtime.climb.t * 9) * 0.35, 0, 0], tool: ACT_TOOL, lean: 0.25, pose: {}, grip: false }
      else if (f.phase === 'reel') act = { hand: [-0.9 * (1 - f.t / REEL_TIME), 0, 0], tool: ACT_TOOL, lean: 0, pose: {}, grip: false }
      else if (f.phase === 'bite') act = { hand: [Math.sin(t * 40) * 0.25, 0, 0], tool: ACT_TOOL, lean: 0, pose: {}, grip: false }
      // 동작이 시작하거나 끝날 때 0.12 초 동안 들고 있는 자세와 섞는다. 칼날 시각은 act.t 가 그대로 정한다.
      if (act) {
        actLast = act
        actW = Math.min(1, actW + dt / ACT_BLEND)
      } else actW = Math.max(0, actW - dt / ACT_BLEND)
      const A = actLast
      const w = actW
      const mix = (x: number, y: number) => x + (y - x) * w
      const h: V3 = A && w > 0 ? [mix(carryHand[0], A.hand[0]), 0, mix(carryHand[2], A.hand[2])] : carryHand
      const tl: V3 = A && w > 0 ? [mix(carryTool[0], A.tool[0]), 0, mix(carryTool[2], A.tool[2])] : carryTool
      hand.current.rotation.set(h[0], h[1], h[2])
      // 하트는 두 손을 가슴 앞에 모은다(왼손은 자세, 오른손은 여기서)
      if (s.photo && s.photoPose === 'heart') hand.current.rotation.x = -1.4
      // 브이는 오른손도 바깥으로 벌려 두 팔이 V자가 되게 한다
      if (s.photo && s.photoPose === 'v') hand.current.rotation.set(-3.1, 0, 0.9)
      toolWrap.current.rotation.set(tl[0], tl[1], tl[2])
      const gripOn = !!act && act.grip
      if (grip.current) grip.current.visible = gripOn && w > 0.5
      const lean = A && w > 0 ? mix(carryLean, A.lean) : carryLean
      // 두 손으로 잡으면 왼팔은 몸 뒤로 넘겨 빈 손이 보이지 않게 한다.
      const pose: Pose = A && w > 0 ? { ...A.pose, lean } : { lean }
      if (gripOn) pose.armL = Math.PI / 2
      currentPose = pose
      // 사진 모드 자세는 몸동작 위에 덮어쓴다
      if (s.photo && s.photoPose) currentPose = photoPosePose(s.photoPose, t)
      // 수영: 두 팔이 번갈아 앞으로 젓는다. 떠 있을 땐 조금만 움직인다.
      if (runtime.swim && !runtime.dive) {
        // 두 팔이 번갈아 앞으로 젓는다(왼팔과 오른손은 반대 위상). 떠 있을 땐 물장구처럼 천천히 휘젓는다.
        const stroke = p.moving ? Math.sin(t * 6) * 0.9 : Math.sin(t * 3.2) * 0.4
        const base = p.moving ? -0.9 : -0.6
        currentPose = { armL: base + stroke, lean: 0.3 }
        hand.current.rotation.x = base - stroke
        // 헤엄치면 자주, 떠 있으면 가끔 물결이 몸 둘레로 퍼진다
        const gap = p.moving ? 0.45 : 1.6
        if (t - lastSwimRipple > gap) {
          lastSwimRipple = t
          ripple(p.x, p.z, p.moving ? 0.8 : 0.5)
        }
      }
    }

    // 우산 없이 비를 맞으면 젖기 시작하고, 젖은 동안 가끔 재채기를 한다. 집에 들어가거나 비가 그치면 마른다.
    // 프레임이 느려도 실제 시간으로 잰다(탭을 떠났다 돌아온 긴 간격은 0.5초까지만 센다)
    const covered = !!carriedUmbrella(s.inventory)
    runtime.rainSeconds = weatherFor(s.day) === 'rain' && !s.inHome && !covered ? runtime.rainSeconds + Math.min(delta, 0.5) : 0
    const wetNow = isWet(runtime.rainSeconds)
    if (wetNow !== s.wet) useGame.setState({ wet: wetNow })
    const sneezeT = wetNow ? sneezeAt(now()) : -1
    const sneezeNow = sneezeT >= 0
    // 재채기가 시작하는 순간 얼굴 앞에 흰 입김 세 덩이가 튄다(얼굴 앞 가로로 조금씩 떨어뜨린다)
    if (sneezeNow && !sneezeOn) {
      const fx = Math.sin(p.facing)
      const fz = Math.cos(p.facing)
      for (const side of [-0.08, 0, 0.08]) {
        burst({ kind: 'puff', x: p.x + fx * 0.4 + fz * side, y: p.y + 1.6, z: p.z + fz * 0.4 - fx * side })
      }
    }
    sneezeOn = sneezeNow
    // 0.15초 동안 뒤로 젖혔다가, 남은 시간은 앞으로 푹 숙인다
    if (sneezeNow) currentPose = { ...(currentPose ?? {}), lean: sneezeT < 0.15 ? -0.55 : 0.6, jitter: sneezeT < 0.15 ? 1 : 0 }

    // 세로 화면은 좌우가 좁아 카메라를 더 뒤로 뺀다. 세로 전시관은 방 전체가 들어오도록 한 번 더 뺀다.
    const portrait = state.size.width < state.size.height
    const caveHere = portrait && useGame.getState().inCave
    const kind = indoorKind(useGame.getState())
    const pull = portrait ? (caveHere ? 1 : kind === 'museum' || kind === 'hall' ? 2 : 1.5) : 1
    // 집 방 안에서는 방 가로가 화면에 다 들어오도록 단계별 방 크기에 맞춰 더 뺀다(좁은 화면일수록 많이)
    // 다락에서는 카메라 목표를 방 가운데로 옮기므로(아래 atticShift) 방 가장자리까지 거리는 방 반폭만 본다
    const roomHalf = roomSizeAt(HOME_ROOM).w / 2
    const roomPull = s.inHome ? roomCamPull(state.size.width, state.size.height, (state.camera as THREE.PerspectiveCamera).fov, roomHalf, CAM_OFFSET.length()) : 1
    // 잠수 중엔 카메라가 물 밑으로 따라 내려가지 않게 수면 높이에서 본다
    camTarget.copy(caveHere ? CAVE_CAM_OFFSET : CAM_OFFSET).multiplyScalar(Math.max(pull, roomPull) * runtime.zoom).add({ x: p.x, y: p.y, z: p.z })
    followLook.set(p.x, p.y + 1.1, p.z - 1.2)
    // 백화점(3단계)은 키가 커서 문 앞에서는 시선을 조금 올려 지붕과 간판이 화면 위로 잘리지 않게 한다. 문에서 멀어지면 원래 구도로 돌아온다.
    if (!s.inHome && s.shop.tier >= 3) {
      const near = Math.min(1, Math.max(0, 1 - (Math.hypot(p.x - SHOP_DOOR.x, p.z - SHOP_DOOR.z) - 3) / 5))
      followLook.y += SHOP_LOOK_LIFT * near
    }
    // 다락·옆방·지하실에서는 플레이어가 문이나 계단 쪽에 있어 방이 한쪽으로 쏠린다. 카메라를 방 가운데 x 로 옮겨 방 전체가 가운데 오게 한다.
    const atticShift = s.inHome && s.homeFloor >= 1 ? roomCenter(HOME_ROOM).x - p.x : 0
    camTarget.x += atticShift
    followLook.x += atticShift

    // 대화 중엔 플레이어 어깨 너머로 주민 얼굴을 가깝게 담는 구도로 들어간다. 서로 마주 보게 돌리고,
    // 아래쪽 대화창에 얼굴이 가리지 않게 시선을 낮춰 둘이 화면 위쪽에 오게 한다.
    const partner = s.panel === 'talk' ? talkPartner(s.dialog?.villagerId) : null
    runtime.talkCam = partner ? Math.min(1, runtime.talkCam + dt * 2.2) : Math.max(0, runtime.talkCam - dt * 2.8)
    if (partner) {
      p.facing = lerpAngle(p.facing, Math.atan2(partner.x - p.x, partner.z - p.z), 1 - Math.exp(-10 * dt))
      // 너무 붙어서 말을 걸었으면 반걸음 물러서 둥근 머리끼리 겹치지 않게 한다.
      const gap = Math.hypot(partner.x - p.x, partner.z - p.z)
      const want = { x: p.x, z: p.z }
      if (gap < TALK_GAP && gap > 0.01) {
        want.x = partner.x - ((partner.x - p.x) / gap) * TALK_GAP
        want.z = partner.z - ((partner.z - p.z) / gap) * TALK_GAP
        if (canWalk(want.x, want.z)) {
          const k = Math.min(1, dt * 6)
          p.x += (want.x - p.x) * k
          p.z += (want.z - p.z) * k
        } else {
          want.x = p.x
          want.z = p.z
        }
      }
      const my = (p.y + heightAt(partner.x, partner.z)) / 2
      // 구도는 대화를 시작할 때 한 번 고른다(물러설 자리 기준). 매 프레임 고르면 카메라가 이리저리 튄다.
      const key = s.dialog?.villagerId ?? ''
      if (talkShot?.key !== key) talkShot = { key, ...pickTalkShot(want, partner, s.houses, key, pull, my) }
      const { x, z, h, lx, lz } = talkShot
      talkPos.set(x, my + h, z)
      talkLook.set(lx, my + 0.62, lz)
    } else if (runtime.talkCam === 0) talkShot = null
    const k = smooth(runtime.talkCam)
    if (k > 0) {
      camTarget.lerp(talkPos, k)
      followLook.lerp(talkLook, k)
    }
    // 잡은 것을 번쩍 들 때는 카메라가 주인공 얼굴 앞으로 다가간다. 움직이면 자막도 닫고 돌아온다.
    if (s.caption && p.moving) s.closeCaption()
    // 장터를 열면 가판대와 뒤의 상인이 함께 보이게 앞쪽에서 비춘다. 패널을 닫으면 제자리로 돌아온다.
    const atMarket = s.panel === 'market' && !!MARKET_SITE
    runtime.marketCam = atMarket ? Math.min(1, runtime.marketCam + dt * 2.2) : Math.max(0, runtime.marketCam - dt * 2.8)
    const mk = smooth(runtime.marketCam)
    if (mk > 0 && MARKET_SITE) {
      // 가판대의 몸 방향(0.4 라디안 돌림)에서 손님 쪽 앞으로 다섯 걸음, 높이 3.4
      const fx = Math.sin(0.4)
      const fz = Math.cos(0.4)
      marketPos.set(MARKET_SITE.x + fx * 5, heightAt(MARKET_SITE.x, MARKET_SITE.z) + 3.4, MARKET_SITE.z + fz * 5)
      marketLook.set(MARKET_SITE.x, heightAt(MARKET_SITE.x, MARKET_SITE.z) + 1.1, MARKET_SITE.z)
      camTarget.lerp(marketPos, mk)
      followLook.lerp(marketLook, mk)
    }
    // 여름 축제 밤에 의자에 앉으면 광장 쪽을 낮게 올려다보며 불꽃을 구경하게 한다
    const fest = festivalOn(s.day)
    const watching = !!runtime.seat && !!fest && fest.season === 'summer' && s.night && !!MARKET_SITE
    runtime.fireCam = watching ? Math.min(1, runtime.fireCam + dt * 1.4) : Math.max(0, runtime.fireCam - dt * 2.2)
    const fc = smooth(runtime.fireCam)
    if (fc > 0 && MARKET_SITE) {
      // 섬 바깥(가장자리 경사)이 화면에 들어오지 않도록 카메라를 광장 바깥쪽에 두고 섬 안쪽을 본다
      const gy = heightAt(MARKET_SITE.x, MARKET_SITE.z)
      const r = Math.hypot(MARKET_SITE.x, MARKET_SITE.z) || 1
      const ox = MARKET_SITE.x / r
      const oz = MARKET_SITE.z / r
      firePos.set(MARKET_SITE.x + ox * 9, gy + 1.5, MARKET_SITE.z + oz * 9)
      fireLook.set(MARKET_SITE.x - ox * 2, gy + 5.4, MARKET_SITE.z - oz * 2)
      camTarget.lerp(firePos, fc)
      followLook.lerp(fireLook, fc)
    }
    // 벤치에 앉으면 시선이 천천히 바다 쪽으로 밀려 나간다. 일어나면 제자리로 돌아온다.
    const onBench = runtime.seat?.id === 'viewpoint'
    benchCam = onBench ? Math.min(1, benchCam + dt * 0.35) : Math.max(0, benchCam - dt * 2.5)
    const bk = smooth(benchCam)
    if (bk > 0) {
      benchSea.set(VIEWPOINT.x + Math.sin(VIEWPOINT.rot) * 9, p.y + 1.2, VIEWPOINT.z + Math.cos(VIEWPOINT.rot) * 9)
      followLook.lerp(benchSea, bk)
    }
    // 유성우 밤에 바깥 자리에 앉았거나 소원을 빌 때는 등 뒤에서 하늘을 올려다보게 한다(별똥별이 화면에 들어온다)
    const hour = currentHour()
    const starNight = isMeteorNight(s.day, weatherFor(s.day)) && meteorHours(hour)
    const rainbow = rainbowDay(weatherFor(prevDay(s.day)), weatherFor(s.day)) && rainbowHour(hour)
    const skyWatch = ((!!runtime.seat || runtime.wishing) && !isIndoor(s) && (starNight || rainbow)) || runtime.telescope
    runtime.skyCam = skyWatch ? Math.min(1, runtime.skyCam + dt * 1.2) : Math.max(0, runtime.skyCam - dt * 2)
    const kc = smooth(runtime.skyCam)
    if (kc > 0) {
      const fx = Math.sin(p.facing)
      const fz = Math.cos(p.facing)
      // 캐릭터 머리가 화면 아래로 빠지도록 뒤·위에서 잡고, 살짝 올려다본다(지평선은 화면 아래쪽에 남는다)
      skyPos.set(p.x - fx * 5, p.y + 3.5, p.z - fz * 5)
      skyLook.set(p.x + fx * 17, p.y + 4.7, p.z + fz * 17)
      camTarget.lerp(skyPos, kc)
      followLook.lerp(skyLook, kc)
    }
    const showing = !!s.caption && !s.panel
    runtime.showCam = showing ? Math.min(1, runtime.showCam + dt * 2.4) : Math.max(0, runtime.showCam - dt * 3)
    if (showing && !showShot) showShot = pickShowShot(p, s.houses, state.camera.position)
    if (showing && showShot) p.facing = lerpAngle(p.facing, showShot.a, 1 - Math.exp(-10 * dt))
    if (!showing && runtime.showCam === 0) showShot = null
    const sk = smooth(runtime.showCam)
    if (sk > 0 && showShot) {
      // 머리 위로 든 물건까지 화면에 들어오게 시선을 머리 위쪽에 둔다.
      showPos.set(showShot.x, p.y + 1.7, showShot.z)
      showLook.set(p.x, p.y + 1.45, p.z)
      camTarget.lerp(showPos, sk)
      followLook.lerp(showLook, sk)
    }
    // 사진 모드: 플레이어 둘레를 공전하는 카메라(지면 위로 제한은 orbitCamera 가 맡는다)
    if (s.photo) {
      const head = { x: p.x, y: p.y + 1.1, z: p.z }
      const c = orbitCamera(head, runtime.photoOrbit, heightAt)
      camTarget.set(c.x, c.y, c.z)
      followLook.set(head.x, head.y, head.z)
    }
    // 절벽 뒤로 카메라가 땅 아래로 파고들면 땅 앞까지 당겨 온다.
    const head = { x: p.x, y: p.y + 1.2, z: p.z }
    playerHole.value.set(p.x, p.y, p.z, 2.3)
    bodyHole.value.set(p.x, p.y, p.z, 0.8)
    outlineHole.value.set(p.x, p.y, p.z, 1.3)
    // 수영 중엔 바닷가 오르막이 시선을 막아도 카메라를 끌어당기지 않는다. 끌어당기면 카메라가 물 밑으로 내려간다.
    const clear = runtime.swim ? 1 : sightClearance(head, camTarget)
    if (runtime.swim) camTarget.y = Math.max(camTarget.y, SURFACE_Y + 2.5)
    if (clear < 1) {
      const kc = Math.max(0.25, clear)
      camTarget.set(head.x + (camTarget.x - head.x) * kc, head.y + (camTarget.y - head.y) * kc, head.z + (camTarget.z - head.z) * kc)
    }
    // 타격 흔들림은 보간 전에 빼고 보간 뒤에 더한다. 그래야 흔들림이 카메라 위치에 쌓이지 않는다.
    state.camera.position.sub(kickOff)
    if (runtime.snapCamera) {
      state.camera.position.copy(camTarget)
      runtime.snapCamera = false
    } else state.camera.position.lerp(camTarget, 1 - Math.exp(-(5 + Math.max(k, sk) * 3) * dt))
    if (runtime.kick > 0) runtime.kick = Math.max(0, runtime.kick - dt)
    const kk = runtime.kick / KICK_TIME
    kickOff.set(0, -KICK_AMP * kk * kk, 0)
    state.camera.position.add(kickOff)
    state.camera.lookAt(followLook)
    // DEV 캡처 전용: window.__dotori.camFreeze 로 카메라를 고정한다(프로덕션에서는 실행되지 않는다)
    if (import.meta.env.DEV && devCamFreeze) {
      state.camera.position.set(...devCamFreeze.pos)
      state.camera.lookAt(...devCamFreeze.look)
    }
    cameraCut.value.set(state.camera.position.x, state.camera.position.y, state.camera.position.z, 3)

    s.setPrompt(s.panel ? null : findAction({ touch: touchDevice })?.label || null)
  })

  return (
    <>
      <group ref={root}>
        <Chibi look={look} motion={motion} handRef={hand} pose={pose}>
          {umbrella && <UmbrellaModel color={UMBRELLA_COLOR[umbrella]} open={rainyNow} />}
          {/* 도구를 바깥·앞쪽으로 기울여 들어야 큰 머리를 뚫고 나오지 않는다. 자랑하는 동안엔 내려놓는다. */}
          <group ref={toolWrap}>
            <ToolModel tool={tool} level={canLevel} gold={goldCan} rodRef={rodTip} />
            <group ref={grip} position={[0, 0.4, 0.05]}>
              <Part color={look.skin} outline={0.1}>
                <sphereGeometry args={[0.07, 10, 8]} />
              </Part>
            </group>
          </group>
        </Chibi>
        <SleepZ />
        <SneezeBubble />
      </group>
      {/* 오르내리는 동안만 절벽 면에 세워진다. 월드 좌표라 몸 밖에 둔다. */}
      <group ref={ladderRef} visible={false}>
        <LadderModel />
      </group>
    <WaterArea />
    </>
  )
}

/** 자는 주인공 머리 위로 떠오르는 zZ. 누워 있을 때만 보인다. */
function SleepZ() {
  const grp = useRef<THREE.Group>(null)
  const mat = useRef<THREE.SpriteMaterial>(null)
  const tex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 128
    const g = cv.getContext('2d')!
    g.font = 'bold 84px sans-serif'
    g.fillStyle = '#4a6fa5'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('zZ', 64, 66)
    return new THREE.CanvasTexture(cv)
  }, [])
  useFrame(({ clock }) => {
    const on = !!runtime.seat?.lie
    if (!grp.current || !mat.current) return
    grp.current.visible = on
    if (!on) return
    // 머리 쪽(뿌리에서 -z)에서 위로 천천히 떠올라 흐려진다
    const k = (clock.elapsedTime * 0.4) % 1
    grp.current.position.set(0, 0.7 + k * 0.9, -1.1)
    mat.current.opacity = Math.sin(k * Math.PI) * 0.9
  })
  return (
    <group ref={grp}>
      <sprite scale={[0.5, 0.5, 1]}>
        <spriteMaterial ref={mat} map={tex} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

/** 절벽에 기대 세운 사다리. 원점이 바닥이고 높이 1 이 한 칸이라, 그룹 세로 배율로 길이를 맞춘다. */
function LadderModel() {
  const rungs = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94]
  return (
    <group>
      <mesh position={[-0.2, 0.5, 0]}>
        <boxGeometry args={[0.06, 1, 0.06]} />
        <Toon color="#c9a26b" />
      </mesh>
      <mesh position={[0.2, 0.5, 0]}>
        <boxGeometry args={[0.06, 1, 0.06]} />
        <Toon color="#c9a26b" />
      </mesh>
      {rungs.map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.4, 0.025, 0.05]} />
          <Toon color="#e0b77e" />
        </mesh>
      ))}
    </group>
  )
}

const WATER_TILES = 9

/** 물뿌리개가 덮는 칸을 바닥에 잠깐 비춘다. 물 주기 동작이 끝나면 흐려져 사라진다. 월드 좌표로 그린다. */
function WaterArea() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#8fdcf5', transparent: true, opacity: 0, depthWrite: false }), [])
  useFrame(() => {
    const fx = runtime.waterFx
    const k = fx ? Math.max(0, 1 - (now() - fx.t0) / WATER_FX_TIME) : 0
    mat.opacity = k * 0.5
    refs.current.forEach((m, i) => {
      const c = fx?.cells[i]
      if (!m) return
      m.visible = !!c && k > 0
      if (c) m.position.set(c.x, heightAt(c.x, c.z) + 0.04, c.z)
    })
  })
  return (
    <>
      {Array.from({ length: WATER_TILES }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m }} rotation-x={-Math.PI / 2} material={mat} visible={false}>
          <planeGeometry args={[0.86, 0.86]} />
        </mesh>
      ))}
    </>
  )
}

/** 찌와 낚싯줄. 낚시 단계가 바뀔 때 몸짓을 새로 고르고, 프레임마다 찌 위치와 줄 곡선을 갱신한다. */
let wasNibble = false
let leftFoot = false
/** 마지막으로 웅덩이에서 첨벙한 시각 */
let lastSplash = 0
let lastSwimRipple = 0
let diveSplashT0 = -1
let waterShadowOff = false
let sneezeOn = false

let sneezeTex: THREE.CanvasTexture | null = null
/** '에취!' 말풍선 텍스처. 한 번만 만든다. */
function sneezeBubbleTexture(): THREE.CanvasTexture {
  if (sneezeTex) return sneezeTex
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = '#fffaf0'
  g.strokeStyle = '#3b2a20'
  g.lineWidth = 6
  g.beginPath()
  g.ellipse(96, 40, 84, 32, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(84, 66)
  g.lineTo(96, 90)
  g.lineTo(108, 66)
  g.fill()
  g.stroke()
  g.fillStyle = '#3b2a20'
  g.font = '800 34px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('에취!', 96, 40)
  sneezeTex = new THREE.CanvasTexture(c)
  sneezeTex.colorSpace = THREE.SRGBColorSpace
  return sneezeTex
}

/** 재채기하는 동안 머리 위에 뜨는 '에취!' 말풍선. 재채기가 끝나면(0.8초) 사라진다. */
function SneezeBubble() {
  const ref = useRef<THREE.Sprite>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = sneezeAt(now()) >= 0
  })
  return (
    <sprite ref={ref} visible={false} scale={[0.9, 0.45, 1]} position={[0, 2.1, 0]}>
      <spriteMaterial map={sneezeBubbleTexture()} depthWrite={false} />
    </sprite>
  )
}
/** 수영 중 몸이 잠기는 높이(배꼽 근처). 머리와 팔이 수면 위에 보인다. */
const SWIM_Y = SURFACE_Y - 0.3
const DIVE_Y = SURFACE_Y - 1.6
/** 잠수 시작 뒤 이 초까지는 가라앉아 있다가, 나머지 시간에 솟는다 */
const DIVE_RISE = 2.4
/** 잠수 중 몸 높이. 가라앉았다가 DIVE_RISE 뒤 솟아오른다. */
function swimY(dive: { t0: number } | null): number {
  if (!dive) return SWIM_Y
  const d = now() - dive.t0
  if (d < 0.45) return SWIM_Y + (DIVE_Y - SWIM_Y) * (d / 0.45)
  if (d < DIVE_RISE) return DIVE_Y
  const u = Math.min(1, (d - DIVE_RISE) / (DIVE_SECONDS - DIVE_RISE))
  return DIVE_Y + (SWIM_Y - DIVE_Y) * u + Math.sin(u * Math.PI) * 0.3
}

/** 줄은 이만큼 나눠 곡선으로 그린다. 꼭짓점 배열은 한 번 만들고 매 프레임 덮어쓴다. */
const LINE_N = 12
const linePts = new Float32Array((LINE_N + 1) * 3)
/** 던진 찌가 날아가는 시간 범위(초). 거리에 따라 그 사이에서 고른다. */
const FLY_MIN = 0.4
const FLY_MAX = 0.6
/** 취소로 찌가 되돌아오는 시간, 놓쳐서 튕겨 오는 시간, 입질로 물속에 꽂히는 시간(초) */
const RETRACT_TIME = 0.25
const SPRING_TIME = 0.45
const YANK_TIME = 0.08

/** 찌 연출 상태. React 상태로 두면 프레임마다 리렌더가 일어나므로 모듈 객체에 두고 useFrame 에서만 쓴다. */
const bob = {
  seen: 'idle',
  /** 현재 단계 안의 시간 */
  t: 0,
  /** 던진 뒤 흐른 시간(와인드업 포함). 단계가 바뀌어도 끊기지 않게 따로 센다. */
  ft: 0,
  last: 0,
  flying: false,
  swung: false,
  /** 취소로 되돌아오는 중인지 */
  retract: false,
  flyDur: FLY_MIN,
  apex: 1.5,
  /** 떨어질 자리와 수면 높이 */
  tx: 0,
  tz: 0,
  w: 0,
  /** 이번 프레임 찌 위치. 취소할 때 되돌아가는 출발점이 된다. */
  x: 0,
  y: 0,
  z: 0,
  /** 취소할 때 되돌아가기 시작한 자리 */
  x0: 0,
  y0: 0,
  z0: 0,
  /** 줄 여유 0(팽팽) ~ 1(늘어짐). 부드럽게 옮긴다. */
  slack: 0,
}

/** 수면이 그려지는 높이. 바다는 물결 꼭대기(0.12)에 맞춰야 찌가 가라앉아 보이지 않는다(FishShadows 와 같은 규칙). */
const surfaceY = (w: number) => (w === 0 ? 0.12 : w + 0.03)

/** 찌 파문·물보라: 떨어진 순간 한 번 */
function splashDown(x: number, z: number, w: number) {
  ripple(x, z, 1)
  rippleAt(x, z, 1.5)
  burst({ kind: 'splash', x, y: surfaceY(w), z })
  burst({ kind: 'spray', x, y: surfaceY(w) + 0.05, z })
  play('plop')
}

/** 잡은 물고기가 물에서 튀어 올라 손으로 날아간다. 끝나면 자랑 연출(Effects)이 이어받는다. */
function CaughtFish() {
  const ref = useRef<THREE.Group>(null)
  const [id, setId] = useState('')
  const from = useRef({ x: 0, z: 0, w: 0, t0: -1 })
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const f = runtime.fishing
    const t = clock.elapsedTime
    const c = from.current
    if (f.phase === 'idle') c.t0 = -1
    // 같은 낚기 동안 한 번만 시작한다(reel 은 0.9초 동안 이어진다).
    if (f.phase === 'reel' && f.result === 'caught' && c.t0 < 0) {
      c.t0 = t
      c.x = f.x
      c.z = f.z
      c.w = waterLevelAt(f.x, f.z) ?? 0
      setId(f.fishId)
    }
    const k = c.t0 < 0 ? 1 : (t - c.t0) / CATCH_FLY
    g.visible = k < 1
    if (k >= 1) return
    const p = runtime.player
    // 손은 몸 앞쪽, 가슴 높이
    const hx = p.x + Math.sin(p.facing) * 0.55
    const hz = p.z + Math.cos(p.facing) * 0.55
    const hy = p.y + 1.2
    const sy = surfaceY(c.w) - 0.05
    g.position.set(c.x + (hx - c.x) * k, sy + (hy - sy) * k + 4 * 1.4 * k * (1 - k), c.z + (hz - c.z) * k)
    // 몸을 퍼덕이며 튀어 오르고, 손에 닿을 즈음 제 크기가 된다.
    g.scale.setScalar(0.6 + 0.6 * Math.min(1, k * 4))
    g.rotation.set(0, p.facing, Math.sin(k * Math.PI * 3) * 0.5)
  })
  return <group ref={ref} visible={false}>{id && <ItemModel id={id} />}</group>
}

export function Bobber() {
  const ref = useRef<THREE.Mesh>(null)
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(linePts, 3))
    const obj = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }))
    // 꼭짓점을 매 프레임 옮기므로 처음 계산한 경계 상자로 잘리지 않게 한다.
    obj.frustumCulled = false
    return obj
  }, [])

  useFrame(({ clock }) => {
    const f = runtime.fishing
    const t = clock.elapsedTime
    const dt = Math.min(0.05, Math.max(0, t - bob.last))
    bob.last = t
    const p = runtime.player
    // 낚싯대 끝: 손 앞쪽 위
    const tipX = p.x + Math.sin(p.facing) * 1.1
    const tipZ = p.z + Math.cos(p.facing) * 1.1
    const tipY = p.y + 1.9
    const phase = f.phase
    bob.t += dt
    bob.ft += bob.flying ? dt : 0

    // 단계가 바뀌면 몸짓을 새로 시작한다.
    if (phase !== bob.seen) {
      const was = bob.seen
      bob.seen = phase
      bob.t = 0
      if (f.phase === 'cast') {
        // 던진 거리에 따라 시간과 꼭대기 높이를 정한다(가까우면 짧고 낮게).
        const dist = Math.hypot(f.x - tipX, f.z - tipZ)
        const k = Math.min(1, dist / 5)
        bob.flyDur = FLY_MIN + (FLY_MAX - FLY_MIN) * k
        bob.apex = 1.5 + k
        bob.tx = f.x
        bob.tz = f.z
        bob.w = waterLevelAt(f.x, f.z) ?? 0
        bob.ft = 0
        bob.flying = true
        bob.swung = false
        bob.retract = false
      } else if (f.phase === 'idle' && (was === 'cast' || was === 'wait' || was === 'bite')) {
        // 취소: 찌를 거둔 자리에서 낚싯대 끝으로 짧게 되돌아온다.
        bob.retract = true
        bob.flying = false
        bob.x0 = bob.x
        bob.y0 = bob.y
        bob.z0 = bob.z
      } else if (f.phase === 'reel') {
        // 물고기가 놀라거나 낚인 순간 날아가던 찌는 멈춘다(착수 전이면 착수 파문은 없다).
        bob.flying = false
      }
    }

    let x: number
    let y: number
    let z: number
    let slackT = 1
    // 낚아 올린 찌가 낚싯대 끝에 닿으면 거둔다. 자랑 클로즈업 화면 앞을 가리지 않게.
    let reeledIn = false
    const w = bob.w
    if (bob.flying) {
      // 와인드업 동안은 찌가 낚싯대 끝에 매달려 있고, 휘두르는 중간에 놓인다.
      if (!bob.swung && bob.ft >= CAST_RELEASE) {
        bob.swung = true
        play('cast')
      }
      const k = Math.min(1, Math.max(0, (bob.ft - CAST_RELEASE) / bob.flyDur))
      x = tipX + (bob.tx - tipX) * k
      z = tipZ + (bob.tz - tipZ) * k
      y = tipY + (surfaceY(w) + 0.1 - tipY) * k + bob.apex * 4 * k * (1 - k)
      if (k >= 1) {
        bob.flying = false
        splashDown(bob.tx, bob.tz, w)
      }
    } else if (bob.retract) {
      const k = Math.min(1, bob.t / RETRACT_TIME)
      if (k >= 1) bob.retract = false
      const e = 1 - (1 - k) * (1 - k)
      x = bob.x0 + (tipX - bob.x0) * e
      z = bob.z0 + (tipZ - bob.z0) * e
      y = bob.y0 + (tipY - bob.y0) * e + Math.sin(Math.PI * e) * 0.4
    } else if (f.phase === 'wait') {
      // 물결에 맞춰 천천히 오르내리고, 조금씩 떠밀린다.
      const nibble = !!f.lure && f.t > f.lure.approach && Math.sin((f.t - f.lure.approach) * 7) > 0.6
      x = bob.tx + Math.sin(t * 0.9) * 0.03
      z = bob.tz + Math.cos(t * 0.7) * 0.03
      y = surfaceY(w) + 0.22 + Math.sin(t * 2.2) * 0.035 - (nibble ? 0.06 : 0)
      // 톡 건드릴 때마다 찌 둘레로 작은 파문
      if (nibble && !wasNibble) ripple(bob.tx, bob.tz, 0.55)
      wasNibble = nibble
    } else if (f.phase === 'bite') {
      // 입질: 찌가 물속으로 확 끌려 들어가며 잔진동이 남는다. 줄은 팽팽해진다.
      const k = Math.min(1, bob.t / YANK_TIME)
      const e = 1 - (1 - k) * (1 - k)
      x = bob.tx
      z = bob.tz
      y = surfaceY(w) + 0.1 - 0.22 * e + Math.sin(t * 34) * 0.02 * e
      slackT = 0
    } else if (f.phase === 'reel' && f.result === 'caught') {
      // 낚아 올리는 중: 줄을 감으며 낚싯대 끝으로 끌려온다.
      const k = Math.min(1, bob.t / (REEL_TIME * 0.6))
      const e = k * k * (3 - 2 * k)
      reeledIn = k >= 1
      x = bob.tx + (tipX - bob.tx) * e
      z = bob.tz + (tipZ - bob.tz) * e
      y = surfaceY(w) + 0.1 + (tipY - surfaceY(w) - 0.1) * e
      slackT = 0
    } else if (f.phase === 'reel') {
      // 놓쳤다: 줄이 늘어지고 찌가 낚싯대 쪽으로 짧게 튕겨 온다.
      const k = Math.min(1, bob.t / SPRING_TIME)
      const e = 1 - (1 - k) * (1 - k)
      x = bob.tx + (tipX - bob.tx) * e
      z = bob.tz + (tipZ - bob.tz) * e
      y = surfaceY(w) + 0.1 + (tipY - surfaceY(w) - 0.1) * e + Math.sin(Math.PI * e) * 0.8
    } else {
      x = bob.x
      y = bob.y
      z = bob.z
    }
    bob.x = x
    bob.y = y
    bob.z = z
    bob.slack += (slackT - bob.slack) * (1 - Math.exp(-dt * 12))

    const visible = (phase !== 'idle' || bob.retract) && !reeledIn
    line.visible = visible
    if (!visible) {
      wasNibble = false
      if (ref.current) ref.current.visible = false
      return
    }
    if (!ref.current) return
    ref.current.visible = true
    ref.current.position.set(x, y, z)
    ref.current.rotation.set(bob.flying ? bob.ft * 9 : 0, t * 0.8, 0)

    // 줄: 낚싯대 끝에서 찌까지 한 쪽으로 처진 곡선. 늘어지면 처지고, 팽팽하면 곧게 편다.
    const ax = tipX
    const ay = tipY
    const az = tipZ
    const bx = x
    const by = y + 0.1
    const bz = z
    const sag = bob.slack * 0.2 * Math.hypot(bx - ax, by - ay, bz - az)
    for (let i = 0; i <= LINE_N; i++) {
      const u = i / LINE_N
      const arch = 4 * u * (1 - u)
      // 기다리는 동안엔 바람에 살짝 흔들린다
      const sway = Math.sin(t * 1.7 + u * 4) * 0.025 * bob.slack * arch
      const j = i * 3
      linePts[j] = ax + (bx - ax) * u + sway
      linePts[j + 1] = ay + (by - ay) * u - sag * arch
      linePts[j + 2] = az + (bz - az) * u + sway * 0.6
    }
    ;(line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <>
      <primitive object={line} />
      <mesh ref={ref} visible={false}>
        <icosahedronGeometry args={[0.2, 1]} />
        <Toon color="#ff5a4e" />
        {/* 수면에 닿는 얇은 흰 테: 찌가 어디 떠 있는지 멀리서도 보이게 */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
          <ringGeometry args={[0.2, 0.235, 28]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </mesh>
      <CaughtFish />
    </>
  )
}
