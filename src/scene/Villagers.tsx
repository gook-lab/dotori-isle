import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { groundAt, heightAt } from '../core/island'
import { countOf } from '../core/inventory'
import { isBirthday } from '../core/birthdays'
import { crowdHour, crowdSpeakers, CROWD_LINES, festivalOn } from '../core/festivals'
import { currentHour } from '../core/clock'
import { hashString } from '../core/rng'
import { weatherFor } from '../core/weather'
import { scarfOn, umbrellaOn } from '../core/weatherFx'
import { dailyRequest, HOUSE_R, isHomeAt, moodOf, type Mood, type Villager } from '../core/villagers'
import { villagerRoomSpot, type RoomSpot } from '../core/villagerRoom'
import { BED_TOP } from '../core/furnitureActions'
import { sheltersNow, shelterFacing, shelterSpot, snowmanBuilder } from '../core/weatherLife'
import { wornOutfit } from '../core/villagerWear'
import { costumeShown, pumpkinOutfitColor } from '../core/pumpkin'
import { WEAR_BY_ID } from '../core/wardrobe'
import { presentVillagers, shopGuestsNow, villagerAt } from '../game/actions'
import { balanceLines } from '../core/bubble'
import { activeReq } from '../core/requests'
import { burst, now, REACT_TIME, runtime } from '../game/runtime'
import { babble, voiceOf } from '../game/sfx'
import { useGame } from '../game/store'
import { Chibi, type Look, type Motion, type Pose } from './Chibi'
import { Part, Toon } from './toon'

const LOOKS: Record<string, Look> = {
  mocha: { skin: '#e8b07a', outfit: '#f6d36b', ears: 'cat', earInner: '#ffc2b0' },
  bomi: { skin: '#f7f2ea', outfit: '#ff9fb5', ears: 'rabbit' },
  pengdol: { skin: '#3a4250', outfit: '#3a4250', mask: '#ffffff', beak: '#f5a623', belly: '#ffffff' },
  guriguri: { skin: '#8a7f8f', outfit: '#ffcf70', ears: 'round', snout: '#ff9db0' },
  dongri: { skin: '#f2d7b6', outfit: '#9bd59a', ears: 'round', spikes: '#8a5a3b', snout: '#3b2a20' },
  // 솜뭉치 곰: 크림 얼굴에 연민트 몸, 정수리 솜털과 끝이 처진 곰 귀, 목에 작은 잎 스카프
  somi: { skin: '#fff4df', outfit: '#b5e8d5', legs: '#b5e8d5', ears: 'droop', earInner: '#b5e8d5', tuft: '#ffffff', collar: { band: '#7fc8a9', charm: '#4fa577', shape: 'leaf' }, size: 0.78 },
  // 소다수 고양이: 청록 몸에 머리·등 태비 줄무늬, 입 주변만 둥근 흰 주둥이, 목에 방울 목걸이
  soda: { skin: '#3fb3a8', outfit: '#3fb3a8', ears: 'cat', earInner: '#ffc9d3', stripes: '#2a7f78', bands: '#2a7f78', muzzle: '#fffaf3', collar: { band: '#d64545', charm: '#f2c14e', shape: 'bell' }, size: 0.84 },
  // 유자 토끼: 진한 귤노랑 몸, 아래로 늘어진 롭이어, 정수리 새싹. 눈썹 선·볼 빗금·혀 없음
  yuja: { skin: '#f2b93b', outfit: '#f2b93b', ears: 'lop', sprout: '#6fae3f', mouth: 'plain', puff: '#ffd966', size: 0.84 },
  // 보리 다람쥐: 황갈 몸에 등줄 세 개, 통통한 볼, 복슬 꼬리
  bori: { skin: '#c99a5b', outfit: '#c99a5b', legs: '#8a5a33', ears: 'round', bands: '#4a2e18', cheeks: true, tail: '#a8733c', eyeScale: 1.3, size: 0.76 },
  // 밤송이 요정: 초록 가시 후드, 몸은 군밤 갈색 위 · 크림 아래
  maro: { skin: '#f3d9a4', outfit: '#8a5a3b', hem: '#f3d9a4', burr: '#6f9a3c', legs: '#6b4528', size: 0.8 },
  // 강수달: 청회색 몸에 연한 하늘빛 배, 조개 목걸이
  coco: { skin: '#7f8f9c', outfit: '#7f8f9c', ears: 'bear', snout: '#3b3f47', belly: '#bfe3f2', collar: { band: '#f3e7d3', charm: '#f7c9b3', shape: 'shell' }, size: 0.95 },
  // 여행 섬 손님들
  sora: { skin: '#5b7fa6', outfit: '#ffd166', mask: '#ffffff', beak: '#f5a623', belly: '#ffffff' },
  toto: { skin: '#c9c3bd', outfit: '#9bd5f0', ears: 'rabbit' },
  kongi: { skin: '#f2dcc0', outfit: '#ffb3c1', ears: 'round', spikes: '#7a5236', snout: '#3b2a20', size: 0.9 },
  mimi: { skin: '#fff4f0', outfit: '#ff9fb5', ears: 'cat', earInner: '#ffc2d0' },
  gomdol: { skin: '#a0714f', outfit: '#7fc8a9', ears: 'bear', mask: '#e8cfae', snout: '#3b2a20', size: 1.05 },
  darami: { skin: '#e0a46b', outfit: '#f7e08a', ears: 'round', mask: '#fff3dc', belly: '#fff3dc', tail: '#c98a52', size: 0.85 },
  bamtol: { skin: '#f0d29a', outfit: '#6b8e4e', shell: '#6e4325', size: 0.85 },
  chumbung: { skin: '#7d6450', outfit: '#ffcf70', ears: 'bear', mask: '#d8c4ab', snout: '#3b2a20', belly: '#d8c4ab' },
}

