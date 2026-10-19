import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ROOM_D, ROOM_FLOOR, ROOM_W, roomCenter, SHOP_OBJECTS, SHOP_ROOM, SHOP_STEP, shopShelvesNow } from '../core/interior'
import { SHOP_NAME } from '../core/shopRoom'
import { upgradeState, type StockEntry } from '../core/shopTiers'
import { DISPLAY_SPOTS, displayStock, isSoldOut, LIMITED_SPOT, limitedShelf } from '../core/shopDisplay'
import { shopGuestsNow } from '../game/actions'
import { now } from '../game/runtime'
import { useGame } from '../game/store'
import { shopGuestSpot } from '../core/shopGuest'
import { Atm } from './Atm'
import { Chibi, type Motion, type Pose } from './Chibi'
import { RaccoonClerk } from './RaccoonClerk'
import { FurnitureModel } from './Furniture'
import { LineBubble, lookOf } from './Villagers'
import { Toon } from './toon'

const WALL_H = 2.8
const INDOOR_FLOOR = '#2b1f17'

/** 가끔 한 손을 드는 주기(초)와 손 드는 시간(초). 점원마다 주기를 달리해 같이 움직이지 않게 한다. */
const WAVE_EVERY = 9
const WAVE_FOR = 1.4
/** 선반 소품 크기 배율. 멀리서도 가게처럼 읽히게 키운다. */
const GOODS_SCALE = 1.7
/** 선반 소품 색. 한 칸 안에서도 색을 섞는다. */
const PALETTE = ['#f2c14e', '#7fb7c9', '#8fb5a8', '#e2412f', '#fdf6e3', '#c9785e', '#9b6bb5', '#6fae5a']

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 가게 간판: 크림 바탕에 상호 이름 */
function signTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 64, (g) => {
    g.fillStyle = '#fdf6e3'
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = '#6b4528'
    g.font = 'bold 34px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(SHOP_NAME, 128, 34)
  })
}

/** 오늘의 특가 현수막 (백화점 단계) */
function bannerTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 96, (g) => {
    g.fillStyle = '#b8402e'
    g.fillRect(0, 0, 256, 96)
    g.fillStyle = '#fdf6e3'
    g.fillRect(10, 10, 236, 76)
    g.fillStyle = '#b8402e'
    g.font = 'bold 40px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('오늘의 특가', 128, 50)
  })
}

/** 가격표: 크림 종이에 도토리 값. 멀리서도 읽히게 글씨를 키운다. */
function priceTexture(price: number, sold: boolean): THREE.CanvasTexture {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = '#fdf6e3'
    g.fillRect(0, 0, 256, 128)
    g.strokeStyle = '#6b4528'
    g.lineWidth = 8
    g.strokeRect(6, 6, 244, 116)
    g.fillStyle = '#6b4528'
    g.font = 'bold 60px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(sold ? '품절' : `🌰 ${price.toLocaleString()}`, 128, 66)
  })
}

/** 나무 바닥: 널빤지 결. 줄은 옅게 둬서 바닥 전체가 한 덩어리로 보이게 한다. */
function floorTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#d8bb8e' : '#d0b085'
      g.fillRect(0, i * 32, 128, 32)
      g.fillStyle = 'rgba(90,60,30,0.12)'
      g.fillRect(0, i * 32, 128, 1)
    }
  })
}

/** 러그: 가장자리 띠와 가운데 마름모 무늬 */
function rugTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 128, (g) => {
    g.fillStyle = '#8c4a3a'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#e8c27a'
    g.fillRect(8, 8, 240, 112)
    g.fillStyle = '#8c4a3a'
    g.fillRect(18, 18, 220, 92)
    g.fillStyle = '#c9785e'
    for (let i = 0; i < 5; i++) {
      g.beginPath()
      g.moveTo(40 + i * 40, 64)
      g.lineTo(60 + i * 40, 46)
      g.lineTo(80 + i * 40, 64)
      g.lineTo(60 + i * 40, 82)
      g.closePath()
      g.fill()
    }
  })
}

/** 점원 뒤 한 칸 높은 단: 계산대 뒤 바닥보다 조금 높다 */
function Step() {
  const { x, z, w, d, h } = SHOP_STEP
  return (
    <mesh position={[x, ROOM_FLOOR + h / 2, z]}>
      <boxGeometry args={[w, h, d]} />
      <Toon color="#b58a5c" />
    </mesh>
  )
}

