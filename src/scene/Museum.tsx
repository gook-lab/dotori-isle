import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MUSEUM_ROOM, ROOM_D, ROOM_EXIT, ROOM_FLOOR, ROOM_W, roomCenter } from '../core/interior'
import { heightAt } from '../core/island'
import { BENCHES, type ExhibitLayout, museumLayout, museumOpen, MUSEUM_SITE, POTS, slotOffset, type TankSpot, ZONE_NAME } from '../core/museum'
import { now } from '../game/runtime'
import { useGame } from '../game/store'
import { Chibi, type Look, type Motion } from './Chibi'
import { Merge, shape, useMerged, vertexBasicMaterial, xf } from './batching'
import { ItemModel } from './ItemModel'
import { Part, Toon } from './toon'
import { EaveDrips, useRainy, wetTone } from './EaveDrips'

const WALL_H = 2.8
/** 방 바닥 밖으로 보이는 바다를 덮는 실내 색(Home.tsx 와 같다) */
const INDOOR_FLOOR = '#2b1f17'

/** 학예사 올롱. 올빼미를 닮은 동그란 머리에 노란 부리, 크림색 배, 초록 깃털 귀. */
const CURATOR_LOOK: Look = { skin: '#c9a06e', outfit: '#4f7a5a', ears: 'round', beak: '#f2a541', belly: '#f6ead0', earInner: '#f6ead0' }
const CURATOR_MOTION = (): Motion => ({ moving: false, pace: 1, talking: false })

/** 캔버스로 그린 글자판·무늬 텍스처. 한 번만 만들어 공유한다. */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  draw(cv.getContext('2d')!)
  return new THREE.CanvasTexture(cv)
}

function labelTexture(text: string, fg = '#3f6b4c', bg = '#fdf6e3'): THREE.CanvasTexture {
  return canvasTexture(512, 128, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, 512, 128)
    g.strokeStyle = fg
    g.lineWidth = 10
    g.strokeRect(12, 12, 488, 104)
    g.fillStyle = fg
    // 긴 간판은 글자를 줄여 판 안에 맞춘다. 줄이지 않으면 캔버스 가장자리에서 잘린다
    let size = 64
    g.font = `bold ${size}px sans-serif`
    while (g.measureText(text).width > 440 && size > 24) {
      size -= 4
      g.font = `bold ${size}px sans-serif`
    }
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 68)
  })
}

/** 물음표 스프라이트. 기증 전 빈 칸을 흐리게 알린다. */
function questionTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#ffffff'
    g.font = 'bold 96px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('?', 64, 70)
  })
}

/** 자연사 전시관 건물: 돌 계단, 흰 돌벽, 기둥 네 개, 삼각 박공, 정문과 간판. 정면(+z)이 광장을 본다. */
/** 전시관 처마 네 모서리(건물 그룹 기준, 땅이 y=0). 비 오는 날 여기서 빗방울이 떨어진다. */
const MUSEUM_EAVES: [number, number, number][] = [
  [-2.0, 2.55, -1.6],
  [2.0, 2.55, -1.6],
  [-2.0, 2.55, 1.6],
  [2.0, 2.55, 1.6],
]