const talkingTo = () => useGame.getState().dialog?.villagerId

/** 버릇을 부리는 동안의 표정 */
const QUIRK_MOOD: Record<string, Mood> = { blow: 'calm', sing: 'happy', drink: 'happy', demand: 'happy', pebble: 'calm', dash: 'calm' }

/** 주민이 플레이어를 보고 멈추는 거리. 플레이어 충돌 반경보다 조금 커서 서로 겹치지 않는다. */
const PAUSE_R = 1.5
/** 집 안 시간대 자리의 자세. 책장 앞에서는 앉아 책을 읽고, 침대에서는 눕고, 창가에서는 서 있는다. */
// 침대 자리는 옆으로 누워 머리를 침대 머리맡 쪽에 둔다(플레이어 눕기의 lie 와는 따로 쓴다)
const ROOM_POSE: Record<RoomSpot, Pose | null> = { reading: { sit: 1, lean: 0.1 }, bed: { lieSide: Math.PI / 2 }, window: null }

const emojiTextures = new Map<string, THREE.CanvasTexture>()

/** 이모지를 그린 말풍선 텍스처. 같은 이모지는 한 번만 만든다. */
function bubbleTexture(emoji: string): THREE.CanvasTexture {
  const hit = emojiTextures.get(emoji)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#fffaf0'
  g.strokeStyle = '#3b2a20'
  g.lineWidth = 6
  g.beginPath()
  g.arc(64, 56, 46, 0, Math.PI * 2)
  g.moveTo(52, 98)
  g.lineTo(64, 122)
  g.lineTo(76, 98)
  g.fill()
  g.stroke()
  g.font = '56px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(emoji, 64, 60)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  emojiTextures.set(emoji, tex)
  return tex
}

function Bubble({ emoji, seed, q, lying = false }: { emoji: string; seed: number; q?: Quirk; lying?: boolean }) {
  const ref = useRef<THREE.Sprite>(null)
  const map = useMemo(() => bubbleTexture(emoji), [emoji])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = (lying ? LYING_TAIL_Y - 0.1 : 2.05) + Math.sin(clock.elapsedTime * 3 + seed) * 0.06
    ref.current.position.x = lying ? LYING_SHIFT : 0
    // 버릇 말풍선이 떠 있는 동안엔 비켜 준다. 둘이 위아래로 붙어 겹쳐 보인다.
    // 버릇 말풍선이 떠 있는 동안엔 비켜 준다. 불꽃 구경 카메라에서도 말풍선은 숨긴다.
    ref.current.visible = !(q && quirkAt(q, clock.elapsedTime, seed).line) && runtime.fireCam < 0.5 && !useGame.getState().title
  })
  return (
    <sprite ref={ref} scale={0.6} position={[lying ? LYING_SHIFT : 0, lying ? LYING_TAIL_Y - 0.1 : 2.05, 0]}>
      <spriteMaterial map={map} depthWrite={false} />
    </sprite>
  )
}

const textTextures = new Map<string, THREE.CanvasTexture>()

const LINE_FONT = 'bold 44px "Pretendard", "Apple SD Gothic Neo", sans-serif'
const LINE_H = 58
/** 말풍선 픽셀당 월드 크기(외침 말풍선과 같은 배율) */
const BUBBLE_PX = 1.3 / 256
/** 화면 가장자리에서 말풍선을 떼어 둘 여백(px) */
const EDGE_PX = 16
/** 말풍선 꼬리 끝이 닿는 높이 기본값(머리 위). 말풍선이 여러 줄이면 위로 자란다. */
const TAIL_Y = 1.72
/** 침대에 옆으로 누운 주민의 말풍선 꼬리 높이와 가로 밀기. 머리가 몸통에서 옆으로 나가 있어 머리 위쪽으로 맞춘다. */
const LYING_TAIL_Y = 0.95
const LYING_SHIFT = -1.1
const lineTextures = new Map<string, THREE.CanvasTexture>()
const bubbleBase = new THREE.Vector3()
const bubbleAnchor = new THREE.Vector3()
const bubbleRight = new THREE.Vector3()
const bubbleProbe = new THREE.Vector3()

/**
 * 짧은 말을 담은 말풍선. 외침 말풍선과 같은 모양이고 움직이지 않는다.
 * 길면 낱말 사이에서 여러 줄로 나뉘고(balanceLines), 꼬리 끝은 y 높이에 둔다. 귀 달린 몸은 y 를 높여 귀 위로 올린다.
 * 화면 가장자리에 걸리면 카메라 가로 방향으로 안쪽으로 밀어 넣는다.
 */