/** 점원 한 마리: 공유 너구리 몸(RaccoonClerk)에 말풍선을 얹는다. 가끔 한 손을 들고, 말할 때는 말풍선을 띄운다. */
function Clerk({ id, x, z, seed }: { id: string; x: number; z: number; seed: number }) {
  const say = useGame((s) => (s.clerkSay?.id === id ? s.clerkSay.text : null))
  const motion = useMemo<() => Motion>(() => () => ({ moving: false, pace: 1, talking: useGame.getState().clerkSay?.id === id, speaking: useGame.getState().clerkSay?.id === id }), [id])
  const pose = useMemo<() => Pose | null>(
    () => () => {
      const phase = (now() + seed * 2.7) % WAVE_EVERY
      if (phase > WAVE_EVERY - WAVE_FOR) return { armR: -2.2, armRz: 0.5 + Math.sin(phase * 14) * 0.35 }
      return null
    },
    [seed],
  )
  return (
    <group position={[x, ROOM_FLOOR + SHOP_STEP.h, z]}>
      <RaccoonClerk id={id} seed={seed} motion={motion} pose={pose} />
      {say && <LineBubble text={say} />}
    </group>
  )
}

/** 상점 손님 한 명. 진열대 앞 띠를 천천히 오가고, 가끔 고개를 숙여 진열을 본다. 말을 걸면 말풍선을 띄운다. */
function ShopGuest({ id, index }: { id: string; index: number }) {
  const root = useRef<THREE.Group>(null)
  // 몸만 걸음 방향으로 돈다. 말풍선은 돌지 않는 뿌리에 있어야 글자가 옆으로 눕지 않는다.
  const body = useRef<THREE.Group>(null)
  // 말풍선을 손님 몸에서 가장자리 쪽으로 밀어 뒤쪽 점원 얼굴을 피한다. 말이 시작될 때 쓰는 값이다.
  const shift = useRef(0)
  const pose = useRef<Pose | null>(null)
  const say = useGame((s) => (s.shopGuestSay?.id === id ? s.shopGuestSay.text : null))
  const look = useMemo(() => lookOf(id), [id])
  const motion = useMemo<() => Motion>(
    () => () => ({ moving: true, pace: 0.6, talking: useGame.getState().shopGuestSay?.id === id, speaking: useGame.getState().shopGuestSay?.id === id }),
    [id],
  )
  useFrame(() => {
    if (!root.current) return
    const g = shopGuestSpot(index, now())
    root.current.position.set(g.x, ROOM_FLOOR, g.z)
    if (body.current) body.current.rotation.y = g.facing
    shift.current = (g.x < 0 ? -1 : 1) * 1.0
    pose.current = g.bowing ? { lean: 0.4 } : null
  })
  return (
    <group ref={root}>
      <group ref={body}>
        <Chibi look={look} motion={motion} pose={() => pose.current} seed={index + 7} />
      </group>
      {/* 토끼 귀 위로 말풍선 꼬리를 올린다 */}
      {say && <LineBubble text={say} y={2.4} shift={shift.current} />}
    </group>
  )
}

/** 오늘 상점에 와 있는 손님들. 누가 오는지는 게임 로직(shopGuestsNow)이 정하고, 여기서는 그리기만 한다. */
function ShopGuests() {
  const [ids, setIds] = useState<string[]>([])
  const shown = useRef('')
  useFrame(() => {
    const next = shopGuestsNow()
    if (next.join() !== shown.current) {
      shown.current = next.join()
      setIds(next)
    }
  })
  return (
    <>
      {ids.map((id, i) => (
        <ShopGuest key={id} id={id} index={i} />
      ))}
    </>
  )
}

/** 선반 소품 하나. 바닥(선반 판) 위에 놓이는 작은 물건 세 가지 모양 중 하나다. 원점은 놓이는 면의 가운데다. */
function Goods({ kind, color }: { kind: number; color: string }) {
  if (kind === 0) {
    return (
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.09, 0.1, 0.18, 10]} />
        <Toon color={color} />
      </mesh>
    )
  }
  if (kind === 1) {
    return (
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.2, 0.16, 0.14]} />
        <Toon color={color} />
      </mesh>
    )
  }
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.1, 0.07, 0.1, 10]} />
        <Toon color="#c07f45" />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <Toon color={color} />
      </mesh>
    </group>
  )
}