function Building() {
  const rainy = useRainy()
  const sign = useMemo(() => labelTexture('도토리 자연사 전시관 🏛'), [])
  useEffect(() => () => sign.dispose(), [sign])
  const pediment = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-2.3, 0)
    s.lineTo(2.3, 0)
    s.lineTo(0, 0.95)
    s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false })
  }, [])
  useEffect(() => () => pediment.dispose(), [pediment])
  return (
    // 집보다 너무 크지 않게 80%로 줄인다. 문과 학예사 자리는 site 기준이라 간격은 그대로다.
    <group scale={0.8}>
      {/* 넓은 계단: 세 단이 앞으로 나온다 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.08 + i * 0.1, 1.4 + i * 0.25]} receiveShadow>
          <boxGeometry args={[4.8 - i * 0.3, 0.16, 0.5]} />
          <Toon color={wetTone(i % 2 ? '#cfb995' : '#dccaa6', rainy)} />
        </mesh>
      ))}
      {/* 따뜻한 돌 벽 몸체, 아랫단 나무 띠와 초록 지붕 가장자리 */}
      <EaveDrips points={MUSEUM_EAVES} />
      <Part color={wetTone('#e3d2ae', rainy)} position={[0, 1.4, 0]} outline={0.04}>
        <boxGeometry args={[4.0, 2.6, 3.2]} />
      </Part>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[4.1, 0.2, 3.3]} />
        <Toon color="#b98b5a" />
      </mesh>
      <mesh position={[0, 2.78, 0]}>
        <boxGeometry args={[4.3, 0.18, 3.5]} />
        <Toon color={wetTone('#5f8f5a', rainy)} />
      </mesh>
      {/* 삼각 박공: 정면 위 */}
      <mesh geometry={pediment} position={[-0.0, 2.88, 1.6]} castShadow>
        <Toon color="#efe9dc" />
      </mesh>
      {/* 기둥 네 개와 주두 */}
      {[-1.4, -0.47, 0.47, 1.4].map((x) => (
        <group key={x} position={[x, 0, 1.95]}>
          <Part color="#f2eee4" position={[0, 1.4, 0]} outline={0.04}>
            <cylinderGeometry args={[0.16, 0.18, 2.5, 12]} />
          </Part>
          <mesh position={[0, 2.7, 0]}>
            <boxGeometry args={[0.44, 0.12, 0.44]} />
            <Toon color="#f2eee4" />
          </mesh>
        </group>
      ))}
      {/* 정문: 가운데 두 짝, 문틀은 어두운 나무 */}
      <Part color="#6b4a2e" position={[0, 0.9, 1.63]} outline={0.03}>
        <boxGeometry args={[0.9, 1.7, 0.08]} />
      </Part>
      {/* 정문 양옆 현수막: 붉은 천 두 장 */}
      {[-1.85, 1.85].map((x) => (
        <mesh key={x} position={[x, 1.85, 1.64]}>
          <boxGeometry args={[0.28, 1.1, 0.03]} />
          <meshToonMaterial color="#b5452f" />
        </mesh>
      ))}
      {/* 간판 판: 기둥 앞으로 띄워 걸어 기둥에 가려지지 않게 한다 */}
      <mesh position={[0, 2.36, 2.27]}>
        <planeGeometry args={[3.0, 0.7]} />
        <meshBasicMaterial map={sign} />
      </mesh>
      {/* 기본 카메라는 남쪽에서 보므로 긴 옆벽(+x)에도 같은 간판을 단다. 정면 간판은 옆에서 거의 안 보인다 */}
      <mesh position={[2.02, 2.3, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[2.6, 0.6]} />
        <meshBasicMaterial map={sign} />
      </mesh>
    </group>
  )
}

/** 건물 바깥: 건물과 문 앞 학예사. 도감에 열 종이 오르면 나타난다. */
export function MuseumExterior() {
  const open = useGame((s) => museumOpen(s.dex))
  const site = MUSEUM_SITE
  if (!site || !open) return null
  return (
    <>
      <group position={[site.x, heightAt(site.x, site.z), site.z]} rotation-y={site.rot}>
        <Building />
      </group>
      <group position={[site.curator.x, heightAt(site.curator.x, site.curator.z), site.curator.z]} rotation-y={site.rot}>
        <Chibi look={CURATOR_LOOK} motion={CURATOR_MOTION} />
      </group>
    </>
  )
}