export function LineBubble({ text, y = TAIL_Y, shift = 0 }: { text: string; y?: number; shift?: number }) {
  const tex = useMemo(() => lineTexture(text, shift), [text, shift])
  const { w, h } = tex.userData as { w: number; h: number }
  const ref = useRef<THREE.Sprite>(null)
  const halfH = (h * BUBBLE_PX) / 2
  const halfW = (w * BUBBLE_PX) / 2
  useFrame(({ camera, size }) => {
    const s = ref.current
    const parent = s?.parent
    if (!s || !parent) return
    // 불꽃 구경 카메라가 올려다볼 때는 가까운 말풍선이 화면을 가리니 숨긴다
    s.visible = runtime.fireCam < 0.5 && !useGame.getState().title
    bubbleBase.set(shift, y + halfH, 0)
    s.position.copy(bubbleBase)
    // 가장자리 보정: 말풍선 가로 반폭이 화면 안에 들도록 월드에서 카메라 오른쪽 방향으로 민다
    bubbleAnchor.copy(bubbleBase)
    parent.localToWorld(bubbleAnchor)
    bubbleRight.setFromMatrixColumn(camera.matrixWorld, 0)
    const cx = bubbleProbe.copy(bubbleAnchor).project(camera).x
    const ex = bubbleProbe.copy(bubbleAnchor).addScaledVector(bubbleRight, halfW).project(camera).x
    const perWorld = (ex - cx) / halfW
    if (!(perWorld > 0)) return
    const margin = (EDGE_PX * 2) / size.width
    const halfNdc = ex - cx
    let nudge = 0
    if (cx + halfNdc > 1 - margin) nudge = (cx + halfNdc - (1 - margin)) / perWorld
    else if (cx - halfNdc < -1 + margin) nudge = (cx - halfNdc - (-1 + margin)) / perWorld
    if (nudge !== 0) {
      bubbleProbe.copy(bubbleAnchor).addScaledVector(bubbleRight, -nudge)
      s.position.copy(parent.worldToLocal(bubbleProbe))
    }
  })
  return (
    <sprite ref={ref} scale={[w * BUBBLE_PX, h * BUBBLE_PX, 1]} position={[shift, y + halfH, 0]}>
      <spriteMaterial map={tex} depthWrite={false} />
    </sprite>
  )
}

/** 여러 줄 말풍선 텍스처. 너비와 높이는 userData 에 둔다. shift 만큼 옆으로 밀린 말풍선이면 꼬리는 머리 쪽을 가리킨다. */
function lineTexture(text: string, shift: number): THREE.CanvasTexture {
  const key = `${shift}|${text}`
  const hit = lineTextures.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  const g = c.getContext('2d')!
  g.font = LINE_FONT
  const lines = balanceLines(text, (s) => g.measureText(s).width)
  const widest = Math.max(...lines.map((l) => g.measureText(l).width))
  const w = Math.max(256, Math.ceil(widest) + 80)
  const bodyH = lines.length * LINE_H + 26
  const h = bodyH + 46
  c.width = w
  c.height = h
  // 캔버스 크기를 바꾸면 글꼴 설정이 풀리니 다시 정한다
  g.font = LINE_FONT
  g.fillStyle = '#fffaf0'
  g.strokeStyle = '#3b2a20'
  g.lineWidth = 7
  g.beginPath()
  g.roundRect(10, 10, w - 20, bodyH, 36)
  // 꼬리는 머리 쪽(말풍선 가운데에서 shift 만큼 안쪽)을 가리킨다
  const tailX = Math.min(w - 48, Math.max(48, w / 2 - shift / BUBBLE_PX))
  g.moveTo(tailX - 16, 10 + bodyH - 4)
  g.lineTo(tailX, h - 12)
  g.lineTo(tailX + 16, 10 + bodyH - 4)
  g.fill()
  g.stroke()
  g.fillStyle = '#3b2a20'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach((l, i) => g.fillText(l, w / 2, 10 + 13 + LINE_H / 2 + i * LINE_H))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.userData = { w, h }
  lineTextures.set(key, tex)
  return tex
}

const SHOUT_FONT = 'bold 50px "Pretendard", "Apple SD Gothic Neo", sans-serif'

/** 외침 말풍선: 둥근 사각형 안에 굵은 글씨. 글자 길이에 맞춰 가로로 늘어난다. 긴 말도 잘리지 않는다. 텍스처 너비는 userData.w 에 둔다. */
function shoutTexture(text: string): THREE.CanvasTexture {
  const hit = textTextures.get(text)
  if (hit) return hit
  const c = document.createElement('canvas')
  const g0 = c.getContext('2d')!
  g0.font = SHOUT_FONT
  const w = Math.max(256, Math.ceil(g0.measureText(text).width) + 90)
  c.width = w
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#fffaf0'
  g.strokeStyle = '#3b2a20'
  g.lineWidth = 7
  g.beginPath()
  g.roundRect(10, 10, w - 20, 86, 40)
  g.moveTo(w / 2 - 16, 96)
  g.lineTo(w / 2, 122)
  g.lineTo(w / 2 + 16, 96)
  g.fill()
  g.stroke()
  g.fillStyle = '#3b2a20'
  g.font = SHOUT_FONT
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, 55)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.userData.w = w
  textTextures.set(text, tex)
  return tex
}

/** 주민마다의 버릇. every 초마다 dur 초 동안 하고, 그동안과 끝난 뒤 잠깐 말풍선을 띄운다. */
type QuirkKind = 'dash' | 'blow' | 'sing' | 'demand' | 'drink' | 'pebble'
interface Quirk {
  kind: QuirkKind
  every: number
  dur: number
  lines: string[]
}