/**
 * 진열대 한 칸. 앞이 트인 선반이다: 뒤판과 양옆 기둥, 칸막이 선반 몇 단. 소품은 칸마다 세 개씩 놓고 크게 키운다.
 * low 는 카메라 쪽에 서는 낮은 진열대(한 단)라서 계산대 쪽 시야를 가리지 않는다.
 */
function Shelf({ x, z, face, seed, low }: { x: number; z: number; face: number; seed: number; low: boolean }) {
  const h = low ? 1.0 : 1.8
  const planks = low ? [0, 0.5] : [0, 0.5, 1.3]
  const rows = low ? [0.5] : [0.5, 1.3]
  return (
    <group position={[x, ROOM_FLOOR, z]} rotation={[0, face, 0]}>
      {/* 뒤판과 양옆 기둥 */}
      <mesh position={[0, h / 2, -0.28]}>
        <boxGeometry args={[0.9, h, 0.04]} />
        <Toon color="#b8875a" />
      </mesh>
      {[-0.44, 0.44].map((sx) => (
        <mesh key={sx} position={[sx, h / 2, 0]}>
          <boxGeometry args={[0.05, h, 0.6]} />
          <Toon color="#9a6b43" />
        </mesh>
      ))}
      {/* 선반 판: 칸막이와 맨 윗판 */}
      {[...planks, h - 0.03].map((y) => (
        <mesh key={y} position={[0, y + 0.02, 0]}>
          <boxGeometry args={[0.9, 0.05, 0.6]} />
          <Toon color="#c89a68" />
        </mesh>
      ))}
      {rows.map((y, row) =>
        [-0.28, 0, 0.28].map((dx, i) => {
          const k = seed + row * 3 + i
          return (
            <group key={`${row}-${i}`} position={[dx * GOODS_SCALE * 0.7, y + 0.05, 0.08]} scale={GOODS_SCALE}>
              <Goods kind={k % 3} color={PALETTE[k % PALETTE.length]} />
            </group>
          )
        }),
      )}
    </group>
  )
}

/** 계산대 위 금전등록기와 종 */
function Counter() {
  const c = SHOP_OBJECTS.counter
  return (
    <>
      {c.map((o, i) => (
        <mesh key={i} position={[o.x, ROOM_FLOOR + 0.35, o.z]}>
          <boxGeometry args={[1.2, 0.7, 0.9]} />
          <Toon color="#9a6b43" />
        </mesh>
      ))}
      <mesh position={[0, ROOM_FLOOR + 0.74, -1.2]}>
        <boxGeometry args={[3.6, 0.08, 1.0]} />
        <Toon color="#c89a68" />
      </mesh>
      {/* 금전등록기: 몸통과 화면 */}
      <group position={[0.9, ROOM_FLOOR + 0.78, -1.2]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.4]} />
          <Toon color="#3b4a55" />
        </mesh>
        <mesh position={[0, 0.36, -0.08]} rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[0.36, 0.16, 0.03]} />
          <Toon color="#9ad0ec" emissive="#2a5a70" />
        </mesh>
      </group>
      {/* 계산대 가운데의 종 */}
      <mesh position={[-0.8, ROOM_FLOOR + 0.84, -1.2]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <Toon color="#f2c14e" />
      </mesh>
    </>
  )
}