/** 방 바닥 무늬(체크 타일)와 벽. 벽에는 구역 이름판을 단다. */
function Shell({ tile, labels }: { tile: THREE.Texture; labels: { water: THREE.Texture; bug: THREE.Texture; tide: THREE.Texture; fossil: THREE.Texture } }) {
  return (
    <group>
      <mesh position={[0, ROOM_FLOOR - 0.1, 0]} receiveShadow>
        <boxGeometry args={[ROOM_W, 0.2, ROOM_D]} />
        <meshToonMaterial color="#c98b55" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROOM_FLOOR + 0.01, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshToonMaterial map={tile} />
      </mesh>
      {[
        { pos: [0, WALL_H / 2, -ROOM_D / 2] as const, size: [ROOM_W, WALL_H, 0.12] as const },
        { pos: [-ROOM_W / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, ROOM_D] as const },
        { pos: [ROOM_W / 2, WALL_H / 2, 0] as const, size: [0.12, WALL_H, ROOM_D] as const },
      ].map((w, k) => (
        <mesh key={k} position={[...w.pos]} receiveShadow>
          <boxGeometry args={[...w.size]} />
          <meshToonMaterial color="#efe3cf" />
        </mesh>
      ))}
      {/* 벽 아래 나무 걸레받이 */}
      {[
        { pos: [0, 0.3, -ROOM_D / 2 + 0.07] as const, size: [ROOM_W, 0.6, 0.05] as const },
        { pos: [-ROOM_W / 2 + 0.07, 0.3, 0] as const, size: [0.05, 0.6, ROOM_D] as const },
        { pos: [ROOM_W / 2 - 0.07, 0.3, 0] as const, size: [0.05, 0.6, ROOM_D] as const },
      ].map((w, k) => (
        <mesh key={k} position={[...w.pos]}>
          <boxGeometry args={[...w.size]} />
          <meshToonMaterial color="#b97f4c" />
        </mesh>
      ))}
      {/* 구역 이름판: 뒷벽은 물고기와 바닷가, 오른쪽 벽은 벌레, 왼쪽 벽은 화석 */}
      <mesh position={[0, 2.2, -ROOM_D / 2 + 0.08]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={labels.water} />
      </mesh>
      <mesh position={[-3.4, 2.2, -ROOM_D / 2 + 0.08]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={labels.tide} />
      </mesh>
      <mesh position={[ROOM_W / 2 - 0.08, 2.2, 0.2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={labels.bug} />
      </mesh>
      <mesh position={[-ROOM_W / 2 + 0.08, 2.2, 0.2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial map={labels.fossil} />
      </mesh>
      {/* 들어오는 문 앞 깔개: 빨강·크림 줄무늬 */}
      <mesh position={[0, ROOM_FLOOR + 0.02, 2.9]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.4, 1.3]} />
        <meshBasicMaterial color="#b5452f" />
      </mesh>
      <mesh position={[0, ROOM_FLOOR + 0.025, 2.9]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.0, 0.9]} />
        <meshBasicMaterial color="#f6e7c8" />
      </mesh>
      <mesh position={[ROOM_EXIT.x, ROOM_FLOOR + 0.03, ROOM_EXIT.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.3, 0.7]} />
        <meshToonMaterial color="#8a5a3b" />
      </mesh>
    </group>
  )
}

/**
 * 나무·유리·흙·받침대 같은 정적 전시 몸체는 재질별로 한 묶음씩 굳힌다(batching).
 * 유리 묶음은 반투명 기본 재질로 그리고, 물과 흙 색을 얹는다.
 */
function Furnishings() {
  const body = useMerged(
    (b) => {
      for (const p of POTS) {
        b.add(shape(THREE.CylinderGeometry, 0.2, 0.16, 0.4, 12), xf([p.x, 0.2, p.z]), '#d9774a', { outline: 0.03 })
        b.add(shape(THREE.SphereGeometry, 0.42, 12, 8), xf([p.x, 0.9, p.z], [0, 0, 0], [1, 1.1, 1]), '#6cb35c', { outline: 0.04 })
      }
      for (const bn of BENCHES) {
        b.add(shape(THREE.BoxGeometry, 0.5, 0.12, 1.4), xf([bn.x, 0.5, bn.z]), '#a8744a', { outline: 0.03 })
        for (const dz of [-0.55, 0.55]) b.add(shape(THREE.BoxGeometry, 0.45, 0.4, 0.1), xf([bn.x, 0.2, bn.z + dz]), '#8a5a3b', { outline: 0.02 })
      }
    },
    [],
  )
  return <Merge g={body} />
}

/** 물고기 수조 네 칸: 나무 받침, 모래 바닥, 물 부피(반투명), 테두리 틀. 칸마다 기증을 물고기로 채운다. */
function Tanks({ layout }: { layout: ExhibitLayout }) {
  const frames = useMerged(
    (b) => {
      for (const t of layout.tanks) {
        b.add(shape(THREE.BoxGeometry, 1.7, 0.45, 1.3), xf([t.x, 0.3, t.z]), '#7a4e30', { outline: 0.04 })
        b.add(shape(THREE.BoxGeometry, 1.5, 0.08, 1.1), xf([t.x, 0.52, t.z]), '#e8d3a2', { outline: 0.02 })
      }
    },
    [layout],
  )
  const water = useMerged(
    (b) => {
      for (const t of layout.tanks) b.add(shape(THREE.BoxGeometry, 1.5, 1.0, 1.1), xf([t.x, 1.0, t.z]), '#7fd3ea', { unlit: true })
    },
    [layout],
  )
  const waterMat = useMemo(() => {
    const m = vertexBasicMaterial()
    m.transparent = true
    m.opacity = 0.38
    m.depthWrite = false
    return m
  }, [])
  useEffect(() => () => waterMat.dispose(), [waterMat])
  return (
    <>
      <Merge g={frames} />
      <Merge g={water} basic={waterMat} />
      <Bubbles tanks={layout.tanks} />
      {layout.tanks.flatMap((t, ti) =>
        t.items.map((id, k) => {
          const o = slotOffset(k)
          if (id) return <Swimmer key={`${ti}-${k}-${id}`} id={id} x={t.x} z={t.z} k={k} />
          return <Placeholder key={`${ti}-${k}`} x={t.x + o.x} y={0.7} z={t.z + o.z} scale={0.42} />
        }),
      )}
    </>
  )
}

/**
 * 수조 밑에서 올라오는 거품. 수조마다 네 개씩 한 묶음(InstancedMesh)으로 그려 그리기 호출을 한 번으로 줄인다.
 * 움직임은 시간으로 매 프레임 옮긴다. 거품이 움직여서 묶음 경계가 맞지 않으니 컬링은 끈다.
 */
function Bubbles({ tanks }: { tanks: { x: number; z: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const im = ref.current
    if (!im) return
    tanks.forEach((t, ti) => {
      for (let i = 0; i < 4; i++) {
        const k = (now() * 0.25 + i / 4 + ti * 0.37) % 1
        const sc = 0.6 + Math.sin(k * Math.PI) * 0.4
        m.makeScale(sc, sc, sc).setPosition(t.x + Math.sin(i * 2.1 + ti) * 0.5, 0.45 + k * 1.0, t.z + Math.cos(i * 1.3) * 0.3)
        im.setMatrixAt(ti * 4 + i, m)
      }
    })
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, tanks.length * 4]} frustumCulled={false}>
      <sphereGeometry args={[0.035, 6, 5]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
    </instancedMesh>
  )
}

/** 수조 안을 천천히 도는 물고기. 조금 크게 그려 눈에 잘 띈다. */
function Swimmer({ id, x, z, k }: { id: string; x: number; z: number; k: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const grp = g.current
    if (!grp) return
    const t = now() * 0.8 + k * 1.7
    const o = slotOffset(k)
    const px = x + o.x + Math.sin(t) * 0.3
    const pz = z + o.z + Math.sin(t * 0.6 + k) * 0.18
    grp.position.set(px, 0.85 + Math.sin(t * 1.3) * 0.05, pz)
    grp.rotation.y = Math.atan2(Math.cos(t) * 0.3, Math.cos(t * 0.6 + k) * 0.11)
  })
  return (
    <group ref={g} scale={1.5}>
      <ItemModel id={id} />
    </group>
  )
}

/** 빈 칸 표시: 물음표가 천천히 떠 있다. 기증하면 물건이 그 자리에 놓인다. */
function Placeholder({ x, y, z, scale }: { x: number; y: number; z: number; scale: number }) {
  const tex = useMemo(() => questionTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.y = y + Math.sin(now() * 1.6 + x) * 0.04
  })
  return (
    <group ref={g} position={[x, y, z]}>
      <sprite scale={[scale, scale, 1]}>
        <spriteMaterial map={tex} color="#ffffff" transparent opacity={0.45} depthWrite={false} />
      </sprite>
    </group>
  )
}

/**
 * 바닷가 얕은 물웅덩이: 모래를 깐 얇은 대야에 물을 조금 채운다. 유리 상자는 없다.
 * 게와 불가사리는 모래 위에 앉고, 빈 칸은 물음표로 보인다.
 */
function TidePool({ pool }: { pool: TankSpot }) {
  const frame = useMerged(
    (b) => {
      b.add(shape(THREE.BoxGeometry, 1.7, 0.22, 1.3), xf([pool.x, 0.11, pool.z]), '#7a4e30', { outline: 0.04 })
      b.add(shape(THREE.BoxGeometry, 1.5, 0.04, 1.1), xf([pool.x, 0.2, pool.z]), '#e8d3a2', { outline: 0.02 })
    },
    [pool],
  )
  const water = useMerged(
    (b) => {
      b.add(shape(THREE.BoxGeometry, 1.5, 0.16, 1.1), xf([pool.x, 0.28, pool.z]), '#7fd3ea', { unlit: true })
    },
    [pool],
  )
  const waterMat = useMemo(() => {
    const m = vertexBasicMaterial()
    m.transparent = true
    m.opacity = 0.42
    m.depthWrite = false
    return m
  }, [])
  useEffect(() => () => waterMat.dispose(), [waterMat])
  return (
    <>
      <Merge g={frame} />
      <Merge g={water} basic={waterMat} />
      {pool.items.map((id, k) => {
        const x = pool.x + (k ? 0.4 : -0.4)
        if (id)
          return (
            <group key={`${k}-${id}`} position={[x, 0.3, pool.z]}>
              <ItemModel id={id} />
            </group>
          )
        return <Placeholder key={k} x={x} y={0.62} z={pool.z} scale={0.36} />
      })}
    </>
  )
}

/** 벌레 테라리움 세 칸: 흙 바닥, 작은 풀, 유리 상자. 벌레는 흙 위에 앉는다. */
function Terrariums({ layout }: { layout: ExhibitLayout }) {
  const soil = useMerged(
    (b) => {
      for (const t of layout.terrariums) {
        b.add(shape(THREE.BoxGeometry, 0.9, 0.3, 1.2), xf([t.x, 0.2, t.z]), '#6b4528', { outline: 0.03 })
        for (const dz of [-0.3, 0.3]) b.add(shape(THREE.ConeGeometry, 0.1, 0.4, 5), xf([t.x + 0.1, 0.5, t.z + dz]), '#6cb35c', { outline: 0.03 })
      }
    },
    [layout],
  )
  const glass = useMerged(
    (b) => {
      for (const t of layout.terrariums) b.add(shape(THREE.BoxGeometry, 0.9, 1.3, 1.2), xf([t.x, 0.95, t.z]), '#d7f5c8', { unlit: true })
    },
    [layout],
  )
  const glassMat = useMemo(() => {
    const m = vertexBasicMaterial()
    m.transparent = true
    m.opacity = 0.22
    m.depthWrite = false
    return m
  }, [])
  useEffect(() => () => glassMat.dispose(), [glassMat])
  return (
    <>
      <Merge g={soil} />
      <Merge g={glass} basic={glassMat} />
      {layout.terrariums.flatMap((t, ti) =>
        t.items.map((id, k) => {
          const z = t.z + (k - 1) * 0.3
          if (id)
            return (
              <group key={`${ti}-${k}-${id}`} position={[t.x, 0.35, z]}>
                <ItemModel id={id} />
              </group>
            )
          return <Placeholder key={`${ti}-${k}`} x={t.x} y={0.6} z={z} scale={0.36} />
        }),
      )}
    </>
  )
}

/** 화석 받침대 여섯 개. 가운데 윗면은 따뜻하게 빛나고, 기증한 화석이 그 위에 놓인다. */
function Plinths({ layout }: { layout: ExhibitLayout }) {
  const body = useMerged(
    (b) => {
      for (const p of layout.plinths) b.add(shape(THREE.CylinderGeometry, 0.45, 0.5, 0.8, 14), xf([p.x, 0.4, p.z]), '#e8dcc8', { outline: 0.04 })
    },
    [layout],
  )
  const glow = useMerged(
    (b) => {
      for (const p of layout.plinths) b.add(shape(THREE.CylinderGeometry, 0.4, 0.4, 0.03, 14), xf([p.x, 0.82, p.z]), '#ffd98a', { unlit: true })
    },
    [layout],
  )
  return (
    <>
      <Merge g={body} />
      <Merge g={glow} />
      {layout.plinths.map((p, i) =>
        p.itemId ? (
          <group key={p.itemId} position={[p.x, 0.9, p.z]}>
            <ItemModel id={p.itemId} />
          </group>
        ) : (
          <Placeholder key={`p${i}`} x={p.x} y={1.15} z={p.z} scale={0.36} />
        ),
      )}
    </>
  )
}

/** 전시관 방. 방 안에 들어가 있을 때만 그린다. */
export function MuseumInterior() {
  const inMuseum = useGame((s) => s.inMuseum)
  const donated = useGame((s) => s.museum)
  const night = useGame((s) => s.night)
  const layout = useMemo(() => museumLayout(donated), [donated])
  const tile = useMemo(
    () =>
      canvasTexture(64, 64, (g) => {
        g.fillStyle = '#d9a877'
        g.fillRect(0, 0, 64, 64)
        g.fillStyle = '#c98b55'
        g.fillRect(0, 0, 32, 32)
        g.fillRect(32, 32, 32, 32)
      }),
    [],
  )
  useEffect(() => {
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping
    tile.repeat.set(5, 4)
    tile.needsUpdate = true
    return () => tile.dispose()
  }, [tile])
  const labels = useMemo(() => ({ water: labelTexture(`${ZONE_NAME.fish} 구역`), bug: labelTexture(`${ZONE_NAME.bug} 구역`), tide: labelTexture(`${ZONE_NAME.tide} 구역`), fossil: labelTexture(`${ZONE_NAME.fossil} 구역`) }), [])
  useEffect(() => () => Object.values(labels).forEach((t) => t.dispose()), [labels])
  if (!inMuseum) return null
  const c = roomCenter(MUSEUM_ROOM)
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color={INDOOR_FLOOR} />
      </mesh>
      <Shell tile={tile} labels={labels} />
      <Furnishings />
      <Tanks layout={layout} />
      <Terrariums layout={layout} />
      <TidePool pool={layout.tidePool} />
      <Plinths layout={layout} />
      {/* 천장 등 세 개: 따뜻한 빛 */}
      {[-2.8, 0, 2.8].map((x) => (
        <pointLight key={x} position={[x, WALL_H - 0.3, -0.4]} color="#ffd9a0" intensity={night ? 10 : 6} distance={9} decay={1.4} />
      ))}
      <mesh position={[0, WALL_H - 0.2, -0.4]}>
        <boxGeometry args={[ROOM_W - 3, 0.03, 0.4]} />
        <meshBasicMaterial color="#fff2cf" />
      </mesh>
    </group>
  )
}