const QUIRKS: Record<string, Quirk> = {
  // 걷지 않고 통통 뛰다가 갑자기 높이 뛰어 한 바퀴 돌며 외친다.
  yuja: { kind: 'dash', every: 6.5, dur: 0.9, lines: ['얍!', '와햐!', '헤에?!', '뿌우우…', '얍얍!'] },
  // 멈춰서 민들레 꽃대를 들어 올리고 후 불어 씨앗을 날려 보낸다.
  somi: { kind: 'blow', every: 9, dur: 2.2, lines: ['후우~', '날아라…', '헤헤…', '소원 빌었어'] },
  // 몸을 좌우로 흔들며 두 팔을 흔들고 노래한다.
  soda: { kind: 'sing', every: 10, dur: 3, lines: ['♪ 랄라~', '바람 좋다~♪', '♪~♬'] },
  // 도토리를 집어 볼에 넣고 볼이 빵빵해지도록 부풀린다.
  bori: { kind: 'demand', every: 8, dur: 1.6, lines: ['도토리 하나 더!', '볼 빵빵~', '내 거야!'] },
  // 김 나는 머그를 들어 꿀꺽 마시고 후아 한다.
  maro: { kind: 'drink', every: 11, dur: 2.4, lines: ['후아~', '따끈해~', '…한 잔만 더.'] },
  // 조약돌을 위로 톡 던졌다 받는 공기놀이
  coco: { kind: 'pebble', every: 9.5, dur: 1.4, lines: ['톡.', '하나, 둘…', '잡았다!'] },
}

function quirkAt(q: Quirk, t: number, seed: number): { active: boolean; f: number; line: string | null } {
  const cycle = (t + seed) / q.every
  const k = (cycle % 1) * q.every
  const line = q.lines[Math.floor(cycle) % q.lines.length]
  if (k < q.dur) return { active: true, f: k / q.dur, line }
  return { active: false, f: 0, line: k < q.dur + 0.9 ? line : null }
}

/** 버릇 말풍선. 같은 시계로 계산해서 몸짓과 맞는다. */
function Shout({ q, seed, talking, lift }: { q: Quirk; seed: number; talking: () => boolean; lift: () => number }) {
  const ref = useRef<THREE.Sprite>(null)
  const mat = useRef<THREE.SpriteMaterial>(null)
  const last = useRef<string | null>(null)
  useFrame(({ clock }) => {
    const text = talking() ? null : quirkAt(q, clock.elapsedTime, seed).line
    if (!ref.current || !mat.current) return
    ref.current.visible = !!text && runtime.fireCam < 0.5
    if (text && text !== last.current) {
      const tex = shoutTexture(text)
      mat.current.map = tex
      mat.current.needsUpdate = true
      ref.current.scale.set((1.3 * tex.userData.w) / 256, 0.65, 1)
    }
    last.current = text
    ref.current.position.y = 2.65 + lift()
  })
  return (
    <sprite ref={ref} scale={[1.3, 0.65, 1]} visible={false}>
      <spriteMaterial ref={mat} depthWrite={false} />
    </sprite>
  )
}

/** 마로의 머그: 코코아를 담은 하얀 머그. 마실 때(show > 0) 김이 올라간다. */
function Mug({ show }: { show: () => number }) {
  const steam = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = steam.current
    if (!g) return
    g.visible = show() > 0
    g.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.9 + i * 0.37) % 1
      c.position.set(Math.sin(clock.elapsedTime * 3 + i) * 0.02, 0.1 + k * 0.3, 0)
      c.scale.setScalar(0.6 + k * 0.6)
    })
  })
  return (
    <group position={[0, -0.02, 0.06]}>
      <Part color="#f7f1e3" outline={0.1}>
        <cylinderGeometry args={[0.075, 0.065, 0.15, 12]} />
      </Part>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.068, 0.068, 0.012, 12]} />
        <Toon color="#7a4a26" />
      </mesh>
      <mesh position={[0.085, 0, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.035, 0.012, 5, 10]} />
        <Toon color="#f7f1e3" />
      </mesh>
      <group ref={steam} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 코코의 조약돌: 손에 쥐고 있다가 show 만큼 위로 던졌다 받는다. */
function Pebble({ show }: { show: () => number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.position.y = 0.03 + show()
  })
  return (
    <group ref={ref} position={[0, 0.03, 0.04]}>
      <Part color="#9aa6b2" outline={0.12}>
        <sphereGeometry args={[0.045, 10, 8]} />
      </Part>
    </group>
  )
}

/** 씨앗이 날아가는 방향 네 줄기(솜털 뭉치 기준) */
const SEED_DIRS: [number, number, number][] = [[-0.8, 0.9, 0.4], [0.1, 1, 0.6], [0.9, 0.7, 0.3], [-0.3, 1, -0.2]]

/**
 * 솜이의 민들레: 꽃대 끝 솜털 뭉치. show 가 0 이면 감추고, 1 보다 크면 그만큼 씨앗이 날아간다(1~2).
 * 꽃대는 팔이 든 자세에서 세워지도록 2 라디안 돌려 둔다.
 */