/** 계산대 앞 바닥에 세우는 가구 전시: 실제 크기 모델과 작은 가격표 */
function FloorDisplay({ id, price, x, z, tag = [0.85, 0.1] }: { id: string; price: number; x: number; z: number; tag?: readonly [number, number] }) {
  // 산 물건은 받침대에서 내리고 가격표를 품절로 바꾼다
  const sold = useGame((s) => isSoldOut(s.shopLog, s.day, id))
  const tex = useMemo(() => priceTexture(price, sold), [price, sold])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={[x, ROOM_FLOOR, z]}>
      {/* 낮은 원판 받침대 위에 가구를 1.3배로 올린다 */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.7, 0.75, 0.12, 20]} />
        <Toon color="#e8d6b0" />
      </mesh>
      {!sold && (
        <group position={[0, 0.12, 0]} scale={1.3}>
          <FurnitureModel itemId={id} night={false} />
        </group>
      )}
      {/* 가격표: 받침대 옆 작은 기둥 위의 종이. 왼쪽 자리는 선반과 장식장이 가까워 앞쪽에 세운다(tag) */}
      <mesh position={[tag[0], 0.35, tag[1]]}>
        <boxGeometry args={[0.05, 0.7, 0.05]} />
        <Toon color="#8a6a4a" />
      </mesh>
      <mesh position={[tag[0], 0.75, tag[1]]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

/** 주간 한정 가격표: 살 수 있으면 가격, 이번 주에 샀으면 "다음 주에 만나요" */
function limitedTexture(price: number, bought: boolean): THREE.CanvasTexture {
  // 390 폭에서 읽히도록 글씨를 키운다(판은 512×256, 그 비율로 그린다)
  return canvasTexture(512, 256, (g) => {
    g.fillStyle = '#fdf6e3'
    g.fillRect(0, 0, 512, 256)
    g.strokeStyle = '#6b4528'
    g.lineWidth = 14
    g.strokeRect(12, 12, 488, 232)
    g.fillStyle = '#6b4528'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (bought) {
      g.font = 'bold 76px sans-serif'
      g.fillText('다음 주에', 256, 92)
      g.fillText('만나요', 256, 178)
    } else {
      g.font = 'bold 60px sans-serif'
      g.fillText('주간 한정', 256, 72)
      g.font = 'bold 100px sans-serif'
      g.fillText(`🌰 ${price.toLocaleString()}`, 256, 176)
    }
  })
}

/** 주간 한정 받침대: 금박·반짝이가 입혀진 가구 한 점. 이번 주에 샀으면 빈 받침대에 "다음 주에 만나요"를 쓴다. */
function LimitedPedestal({ entry, bought, x, z }: { entry: StockEntry; bought: boolean; x: number; z: number }) {
  const tex = useMemo(() => limitedTexture(entry.price, bought), [entry.price, bought])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={[x, ROOM_FLOOR, z]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.7, 0.75, 0.12, 20]} />
        <Toon color="#e8d6b0" />
      </mesh>
      {!bought && (
        <group position={[0, 0.12, 0]} scale={1.3}>
          <FurnitureModel itemId={entry.itemId} night={false} variant={entry.variant} />
        </group>
      )}
      <mesh position={[0.85, 0.35, 0.1]}>
        <boxGeometry args={[0.05, 0.7, 0.05]} />
        <Toon color="#8a6a4a" />
      </mesh>
      <mesh position={[0.85, 0.75, 0.1]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

/** 창문 하나: 뒷벽의 밝은 유리와 나무 틀 */
function Window({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, -ROOM_D / 2 + 0.17]}>
      <mesh>
        <boxGeometry args={[1.5, 1.2, 0.04]} />
        <Toon color="#8a5a3a" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[1.25, 0.95]} />
        <Toon color="#cfe9f5" emissive="#4a7f96" />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.05, 0.95, 0.01]} />
        <Toon color="#8a5a3a" />
      </mesh>
    </group>
  )
}