function Dandelion({ show }: { show: () => number }) {
  const group = useRef<THREE.Group>(null)
  const seeds = useRef<THREE.Group>(null)
  useFrame(() => {
    const on = show()
    if (group.current) group.current.visible = on > 0
    const p = Math.max(0, on - 1)
    seeds.current?.children.forEach((c, i) => {
      const d = SEED_DIRS[i]
      c.visible = p > i * 0.12
      c.position.set(d[0] * p * 0.5, 0.44 + d[1] * p * 0.5, d[2] * p * 0.4)
    })
  })
  return (
    <group ref={group} rotation-x={2} visible={false}>
      <Part color="#8fcf7a" position={[0, 0.2, 0]} outline={0.08}>
        <cylinderGeometry args={[0.014, 0.014, 0.42, 6]} />
      </Part>
      <Part color="#ffffff" position={[0, 0.44, 0]} outline={0.1}>
        <sphereGeometry args={[0.1, 12, 10]} />
      </Part>
      <group ref={seeds}>
        {SEED_DIRS.map((_, i) => (
          <mesh key={i} position={[0, 0.44, 0]}>
            <sphereGeometry args={[0.025, 6, 5]} />
            <Toon color="#ffffff" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 보리의 도토리: 집어 들고 볼에 넣는 동안(show > 0)만 보인다. */
function Acorn({ show }: { show: () => number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = show() > 0
  })
  return (
    <group ref={ref} position={[0, 0.02, 0.05]} visible={false}>
      <Part color="#c98a4b" outline={0.1}>
        <sphereGeometry args={[0.05, 10, 8]} />
      </Part>
      <Part color="#6b4528" position={[0, 0.045, 0]} outline={0.08}>
        <cylinderGeometry args={[0.055, 0.045, 0.03, 10]} />
      </Part>
    </group>
  )
}

const ease = (k: number) => 1 - (1 - k) * (1 - k)

/** 생일인 주민 머리 위의 고깔모자. 몸 크기 그룹 안에 놓아 주민마다 같이 커진다. */
/** 비 오는 날 주민이 머리 위로 펴는 우산. 살과 대 색이 주민마다 다르다. */
const UMBRELLA_COLORS = ['#e0402a', '#1f6fd0', '#f2a900']
const RIB_COUNT = 8
const CANOPY_R = 0.55

/**
 * 둥근 돔 천, 살 여덟 개, 손잡이가 달린 우산. 축을 뒤로 살짝 기울여 얼굴이 보이게 한다.
 * 돔 꼭대기(apex)는 축의 위쪽 끝, 살은 꼭대기에서 가장자리까지 뻗는다.
 */
function Umbrella({ seed }: { seed: number }) {
  const color = UMBRELLA_COLORS[seed % UMBRELLA_COLORS.length]
  const ribs = useMemo(() => {
    const apex = new THREE.Vector3(0, CANOPY_R, 0)
    return Array.from({ length: RIB_COUNT }, (_, i) => {
      const a = (i / RIB_COUNT) * Math.PI * 2
      const rim = new THREE.Vector3(Math.cos(a) * CANOPY_R, 0, Math.sin(a) * CANOPY_R)
      const dir = rim.clone().sub(apex)
      const len = dir.length()
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
      const mid = apex.clone().add(rim).multiplyScalar(0.5)
      return { mid, quat, len }
    })
  }, [])
  return (
    <group position={[0, 1.9, 0]} rotation-x={-0.3}>
      <mesh>
        <sphereGeometry args={[CANOPY_R, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {/* 비 오는 날의 어두운 조명에서도 색이 읽히도록 제 색을 조금 스스로 밝힌다 */}
        <Toon color={color} emissive={`#${new THREE.Color(color).multiplyScalar(0.15).getHexString()}`} />
      </mesh>
      {ribs.map((r, i) => (
        <mesh key={i} position={r.mid} quaternion={r.quat}>
          <cylinderGeometry args={[0.012, 0.012, r.len, 4]} />
          <Toon color="#3b2a20" />
        </mesh>
      ))}
      {/* 축과 J 자 손잡이 */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.4, 6]} />
        <Toon color="#7a5230" />
      </mesh>
      <mesh position={[0, -0.85, 0.07]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.07, 0.02, 6, 12, Math.PI * 1.5]} />
        <Toon color="#7a5230" />
      </mesh>
    </group>
  )
}

/** 눈 오는 날 주민이 두르는 목도리. 목 둘레와 늘어진 끝자락. */
function Scarf() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.3, 0.07, 8, 16]} />
        <Toon color="#e4572e" />
      </mesh>
      <mesh position={[0.2, 0.7, 0.16]} rotation-z={-0.2}>
        <boxGeometry args={[0.1, 0.36, 0.06]} />
        <Toon color="#e4572e" />
      </mesh>
    </group>
  )
}

function PartyHat() {
  return (
    <group position={[0, 1.5, 0]} rotation-z={0.2}>
      <mesh position={[0, 0.16, 0]}>
        <coneGeometry args={[0.17, 0.4, 10]} />
        <Toon color="#ff8fa3" />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <Toon color="#ffd166" />
      </mesh>
    </group>
  )
}

/** 집들이 방문객처럼 다른 자리에 그릴 때 쓰는 주민 외형 */
export function lookOf(id: string): Look {
  return LOOKS[id]
}