/** 도토리 상점 방: 바닥·러그·벽·창문·간판·계산대·진열대·점원 두 마리·ATM·천장 등. 입구는 +z 쪽이다. */
export function ShopInterior() {
  const inShop = useGame((s) => s.inShop)
  const night = useGame((s) => s.night)
  const tier = useGame((s) => s.shop.tier)
  const shop = useGame((s) => s.shop)
  const day = useGame((s) => s.day)
  const weeklyBuy = useGame((s) => s.weeklyBuy)
  const sign = useMemo(() => signTexture(), [])
  const banner = useMemo(() => bannerTexture(), [])
  const floor = useMemo(() => floorTexture(), [])
  const rug = useMemo(() => rugTexture(), [])
  useEffect(
    () => () => {
      sign.dispose()
      banner.dispose()
      floor.dispose()
      rug.dispose()
    },
    [sign, banner, floor, rug],
  )
  if (!inShop) return null
  const c = roomCenter(SHOP_ROOM)
  // 진열대 수는 단계에 따라 달라진다. 단계가 바뀌면 방을 다시 짓는다(key).
  const shelves = shopShelvesNow()
  // 계산대 앞에는 오늘의 진열 가구 두 개를 실제 크기로 세운다
  const furniture = displayStock(upgradeState(shop, day).tier, day)
  // 주간 한정 받침대: 2단계부터 서고, 이번 주에 샀으면 빈 받침대로 보인다
  const limited = limitedShelf(upgradeState(shop, day).tier, day, weeklyBuy)
  return (
    <group key={tier} position={[c.x, 0, c.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color={INDOOR_FLOOR} />
      </mesh>
      {/* 나무 바닥과 러그, 입구 매트 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, ROOM_FLOOR + 0.01, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshBasicMaterial map={floor} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROOM_FLOOR + 0.02, 1.2]}>
        <planeGeometry args={[3.4, 1.7]} />
        <meshBasicMaterial map={rug} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROOM_FLOOR + 0.025, ROOM_D / 2 - 0.5]}>
        <planeGeometry args={[1.4, 0.8]} />
        <Toon color="#6b4528" />
      </mesh>
      {/* 벽 세 면과 아랫띠 */}
      <mesh position={[0, WALL_H / 2 + ROOM_FLOOR, -ROOM_D / 2]}>
        <boxGeometry args={[ROOM_W, WALL_H, 0.3]} />
        <Toon color="#f1e3c4" />
      </mesh>
      <mesh position={[-ROOM_W / 2, WALL_H / 2 + ROOM_FLOOR, 0]}>
        <boxGeometry args={[0.3, WALL_H, ROOM_D]} />
        <Toon color="#f1e3c4" />
      </mesh>
      <mesh position={[ROOM_W / 2, WALL_H / 2 + ROOM_FLOOR, 0]}>
        <boxGeometry args={[0.3, WALL_H, ROOM_D]} />
        <Toon color="#f1e3c4" />
      </mesh>
      <mesh position={[0, ROOM_FLOOR + 0.12, -ROOM_D / 2 + 0.16]}>
        <boxGeometry args={[ROOM_W, 0.24, 0.05]} />
        <Toon color="#c9a06e" />
      </mesh>
      {/* 뒷벽 간판과 창문 두 개 */}
      <mesh position={[0, 2.2, -ROOM_D / 2 + 0.18]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={sign} />
      </mesh>
      <Window x={-3.2} y={1.7} />
      <Window x={3.2} y={1.7} />
      {/* 백화점 단계: 뒷벽 왼쪽 위에 오늘의 특가 현수막 */}
      {tier === 3 && (
        <mesh position={[-3.2, 2.7, -ROOM_D / 2 + 0.2]}>
          <planeGeometry args={[1.6, 0.6]} />
          <meshBasicMaterial map={banner} />
        </mesh>
      )}
      <Step />
      <Counter />
      {/* 계산대 앞 바닥 전시: 오늘의 진열 가구 */}
      {furniture.map((e, i) => (
        <FloorDisplay key={e.itemId} id={e.itemId} price={e.price} x={DISPLAY_SPOTS[i].x} z={DISPLAY_SPOTS[i].z} tag={i === 0 ? [0, 0.8] : [0.85, 0.1]} />
      ))}
      {limited.entry && <LimitedPedestal entry={limited.entry} bought={limited.bought} x={LIMITED_SPOT.x} z={LIMITED_SPOT.z} />}
      {shelves.map((o, i) => (
        <Shelf key={i} x={o.x} z={o.z} face={o.x < 0 ? Math.PI / 2 : -Math.PI / 2} seed={i * 2} low={i >= 3} />
      ))}
      {SHOP_OBJECTS.clerks.map((k, i) => (
        <Clerk key={k.id} id={k.id} x={k.x} z={k.z} seed={i + 1} />
      ))}
      <ShopGuests />
      {/* ATM: 오른쪽 벽에 붙어 방 가운데를 본다 */}
      <Atm x={SHOP_OBJECTS.atm.x} y={ROOM_FLOOR} z={SHOP_OBJECTS.atm.z} rot={-Math.PI / 2} />
      {/* 천장 쪽 따뜻한 빛. 천장 판은 두지 않아 빛만 놓는다. 저녁에는 조금 더 밝다 */}
      {[-1.6, 1.6].map((x) => (
        <pointLight key={x} position={[x, WALL_H - 0.3, -0.6]} color="#ffd9a0" intensity={night ? 8 : 5} distance={8} decay={1.4} />
      ))}
    </group>
  )
}