function VillagerBody({ v, emoji, line, birthday }: { v: Villager; emoji: string | null; line: string | null; birthday: boolean }) {
  const root = useRef<THREE.Group>(null)
  const jumper = useRef<THREE.Group>(null)
  const q = QUIRKS[v.id]
  const state = useRef<Motion>({ moving: true, pace: q?.kind === 'dash' ? 1.3 : 0.6, talking: false })
  const pose = useRef<Pose | null>(null)
  const lift = useRef(0)
  // 버릇 소품이 읽는 값: 민들레 씨앗(1~2), 머그 김, 조약돌 높이, 도토리 표시
  const fx = useRef(0)
  // 지나가는 플레이어에게 손 흔든 시각. 너무 자주 인사하지 않게 기억해 둔다.
  const greetAt = useRef(-99)
  const shelterAt = useRef({ x: 0, z: 0, ready: false })
  // 선물받은 옷을 다음 날부터 입고 나온다. 옷 색으로 몸통 색만 바꾸고, 나머지 생김새는 그대로 둔다.
  // 망토와 가면은 저녁 17시부터만 입는다(호박 등불 밤). 그 밖의 시간에는 평소 옷이다.
  const worn = useGame((s) => {
    const id = wornOutfit(s.villagerWear[v.id], s.day)
    return id && costumeShown(id, s.pumpkinNightOn) ? id : null
  })
  // 선물 옷은 옷 목록 색을, 호박 등불 밤 옷과 장난 옷은 행사 색을 쓴다
  const look = useMemo(() => (worn ? { ...LOOKS[v.id], outfit: WEAR_BY_ID[worn]?.color ?? pumpkinOutfitColor(worn) ?? LOOKS[v.id].outfit } : LOOKS[v.id]), [v.id, worn])
  const size = look.size ?? 1
  // 집 안에서 침대에 누워 있는 시간인지(말풍선 높이를 머리 위로 낮춘다)
  const lying = isHomeAt(v, currentHour(), useGame.getState().houses) && villagerRoomSpot(currentHour()) === 'bed'

  useFrame(({ clock, camera }, delta) => {
    // 상점 손님으로 나와 있는 동안에는 섬 바깥에 같은 주민이 없다
    const shopping = shopGuestsNow().includes(v.id)
    if (root.current) root.current.visible = !shopping
    if (shopping) {
      delete runtime.party[v.id]
      return
    }
    const t = clock.elapsedTime
    const talking = talkingTo() === v.id
    const quirk = q && !talking ? quirkAt(q, t, v.seed) : null
    // 유자 말고는 버릇을 부리는 동안 걸음을 멈춘다.
    const busy = !!quirk?.active && q.kind !== 'dash'
    const p = runtime.player
    const houses = useGame.getState().houses
    const here = villagerAt(v, houses)
    // 플레이어가 바로 앞에 있으면 걸음을 멈추고 돌아본다. 몸이 겹치지 않게 하는 장치이기도 하다.
    const near = Math.hypot(p.x - here.x, p.z - here.z) < PAUSE_R
    // 가까이 지나가면 손을 흔들고 이름을 웅얼거린다. 한 번 인사하면 한동안은 안 한다.
    const dist = Math.hypot(p.x - here.x, p.z - here.z)
    if (!talking && !quirk?.active && dist < 3.2 && t - greetAt.current > 30 && !useGame.getState().panel) {
      greetAt.current = t
      const voice = voiceOf(v.id)
      ;[...v.name].forEach((ch, i) => window.setTimeout(() => babble(voice, ch, i === v.name.length - 1, 0.6), 120 + i * 110))
    }
    const greeting = !talking && t - greetAt.current < 1.4
    const waiting = talking || near || greeting
    if (!waiting && !busy) runtime.vclock[v.id] = (runtime.vclock[v.id] ?? 0) + Math.min(delta, 0.05)
    // 비 오는 날엔 가끔 처마 밑(집 앞)으로 뛰어가 비를 피한다. 그 자리까지 부드럽게 옮겨 간다.
    const hide = sheltersNow(v.id, weatherFor(useGame.getState().day) === 'rain', Date.now())
    const base = villagerAt(v, houses)
    const goal = hide ? shelterSpot(v.home, HOUSE_R) : base
    const sa = shelterAt.current
    if (!sa.ready) {
      sa.x = base.x
      sa.z = base.z
      sa.ready = true
    }
    // 생일 축하 색종이는 주민 머리 위에서 터진다(대화 중에도 위치가 멈춰 있어 정확하다)
    if (runtime.party[v.id]) {
      delete runtime.party[v.id]
      burst({ kind: 'party', x: sa.x, y: heightAt(sa.x, sa.z) + 1.7, z: sa.z })
    }
    const gap = Math.hypot(goal.x - sa.x, goal.z - sa.z)
    if (gap > 4) {
      sa.x = goal.x
      sa.z = goal.z
    } else if (gap > 1e-3) {
      const step = Math.min(gap, (hide ? 2.6 : 1.2) * Math.min(delta, 0.05))
      sa.x += ((goal.x - sa.x) / gap) * step
      sa.z += ((goal.z - sa.z) / gap) * step
    }
    // 처마 밑에 든 주민은 집을 등지고 바깥을 본다
    const pos = { x: sa.x, z: sa.z, facing: hide ? shelterFacing(v.home, goal) : base.facing }
    const sheltered = hide && gap < 0.15
    state.current.pace = hide ? 1.6 : q?.kind === 'dash' ? 1.3 : 0.6
    state.current.moving = !waiting && !busy && !sheltered
    state.current.talking = talking
    // 불꽃이 터진 직후에는 광장의 주민이 팔짝이며 환호한다
    state.current.hype = t - runtime.boomAt < 1.1 && !!festivalOn(useGame.getState().day) ? 1 : 0
    if (!root.current) return
    // 침대에 누워 있으면 침대 윗면 높이에 몸을 올린다
    const onBedTop = here.home && villagerRoomSpot(currentHour()) === 'bed' ? BED_TOP : 0
    root.current.position.set(pos.x, heightAt(pos.x, pos.z) + onBedTop, pos.z)
    // 대화 중에는 플레이어 쪽으로 돌아보되, 표정이 보이게 카메라 쪽으로 반쯤 몸을 튼다.
    const toPlayer = Math.atan2(p.x - pos.x, p.z - pos.z)
    const toCam = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z)
    const want = talking ? toPlayer + Math.atan2(Math.sin(toCam - toPlayer), Math.cos(toCam - toPlayer)) * 0.55 : waiting ? toPlayer : pos.facing
    const cur = root.current.rotation.y
    root.current.rotation.y = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * Math.min(1, delta * 8)

    const j = jumper.current
    if (!j) return
    let y = 0
    let spin = 0
    let rollZ = 0
    let shakeX = 0
    let hype = 0
    let ps: Pose | null = null
    fx.current = 0
    const f = quirk?.f ?? 0
    const on = !!quirk?.active
    switch (q?.kind) {
      case 'dash':
        // 걸을 때도 깡충깡충, 대화 중엔 제자리에서 들썩인다.
        y = waiting ? Math.abs(Math.sin(t * 7)) * (talking ? 0.08 : 0.03) : Math.abs(Math.sin(t * 9)) * 0.14
        if (on) {
          y += Math.sin(f * Math.PI) * 0.85
          spin = f * Math.PI * 2
          hype = 1
        }
        if (talking) hype = 0.6
        break
      case 'sing':
        if (on) {
          rollZ = Math.sin(t * 4) * 0.14
          y = Math.abs(Math.sin(t * 4)) * 0.05
          ps = { armL: -2.3 + Math.sin(t * 8) * 0.3, armR: -2.3 - Math.sin(t * 8) * 0.3 }
        }
        break
      case 'demand':
        if (on) {
          // 도토리를 집어(0~0.3) 볼에 넣고(0.4 까지 표시), 볼을 빵빵하게 불렸다가(0.25~0.8) 가라앉힌다
          const lift3 = f < 0.3 ? ease(f / 0.3) : f < 0.8 ? 1 : 1 - ease((f - 0.8) / 0.2)
          const puff = ease(Math.min(1, Math.max(0, (f - 0.25) / 0.3))) * (f < 0.8 ? 1 : 1 - ease((f - 0.8) / 0.2))
          ps = { armR: -1.9 * lift3, armL: -0.4 * lift3, cheek: puff }
          fx.current = f < 0.4 ? 1 : 0
        }
        break
      case 'drink':
        if (on) {
          // 들어 올리고 → 꿀꺽꿀꺽 → 내리며 후아. 김은 드는 동안 올라간다.
          const lift2 = f < 0.25 ? ease(f / 0.25) : f < 0.7 ? 1 : 1 - ease((f - 0.7) / 0.3)
          ps = { armR: -2.1 * lift2, lean: -0.18 * lift2, hop: f > 0.72 && f < 0.85 ? 0.06 : 0 }
          fx.current = 1
        }
        break
      case 'blow':
        if (on) {
          // 민들레를 들어 올리고(0~0.3) 0.4 뒤부터 씨앗이 날아가도록 후 분다(fx 1~2)
          const lift4 = f < 0.3 ? ease(f / 0.3) : f < 0.92 ? 1 : 1 - ease((f - 0.92) / 0.08)
          ps = { armR: -2.0 * lift4, armRz: 0.6 * lift4, armL: -0.3 * lift4, lean: 0.05 * lift4 }
          fx.current = 1 + Math.min(1, Math.max(0, (f - 0.4) / 0.5))
        }
        break
      case 'pebble':
        if (on) {
          // 손의 조약돌을 위로 톡 던졌다(0.1~0.6) 받는다. 던지는 동안만 손을 살짝 든다.
          const s2 = Math.min(1, Math.max(0, (f - 0.1) / 0.5))
          fx.current = 0.5 * Math.sin(Math.PI * s2)
          if (f > 0.1 && f < 0.6) ps = { armR: -0.35, armL: -0.4 }
        }
        break
    }
    if (greeting && !ps) {
      // 한 손을 들어 좌우로 흔든다.
      ps = { armR: -2.6 + Math.sin(t * 14) * 0.35 }
      y += Math.abs(Math.sin(t * 8)) * 0.04
    }
    // 환호할 때는 팔짝팔짝 뛴다
    if (state.current.hype) y += Math.abs(Math.sin(t * 9 + v.seed)) * 0.22
    j.position.set(shakeX, y, 0)
    j.rotation.set(0, spin, rollZ)
    state.current.hype = hype
    // 표정: 대화 중엔 지금 대사에서, 아니면 버릇에서 고른다. 말풍선이 뜨는 동안 입을 움직인다.
    const d = talking ? useGame.getState().dialog : null
    const react = runtime.react?.id === v.id ? runtime.react : null
    if (d) {
      state.current.mood = moodOf(d.lines[d.index] ?? '')
      // 대화창이 글자를 찍는 동안만 입을 움직인다.
      state.current.speaking = runtime.typing
    } else if (react && now() - react.t0 < REACT_TIME) {
      // 집 방에서 이 주민 물건을 쓰면 잠깐 놀라거나 웃는다.
      state.current.mood = react.mood
      state.current.speaking = false
    } else if (greeting) {
      state.current.mood = 'happy'
      state.current.speaking = t - greetAt.current < 0.8
    } else {
      state.current.mood = on ? QUIRK_MOOD[q!.kind] : 'calm'
      state.current.speaking = !!quirk?.line && (on || q!.kind === 'dash')
    }
    // 집 안에 있으면 시간대 자리의 자세를 준다. 인사로 손을 흔드는 중이면 그 자세를 우선한다.
    if (here.home && !ps) ps = ROOM_POSE[villagerRoomSpot(currentHour())]
    pose.current = ps
    lift.current = y
  })

  const prop = q?.kind === 'drink' ? <Mug show={() => fx.current} /> : q?.kind === 'blow' ? <Dandelion show={() => fx.current} /> : q?.kind === 'pebble' ? <Pebble show={() => fx.current} /> : q?.kind === 'demand' ? <Acorn show={() => fx.current} /> : null
  // 비 오는 날은 우산, 눈 오는 날은 목도리를 한다(날씨는 날짜로 정해진다)
  const day = useGame((st) => st.day)
  const weather = weatherFor(day)
  return (
    <group ref={root}>
      <group ref={jumper}>
        <group scale={size}>
          <Chibi look={look} motion={() => state.current} pose={() => pose.current} seed={v.seed}>
            {prop}
          </Chibi>
          {birthday && <PartyHat />}
          {scarfOn(weather) && <Scarf />}
          {umbrellaOn(weather) && <Umbrella seed={v.seed} />}
        </group>
      </group>
      {q && <Shout q={q} seed={v.seed} talking={() => talkingTo() !== undefined} lift={() => lift.current} />}
      {emoji && <Bubble emoji={emoji} seed={v.seed} q={q} lying={lying} />}
      {!emoji && line && <LineBubble text={line} y={lying ? LYING_TAIL_Y : TAIL_Y} shift={lying ? LYING_SHIFT : 0} />}
    </group>
  )
}

export function Villagers() {
  const houses = useGame((s) => s.houses)
  const tripGuests = useGame((s) => s.tripGuests)
  const talked = useGame((s) => s.talked)
  const fulfilled = useGame((s) => s.fulfilled)
  const requests = useGame((s) => s.requests)
  const inventory = useGame((s) => s.inventory)
  const day = useGame((s) => s.day)
  const dialogWith = useGame((s) => s.dialog?.villagerId)
  // 같이 낚시하는 주민은 Companion 이 따로 그리니 여기선 빼 둔다
  const companionId = useGame((s) => s.companion?.villagerId)
  // ❗ 부탁한 물건을 갖고 있을 때, 💬 오늘 아직 인사 안 했을 때
  // 축제 날 저녁 광장에서는 말하는 주민을 세 명으로 줄이고, 나머지의 '인사 안 함' 말풍선은 띄우지 않는다.
  const guests = presentVillagers(houses, tripGuests)
  // 눈 오는 날 하루 한 번 눈사람을 만드는 주민은 SnowmanBuilder 가 따로 그린다
  const snowBuilder = weatherFor(day) === 'snow' ? snowmanBuilder(day, guests.map((g) => g.id), (x, z) => groundAt(x, z) === 'grass')?.villagerId : null
  const crowd = !!festivalOn(day) && crowdHour(currentHour())
  const speakers = crowd && !dialogWith ? new Set(crowdSpeakers(guests.map((v) => v.id))) : null
  const emojiFor = (v: Villager) => {
    // 대화 중엔 누구 머리 위에도 띄우지 않아 대화 장면이 깔끔하다.
    if (dialogWith) return null
    // 생일이면 모자와 함께 케이크 말풍선을 띄운다.
    if (isBirthday(v.id, day)) return '🎂'
    if (!fulfilled.includes(v.id) && countOf(inventory, dailyRequest(v.id, day)) > 0) return '❗'
    // 말 전하기·잃은 조개·물주기 부탁이 아직 남아 있으면 느낌표를 띄운다
    const req = activeReq(requests[v.id], day)
    if (req && !req.done) return '❗'
    if (crowd) return null
    if (!talked.includes(v.id)) return '💬'
    return null
  }
  const lineFor = (v: Villager) => {
    if (!speakers || !speakers.has(v.id) || emojiFor(v)) return null
    return CROWD_LINES[hashString(v.id) % CROWD_LINES.length]
  }
  return (
    <>
      {guests.filter((v) => v.id !== companionId && v.id !== snowBuilder).map((v) => (
        <VillagerBody key={v.id} v={v} emoji={emojiFor(v)} line={lineFor(v)} birthday={isBirthday(v.id, day)} />
      ))}
    </>
  )
}
