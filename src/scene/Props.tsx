import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { getLayout } from '../core/daily'
import { RAIN_STONE_ID } from '../core/rainStones'
import { heightAt, onTrip } from '../core/island'
import { SEASON_INFO, type Season } from '../core/season'
import { SHOP, TREES, type TreeSpot } from '../core/world'
import { lookFor, SHOP_TIERS, upgradeState, type BuildingLook } from '../core/shopTiers'
import { isFlashDay } from '../core/shopEvents'
import { SHOP_NAME } from '../core/shopRoom'
import { ShopReopenCeremony, ShopSiteSign, ShopWorker } from './ShopConstruction'
import { treeState, type Felled } from '../core/trees'
import { DROP_TIME, FALL_TIME, now, runtime, SHAKE_TIME, burst } from '../game/runtime'
import { play } from '../game/sfx'
import { useGame } from '../game/store'
import { useSeason } from './Island'
import { EaveDrips } from './EaveDrips'
import { glowMaterial, nightLevel } from './glow'
import { WindowPane } from './WindowPane'
import { ItemModel } from './ItemModel'
import { Batch, Merge, mul, shape, useMerged, useOwnMaterials, vertexToonMaterial, xf } from './batching'
import { withNightTone } from './worldFx'
import { bodyHole, outlineHole, useOcclusionFade, withPlayerHole } from './occlusion'
import { freeze, gradient, outlineMat, Part, Toon } from './toon'
import { chipSpots, notchAngles } from './wear'

const FRUIT_SPOTS: [number, number, number][] = [
  [0.7, 1.75, 0.6],
  [-0.65, 2.05, 0.55],
  [0.1, 2.35, 0.85],
]

/** 바람에 살랑이고, 흔들면 크게 떨리며 잎이 눌렸다 펴진다. 플레이어를 가리면 반투명해진다. */
function useSway(tree: TreeSpot) {
  const ref = useRef<THREE.Group>(null)
  const phase = tree.x * 0.37 + tree.z * 0.21
  // 플레이어를 가리면 잎 덩이를 반투명하게 비켜 준다.
  const center = useMemo(() => [tree.x, heightAt(tree.x, tree.z) + 1.7 * tree.scale, tree.z] as const, [tree])
  useOcclusionFade(ref, center, 1.25 * tree.scale)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    const sh = runtime.shake
    const st = sh?.id === tree.id ? sh.t : SHAKE_TIME
    const k = Math.max(0, 1 - st / SHAKE_TIME)
    ref.current.rotation.z = Math.sin(t * 1.3 + phase) * 0.025 + Math.sin(st * 40) * 0.18 * k
    ref.current.rotation.x = Math.sin(t * 1.1 + phase * 2) * 0.02
    const squash = 1 + Math.sin(st * 30) * 0.1 * k
    ref.current.scale.set(1 / squash, squash, 1 / squash)
  })
  return ref
}

const FRUIT_COLOR: Record<string, string> = { peach: '#ffa38a', orange: '#ffa233' }

/** 쓰러질 때 기울이는 최종 각도. 땅에 거의 닿을 때까지 기운다. */
const FALL_ANGLE = (Math.PI / 2) * 0.95

/**
 * 베어 넘어가는 나무. runtime.fall 이 이 나무일 때 뿌리를 축으로 점점 빨라지며 기울고, 닿으면 지운다.
 * 칼날이 박히기 전(t0 이 아직 안 된 시간)에는 제자리에 서 있다. standing 이 false 면 기울어 닿은 뒤 숨는다.
 */
function useFall(tree: TreeSpot, standing: boolean, trunk: RefObject<THREE.Group | null>) {
  const root = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = root.current
    if (!g) return
    const f = runtime.fall
    const mine = f && f.id === tree.id ? f : null
    if (!mine) {
      g.visible = standing
      if (trunk.current) trunk.current.visible = false
      g.rotation.set(0, 0, 0, 'YXZ')
      return
    }
    const k = Math.min(1, Math.max(0, (now() - mine.t0) / FALL_TIME))
    if (k >= 1) {
      // 닿는 순간 한 번: 쿵 소리와 잎이 흩어진다.
      runtime.fall = null
      play('thud')
      burst({ kind: 'leaves', x: tree.x, y: heightAt(tree.x, tree.z) + 2 * tree.scale, z: tree.z })
      g.visible = standing
      if (trunk.current) trunk.current.visible = false
      g.rotation.set(0, 0, 0, 'YXZ')
      return
    }
    g.visible = true
    // 쓰러지는 동안엔 몸통을 나무 그룹 안에서 따로 그린다(서 있는 몸통은 TreeTrunks 인스턴스가 맡는다).
    if (trunk.current) trunk.current.visible = true
    // 처음엔 천천히, 끝으로 갈수록 빨리 넘어간다.
    g.rotation.set(0, mine.yaw, k * k * FALL_ANGLE, 'YXZ')
  })
  return root
}

/** 찍힌 횟수. 나무마다 이것만 구독해, 한 그루를 쳐도 다른 나무는 다시 그리지 않는다. */
const useChops = (id: string) => useGame((s) => s.chopped[id] ?? 0)

/**
 * 도끼 자국. 횟수만큼 밝은 쐐기가 한 덩어리로 붙는다. 자리는 `tilt` 로 기울인다(0 = 몸통, 음수 = 아래쪽 부채 가장자리).
 * 소나무는 아래 단이 몸통을 덮어 몸통이 안 보이니, 단 가장자리에 붙이고 잎 그룹 안에 둬서 가려질 때 같이 페이드한다.
 */
function Notches({ tree, y, r, tilt = 0, lit }: { tree: TreeSpot; y: number; r: number; tilt?: number; lit?: THREE.Material }) {
  const n = useChops(tree.id)
  // 자국은 표면에서 살짝 튀어나오게 놓는다(표면에 묻히면 안 보인다).
  const g = useMerged(
    (b) => {
      for (const a of notchAngles(n)) {
        const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 4))
        m.setPosition(Math.sin(a) * (r + 0.012), y, Math.cos(a) * (r + 0.012))
        b.add(shape(THREE.BoxGeometry, 0.14, 0.16, 0.035), m, '#f1d3a4', { outline: 0, cast: false })
      }
    },
    [n, y, r, tilt],
  )
  return <Merge g={g} lit={lit} />
}

/** 밑동에 흩어진 나뭇조각. 흔들림 그룹 밖에 둬서 잎이 흔들려도 땅에 가만히 있다. */
function Chips({ tree }: { tree: TreeSpot }) {
  const n = useChops(tree.id)
  const g = useMerged(
    (b) => {
      for (const c of chipSpots(n))
        b.add(shape(THREE.BoxGeometry, 0.08, 0.025, 0.045), xf([Math.cos(c.a) * c.d, 0.02, Math.sin(c.a) * c.d], [c.tilt, c.spin, 0]), '#e9c79a', { outline: 0, cast: false })
    },
    [n],
  )
  return <Merge g={g} />
}

/** 잎 묶음마다 재질을 따로 둔다. 가려지면 그 나무만 반투명해야 하므로 공유하지 않는다. */
/** 나무 테두리 껍데기: 나무들이 함께 쓴다. 나무마다 숨김은 껍데기 표시로 하고 재질 투명도는 건드리지 않으니 하나로 충분하다. */
const treeOutline = withPlayerHole(outlineMat.clone(), outlineHole)

function useCrownMaterial() {
  // 잎 덩이가 플레이어를 가리면 플레이어 주변만 잘라 낸다(occlusion.ts). 나무 몸통은 그대로 둔다.
  // 잎 재질은 나무마다 따로 둔다(가려지면 재질 투명도를 나무별로 낮추므로).
  const mat = useMemo(() => withNightTone(withPlayerHole(vertexToonMaterial(), bodyHole)), [])
  useEffect(() => () => mat.dispose(), [mat])
  return { mat, outline: treeOutline }
}

/** 몸통 치수. 서 있는 나무는 TreeTrunks 가 종류별 인스턴스로, 쓰러지는 나무는 제 그룹 안에서 그린다. 둘이 같은 값을 쓴다. */
const TRUNK = {
  fruit: { args: [0.17, 0.27, 1.3, 10] as [number, number, number, number], color: '#9b6a45', y: 0.65 },
  pine: { args: [0.14, 0.22, 0.9, 8] as [number, number, number, number], color: '#8a5a3b', y: 0.45 },
} as const
/** 기본 테두리 두께(Part 의 outline 기본값과 같다). */
const TRUNK_OUTLINE = 0.06

function FruitTree({ tree, hasFruit, season, standing }: { tree: TreeSpot; hasFruit: boolean; season: Season; standing: boolean }) {
  const crown = useSway(tree)
  const trunk = useRef<THREE.Group>(null)
  const root = useFall(tree, standing, trunk)
  const { mat, outline } = useCrownMaterial()
  // 잎·열매를 한 덩어리로 굳힌다(색은 정점 색). 열매는 흔들림 그룹 안에 같이 달린다.
  const g = useMerged(
    (b) => {
      const [l0, l1, l2, l3] = SEASON_INFO[season].leaves
      b.add(shape(THREE.SphereGeometry, 0.95, 14, 11), xf([0, 0.85, 0]), l0, { outline: 0.05 })
      b.add(shape(THREE.SphereGeometry, 0.62, 11, 9), xf([0.65, 0.55, 0.1]), l1, { outline: 0.06 })
      b.add(shape(THREE.SphereGeometry, 0.66, 11, 9), xf([-0.6, 0.6, -0.15]), l2, { outline: 0.06 })
      b.add(shape(THREE.SphereGeometry, 0.55, 11, 9), xf([0.05, 1.45, 0.05]), l3, { outline: 0.07 })
      if (hasFruit)
        for (const [x, y, z] of FRUIT_SPOTS) b.add(shape(THREE.SphereGeometry, 0.17, 8, 6), xf([x, y - 1.2, z]), FRUIT_COLOR[tree.fruit ?? 'peach'], { outline: 0.1 })
    },
    [season, hasFruit, tree.fruit],
  )
  return (
    <group ref={root} position={[tree.x, heightAt(tree.x, tree.z), tree.z]} scale={tree.scale}>
      <group ref={trunk} visible={false}>
        <Part color={TRUNK.fruit.color} position={[0, TRUNK.fruit.y, 0]}>
          <cylinderGeometry args={TRUNK.fruit.args} />
        </Part>
      </group>
      <Notches tree={tree} y={0.85} r={0.2} />
      <Chips tree={tree} />
      <group ref={crown} position={[0, 1.2, 0]}>
        <Merge g={g} lit={mat} hull={outline} />
      </group>
    </group>
  )
}

function PineTree({ tree, season, standing }: { tree: TreeSpot; season: Season; standing: boolean }) {
  const crown = useSway(tree)
  const trunk = useRef<THREE.Group>(null)
  const root = useFall(tree, standing, trunk)
  const { mat, outline } = useCrownMaterial()
  // 단들을 한 덩어리로 굳힌다. 겨울엔 단마다 눈 원뿔을 얹는다.
  const g = useMerged(
    (b) => {
      const [p0, p1, p2] = SEASON_INFO[season].pine
      b.add(shape(THREE.ConeGeometry, 1.05, 1.4, 12), xf([0, 1.35, 0]), p0, { outline: 0.05 })
      b.add(shape(THREE.ConeGeometry, 0.8, 1.15, 12), xf([0, 2.05, 0]), p1, { outline: 0.06 })
      b.add(shape(THREE.ConeGeometry, 0.5, 0.8, 12), xf([0, 2.65, 0]), p2, { outline: 0.07 })
      // 겨울엔 단마다 꼭대기 쪽에 눈이 소복이 쌓인다. 윗단에 가려지는 부분 바로 아래까지 덮는다.
      if (season === 'winter')
        for (const [y, r, h] of [
          [1.69, 0.585, 0.75],
          [2.373, 0.38, 0.525],
          [2.86, 0.26, 0.4],
        ])
          b.add(shape(THREE.ConeGeometry, r, h, 12), xf([0, y, 0]), '#ffffff', { outline: 0.05 })
    },
    [season],
  )
  return (
    <group ref={root} position={[tree.x, heightAt(tree.x, tree.z), tree.z]} scale={tree.scale}>
      <group ref={trunk} visible={false}>
        <Part color={TRUNK.pine.color} position={[0, TRUNK.pine.y, 0]}>
          <cylinderGeometry args={TRUNK.pine.args} />
        </Part>
      </group>
      <Chips tree={tree} />
      <group ref={crown}>
        <Merge g={g} lit={mat} hull={outline} />
        {/* 아래 단 가장자리(반지름 0.86, 높이 0.9)에 부채꼴로 붙인다. 기울기는 원뿔 옆면을 따른다. */}
        <Notches tree={tree} y={0.9} r={0.86} tilt={-0.644} lit={mat} />
      </group>
    </group>
  )
}

/** 그루터기: 짧은 줄기 토막에 나이테 윗면. 소품처럼 몸이 걸린다. */
function Stump({ tree }: { tree: TreeSpot }) {
  return (
    <group ref={freeze} position={[tree.x, heightAt(tree.x, tree.z), tree.z]}>
      <Part color="#a8744a" position={[0, 0.17, 0]} outline={0.08}>
        <cylinderGeometry args={[0.3, 0.36, 0.34, 12]} />
      </Part>
      <mesh position={[0, 0.345, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.3, 14]} />
        <Toon color="#e8c48f" />
      </mesh>
      <mesh position={[0, 0.35, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.14, 14]} />
        <meshBasicMaterial color="#b88a55" />
      </mesh>
    </group>
  )
}

/** 싹: 가는 줄기에 작은 연둣빛 덩이. 며칠 지나면 나무가 된다. */
function Sapling({ tree }: { tree: TreeSpot }) {
  return (
    <group ref={freeze} position={[tree.x, heightAt(tree.x, tree.z), tree.z]}>
      <Part color="#9b6a45" position={[0, 0.16, 0]} outline={0.08}>
        <cylinderGeometry args={[0.035, 0.05, 0.32, 8]} />
      </Part>
      <Part color="#7ccf6e" position={[0, 0.45, 0]} outline={0.1}>
        <sphereGeometry args={[0.2, 12, 10]} />
      </Part>
    </group>
  )
}

/**
 * 서 있는 나무 몸통을 종류마다 한 덩어리로 그린다(몸통 + 테두리 = 종류당 2 draw call).
 * 쓰러지는 나무와 베인 나무의 칸은 0 크기로 접어 숨긴다. 쓰러지는 나무는 FruitTree·PineTree 가 제 몸통을 그린다.
 */
function writeTrunks(kind: 'fruit' | 'pine', list: TreeSpot[], body: THREE.InstancedMesh, edge: THREE.InstancedMesh, felled: Felled, day: string, falling: string | null) {
  const { y } = TRUNK[kind]
  const root = new THREE.Matrix4()
  const part = new THREE.Matrix4().makeTranslation(0, y, 0)
  const grow = new THREE.Matrix4().makeScale(1 + TRUNK_OUTLINE, 1 + TRUNK_OUTLINE, 1 + TRUNK_OUTLINE)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const none = new THREE.Quaternion()
  list.forEach((t, i) => {
    const hidden = t.id === falling || treeState(t.id, felled, day) !== 'tree'
    pos.set(t.x, heightAt(t.x, t.z), t.z)
    scl.setScalar(hidden ? 0 : t.scale)
    root.compose(pos, none, scl).multiply(part)
    body.setMatrixAt(i, root)
    edge.setMatrixAt(i, root.clone().multiply(grow))
  })
  body.instanceMatrix.needsUpdate = true
  edge.instanceMatrix.needsUpdate = true
}

function TreeTrunks({ kind }: { kind: 'fruit' | 'pine' }) {
  const felled = useGame((s) => s.felled)
  const day = useGame((s) => s.day)
  const list = useMemo(() => TREES.filter((t) => t.kind === kind), [kind])
  const body = useRef<THREE.InstancedMesh>(null)
  const edge = useRef<THREE.InstancedMesh>(null)
  // 마지막으로 쓴 쓰러짐 대상. 쓰러짐이 시작·끝날 때만 칸을 다시 쓴다.
  const seen = useRef<string | null>(null)
  const write = () => {
    if (!body.current || !edge.current) return
    seen.current = runtime.fall?.id ?? null
    writeTrunks(kind, list, body.current, edge.current, felled, day, seen.current)
  }
  // 렌더 뒤(화면에 나오기 전)에 칸을 채운다. felled·day 가 바뀌면 같이 다시 쓴다.
  useLayoutEffect(write)
  useFrame(() => {
    if ((runtime.fall?.id ?? null) !== seen.current) write()
  })
  const { args, color } = TRUNK[kind]
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, list.length]} castShadow>
        <cylinderGeometry args={args} />
        <Toon color={color} />
      </instancedMesh>
      <instancedMesh ref={edge} args={[undefined, undefined, list.length]} material={outlineMat}>
        <cylinderGeometry args={args} />
      </instancedMesh>
    </>
  )
}

export function Trees() {
  const shaken = useGame((s) => s.shaken)
  const felled = useGame((s) => s.felled)
  const day = useGame((s) => s.day)
  const home = useSeason()
  return (
    <>
      <TreeTrunks kind="fruit" />
      <TreeTrunks kind="pine" />
      {TREES.map((t) => {
        const st = treeState(t.id, felled, day)
        const season = onTrip(t.x) ? 'summer' : home
        return (
          <group key={t.id}>
            {t.kind === 'fruit' ? (
              <FruitTree tree={t} hasFruit={!shaken.includes(t.id)} season={season} standing={st === 'tree'} />
            ) : (
              <PineTree tree={t} season={season} standing={st === 'tree'} />
            )}
            {st === 'stump' && <Stump tree={t} />}
            {st === 'sapling' && <Sapling tree={t} />}
          </group>
        )
      })}
    </>
  )
}

/**
 * 단계별 치수. 벽·문·창·차양이 모두 이 값에서 나와서 노점과 큰 가게가 같은 규칙으로 그려진다.
 * 노점(폭 3)은 창을 좁히고 간판을 줄여 문과 겹치지 않게 한다.
 */
function shopDims(look: BuildingLook) {
  const hw = look.w / 2
  const front = look.d / 2
  const two = look.floors === 2
  // 2층이면 아래층을 절반쯤으로 나눠 위층 벽을 그 위에 올린다. 지붕 자리는 roofY 가 정한다.
  const wallH = two ? (look.h - 0.5) * 0.5 : look.h - 0.5
  const upperH = two ? look.h - 0.5 - wallH : 0
  const dh = Math.min(1.9, wallH - 0.25)
  const small = look.w < 4
  const winW = small ? 0.6 : 1.08
  const slabY = 0.2 + wallH + 0.05
  // 지붕 아래 바닥판의 가운데 높이. 1층은 slabY 그대로, 2층은 위층 벽 위에 한 장 더 얹힌다.
  const roofY = two ? slabY + upperH + 0.14 : slabY
  return { hw, front, wallH, upperH, dh, slabY, roofY, winX: look.w * 0.34, winY: wallH * 0.62, winW, small }
}

/**
 * 상점 대부분을 한 덩어리로 굳힌다. 빛나는 유리와 반투명 하이라이트만 따로 그린다(재질 속성이 달라서).
 * 가려지면 건물 전체가 비켜 주므로, 이 상점만의 재질을 쓴다.
 */
function buildShop(b: Batch, look: BuildingLook, season: Season) {
  const { w, d } = look
  const { hw, front, wallH, upperH, dh, slabY, roofY, winX, winY, winW, small } = shopDims(look)
  const box = (w: number, h: number, d: number) => shape(THREE.BoxGeometry, w, h, d)
  const sph = (...a: number[]) => shape(THREE.SphereGeometry, ...a)
  const cyl = (...a: (number | boolean)[]) => shape(THREE.CylinderGeometry, ...a)
  const cone = (...a: number[]) => shape(THREE.ConeGeometry, ...a)
  b.add(box(w + 0.14, 0.2, d + 0.14), xf([0, 0.1, 0]), '#cfc6b8', { outline: 0.02 })
  b.add(box(w, wallH, d), xf([0, 0.2 + wallH / 2, 0]), look.wall, { outline: 0.02 })
  for (const ly of [0.6, 1.0, 1.4, 1.8, 2.2]) if (ly < wallH + 0.1) b.add(box(w, 0.02, 0.01), xf([0, ly, front + 0.004]), '#e6d3b3', { unlit: true })
  for (const cx of [-hw, hw]) for (const cz of [-front, front]) b.add(box(0.18, wallH, 0.18), xf([cx, 0.2 + wallH / 2, cz]), '#a8744a', { outline: 0.04 })
  b.add(box(w + 0.3, 0.14, d + 0.3), xf([0, slabY, 0]), '#a8744a', { outline: 0.02 })
  if (look.floors === 2) {
    // 위층: 벽, 창 세 개, 발코니 난간, 위층 바닥판(지붕 자리)
    const y0 = slabY + 0.07
    b.add(box(w, upperH, d), xf([0, y0 + upperH / 2, 0]), look.wall, { outline: 0.02 })
    for (const wx of [-w * 0.3, 0, w * 0.3]) {
      b.add(box(0.9, upperH * 0.5, 0.06), xf([wx, y0 + upperH * 0.55, front + 0.03]), '#a8744a', { outline: 0.04 })
      b.add(box(0.7, upperH * 0.4, 0.04), xf([wx, y0 + upperH * 0.55, front + 0.07]), '#9ad0ec', { outline: 0 })
    }
    b.add(box(w * 0.9, 0.06, 0.25), xf([0, y0 + upperH * 0.2, front + 0.12]), '#8a5a3b', { outline: 0.03 })
    b.add(box(w + 0.3, 0.14, d + 0.3), xf([0, roofY, 0]), '#a8744a', { outline: 0.02 })
  }
  // 지붕: 네모 뿔. 단계마다 색이 다르다.
  b.add(cone(Math.max(w, d) * 0.74, 1.7, 4), xf([0, roofY + 0.85, 0], [0, Math.PI / 4, 0]), look.roof, { outline: 0.03 })
  // 겨울엔 지붕 꼭대기에 눈 모자. 같은 꼭짓점의 짧은 뿔이라 지붕 경사에 딱 붙는다.
  if (season === 'winter') b.add(cone((Math.max(w, d) * 0.74 * 0.36 * 1.02) / 1.7, 0.36, 4), xf([0, roofY + 1.52, 0], [0, Math.PI / 4, 0]), '#f7fbff', { outline: 0.03 })
  // 다락 창: 지붕 앞면에 붙인 작은 집. 큰 가게 실루엣을 가게와 구분한다.
  if (look.dormer) {
    const dy = roofY + 0.45
    const dz = front - 0.15
    b.add(box(0.9, 0.7, 0.8), xf([0, dy, dz]), look.roof, { outline: 0.03 })
    b.add(cone(0.62, 0.45, 4), xf([0, dy + 0.57, dz], [0, Math.PI / 4, 0]), look.roof, { outline: 0.03 })
    b.add(box(0.56, 0.46, 0.03), xf([0, dy - 0.02, dz + 0.4]), '#fdf6e3', { outline: 0.04 })
    b.add(box(0.44, 0.36, 0.02), xf([0, dy - 0.02, dz + 0.42]), '#9ad0ec', { outline: 0 })
  }
  // 작은 나무 간판: 벽 모서리에서 앞으로 뻗은 가로대와 나무 판(글씨 판은 ShopHangSign)
  if (look.hangSign) {
    b.add(box(0.6, 0.06, 0.06), xf([hw + 0.3, 1.92, front + 0.04]), '#6b4528', { outline: 0.03 })
    b.add(box(1.4, 0.38, 0.05), xf([hw + 0.3, 1.75, front + 0.05]), '#8a5a3b', { outline: 0.03 })
  }
  // 화분 줄: 건물 앞 땅에 화분 여섯 개와 꽃. 병합 배치라 드로우콜이 늘지 않는다.
  if (look.planters) {
    const pz = front + 0.8
    const colors = ['#ff8fa3', '#ffe066', '#ffffff', '#c77dff']
    for (const [j, x] of [-1.9, -1.2, -0.5, 0.2, 0.9, 1.6].entries()) {
      b.add(box(0.5, 0.3, 0.4), xf([x, 0.15, pz]), '#a8744a', { outline: 0.04 })
      b.add(sph(0.2, 10, 8), xf([x, 0.42, pz]), '#7fb36a', { outline: 0.05 })
      b.add(sph(0.11, 8, 6), xf([x - 0.08, 0.56, pz + 0.05]), colors[j % colors.length], { outline: 0.1 })
      b.add(sph(0.11, 8, 6), xf([x + 0.1, 0.52, pz - 0.06]), colors[(j + 1) % colors.length], { outline: 0.1 })
    }
  }
  b.add(sph(0.16, 12, 10), xf([0, roofY + 1.75, 0]), '#ffd166', { outline: 0.1 })
  b.add(box(0.4, 1, 0.4), xf([-w * 0.26, roofY + 1.15, -d * 0.15]), '#b9b2a6', { outline: 0.06 })
  b.add(box(0.52, 0.1, 0.52), xf([-w * 0.26, roofY + 1.69, -d * 0.15]), '#8f897f', { outline: 0.06 })
  // 문: 문틀, 문판, 손잡이. 위쪽 유리는 따로 그린다.
  b.add(box(1.2, dh, 0.08), xf([0, dh / 2 + 0.02, front + 0.03]), '#6b4528', { outline: 0.04 })
  b.add(box(1, dh - 0.2, 0.04), xf([0, dh / 2 - 0.02, front + 0.07]), '#8a5a3b', { outline: 0 })
  b.add(box(0.04, 0.5, 0.01), xf([0, dh * 0.74, front + 0.1]), '#6b4528', { unlit: true })
  b.add(sph(0.055, 8, 6), xf([0.36, dh * 0.45, front + 0.12]), '#ffd166', { cast: false })
  // 문패: 나무 판에 초록 줄
  const plate = xf([0, dh * 0.45, front + 0.12])
  b.add(box(0.42, 0.2, 0.03), plate, '#fdf6e3', { outline: 0.06 })
  b.add(box(0.3, 0.04, 0.005), mul(plate, xf([0, 0, 0.02])), '#5fa35f', { unlit: true })
  // 차양: 색 줄무늬 천과 물결 술. 노점은 차양 대신 천막 지붕을 얹는다.
  if (look.awning) {
    const n = Math.round(w)
    for (let k = 0; k < n; k++) {
      const x = -(n - 1) / 2 + k
      const c = k % 2 === 0 ? look.awning : '#fdf6e3'
      b.add(box(1, 0.08, 0.9), xf([x, wallH - 0.1, front + 0.35], [0.5, 0, 0]), c, { cast: false })
      b.add(cyl(0.5, 0.5, 0.08, 12, 1, false, Math.PI / 2, Math.PI), xf([x, wallH - 0.37, front + 0.78], [Math.PI / 2, 0, 0], [1, 1, 0.5]), c, { cast: false })
    }
  } else {
    b.add(cone(w * 0.62, 0.8, 4), xf([0, wallH + 0.45, front + 0.6], [0, Math.PI / 4, 0]), '#5fa35f', { outline: 0.03 })
    for (const sx of [-1, 1]) b.add(box(0.08, wallH, 0.08), xf([sx * (w * 0.42), 0.2 + wallH / 2, front + 0.6]), '#a8744a', { outline: 0.04 })
  }
  // 진열 창: 테두리, 창살, 창틀 아래 화단, 꽃
  const win = xf([winX, winY, front + 0.03])
  const wh = small ? 0.66 : 0.88
  b.add(box(winW, wh, 0.06), win, '#a8744a', { outline: 0.04 })
  for (const r of [0, Math.PI / 2]) b.add(box(r ? winW * 0.65 : winW * 0.83, 0.04, 0.01), mul(win, xf([0, 0, 0.045], [0, 0, r])), '#a8744a', { unlit: true })
  b.add(box(winW, 0.18, 0.24), mul(win, xf([0, -wh / 2 - 0.09, 0.12])), '#8a5a3b', { outline: 0.04 })
  for (const [j, fx] of [-0.35, -0.12, 0.12, 0.35].entries()) b.add(sph(0.08, 8, 6), mul(win, xf([fx * (winW / 1.08), -wh / 2 + 0.05 + (j % 2) * 0.05, 0.14])), ['#ff8fa3', '#ffe066', '#ffffff', '#ff8fa3'][j], { outline: 0.12 })
  // 간판 도토리: 나무 원판 위에 도토리. 노점은 작게 줄인다.
  const k = small ? 0.7 : 1
  const sign = xf([-Math.min(w * 0.34, hw - 0.45), wallH * 0.7, front + 0.06])
  b.add(cyl(0.55 * k, 0.55 * k, 0.06, 20), mul(sign, xf([0, 0, 0], [Math.PI / 2, 0, 0])), '#fdf6e3', { outline: 0.05 })
  const acorn = mul(sign, xf([0, -0.05 * k, 0.12]))
  b.add(sph(0.3 * k, 16, 12), mul(acorn, xf([0, 0, 0])), '#c07f45', { outline: 0.08 })
  b.add(sph(0.34 * k, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mul(acorn, xf([0, 0.2 * k, 0])), '#6b4528', { outline: 0.08 })
  b.add(cyl(0.03, 0.04, 0.12, 6), mul(acorn, xf([0, 0.48 * k, 0])), '#6b4528', { outline: 0.1 })
  // 문 옆 나무통 화분과 쌓인 상자
  const tub = xf([-Math.min(0.95, hw - 0.3), 0, front + 0.22])
  b.add(cyl(0.22, 0.18, 0.4, 12), mul(tub, xf([0, 0.2, 0])), '#a8744a', { outline: 0.05 })
  for (const by of [0.12, 0.3]) b.add(cyl(0.215 - by * 0.08, 0.215 - by * 0.08, 0.03, 12), mul(tub, xf([0, by, 0])), '#4a5160', { unlit: true })
  b.add(sph(0.24, 10, 8), mul(tub, xf([0, 0.55, 0])), SEASON_INFO[season].leaves[1], { outline: 0.06 })
  const crate = xf([hw - 0.3, 0, front + 0.25])
  b.add(box(0.44, 0.44, 0.44), mul(crate, xf([0, 0.22, 0])), '#d9a877', { outline: 0.05 })
  b.add(box(0.34, 0.32, 0.34), mul(crate, xf([0.05, 0.6, -0.02], [0, 0.3, 0])), '#d9a877', { outline: 0.05 })
  b.add(sph(0.09, 10, 8), mul(crate, xf([0.05, 0.84, -0.02])), '#ff9f43', { outline: 0.1 })
}

/** 공사 중 비계: 기둥 네 개와 가로대, 문 앞 공사 안내판. 건물 바깥에만 세워서 충돌은 그대로 둔다. */
function Scaffold({ look }: { look: BuildingLook }) {
  const h = look.h + 0.9
  const px = look.w / 2 + 0.45
  const pz = look.d / 2 + 0.45
  const pole = '#8a8f99'
  return (
    <group>
      {[-px, px].map((x) =>
        [-pz, pz].map((z) => (
          <mesh key={`${x}${z}`} position={[x, h / 2, z]} castShadow>
            <boxGeometry args={[0.1, h, 0.1]} />
            <Toon color={pole} />
          </mesh>
        )),
      )}
      {[0.7, h - 0.25].map((y) => (
        <group key={y}>
          <mesh position={[0, y, pz]}>
            <boxGeometry args={[px * 2, 0.08, 0.08]} />
            <Toon color={pole} />
          </mesh>
          <mesh position={[px, y, 0]}>
            <boxGeometry args={[0.08, 0.08, pz * 2]} />
            <Toon color={pole} />
          </mesh>
        </group>
      ))}
      {/* 천막: 공사 중 건물 앞면을 가리는 파란 천과 흰 줄무늬 두 줄 */}
      <group position={[0, look.h / 2 + 0.2, look.d / 2 + 0.14]}>
        <mesh>
          <boxGeometry args={[px * 2 - 0.2, look.h - 0.2, 0.04]} />
          <Toon color="#4f8fd1" />
        </mesh>
        {[-0.5, 0.5].map((k) => (
          <mesh key={k} position={[0, k * (look.h - 0.2) * 0.5, 0.03]}>
            <boxGeometry args={[px * 2 - 0.2, 0.12, 0.01]} />
            <Toon color="#fdf6e3" />
          </mesh>
        ))}
      </group>
      {/* 공사 안내판: 주황 판에 크림색 띠 두 줄 */}
      <group position={[-look.w / 2 + 0.25, 1.05, look.d / 2 + 0.9]} rotation-y={0.2}>
        <mesh>
          <boxGeometry args={[1.5, 0.75, 0.08]} />
          <Toon color="#f2a541" />
        </mesh>
        {[0.2, -0.2].map((y) => (
          <mesh key={y} position={[0, y, 0.05]}>
            <boxGeometry args={[1.3, 0.12, 0.02]} />
            <Toon color="#fdf6e3" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 금요일 반짝 할인 깃발. 상점 앞 기둥 끝에 빨간 천을 단다. */
function ShopFlag({ look }: { look: BuildingLook }) {
  return (
    <group position={[look.w / 2 + 0.7, 0, look.d / 2 + 0.7]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3.2, 8]} />
        <Toon color="#8a6a4a" />
      </mesh>
      <mesh position={[0.42, 2.7, 0]}>
        <boxGeometry args={[0.8, 0.5, 0.03]} />
        <Toon color="#e2412f" />
      </mesh>
      <mesh position={[0.42, 2.7, 0.02]}>
        <boxGeometry args={[0.8, 0.12, 0.01]} />
        <Toon color="#fdf6e3" />
      </mesh>
    </group>
  )
}

/** 문 위의 상호 간판 "도토리 상점". 단계마다 건물 앞면 크기에 맞춰 놓인다. */
function nameTexture() {
  const cv = document.createElement('canvas')
  cv.width = 320
  cv.height = 80
  const g = cv.getContext('2d')!
  g.fillStyle = '#fdf6e3'
  g.fillRect(0, 0, 320, 80)
  g.strokeStyle = '#6b4528'
  g.lineWidth = 6
  g.strokeRect(4, 4, 312, 72)
  g.fillStyle = '#6b4528'
  g.font = 'bold 44px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(SHOP_NAME, 160, 42)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function ShopNameBoard({ look }: { look: BuildingLook }) {
  const { front, dh } = shopDims(look)
  const tex = useMemo(nameTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  const w = Math.min(look.w * 0.7, 3.2)
  // 2층 건물(백화점)은 위층 바닥판과 보가 간판 글자 뒤를 가린다. 그래서 보 앞으로 조금 뺀다. 1·2단계는 그대로다.
  // 2층 건물은 글자 아랫단이 차양 윗단에 걸리지 않게 조금 더 올린다
  const two = look.floors === 2
  // 큰 가게(signFront)는 간판을 차양 앞쪽(차양 끝 밖)으로 뺀다. 차양 뒤에 있으면 윗단 글자가 가려진다. 다른 단계는 그대로다.
  const z = two ? front + 0.3 : look.signFront ? front + 0.95 : front + 0.07
  const y = dh + 0.7 + (two ? 0.12 : 0)
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[w, w * 0.25]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  )
}

/** 작은 나무 간판 "도토리 상점". 받침대 끝에 걸려 큰 간판(3.2 폭)보다 작다. 차양 아래 옆 모서리에 놓인다. */
function ShopHangSign({ look }: { look: BuildingLook }) {
  const { hw, front } = shopDims(look)
  const tex = useMemo(nameTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={[hw + 0.3, 1.75, front + 0.1]}>
      <planeGeometry args={[1.2, 0.3]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  )
}

/** 문과 창의 빛나는 유리. 재질이 달라 병합하지 않는다. */
/**
 * 상점 유리 한 장. 영업 중에는 밤에 등불색으로 켜지는 창(WindowPane)이고, 공사 중에는 불 꺼진 어두운 유리다.
 */
function ShopPane({ dark, position, children }: { dark: boolean; position: [number, number, number]; children: ReactNode }) {
  if (!dark) return <WindowPane position={position}>{children}</WindowPane>
  return (
    <mesh position={position}>
      {children}
      <Toon color="#33404f" />
    </mesh>
  )
}

/**
 * 단계마다 다른 밤 불빛. 노점은 등불 하나, 큰 가게는 간판 아래 조명, 백화점은 정면을 따라 줄 조명이다.
 * 가게(1단계)는 창 불빛(WindowPane)이 이미 켜지므로 따로 그리지 않는다. 한 덩어리 인스턴스라 밤에 draw call 이 한 번 늘 뿐이다.
 * 낮이나 공사 중(closed)엔 숨긴다. 가게 영업시간 규칙은 코드에 없어서, 켜짐은 낮·밤 정도(nightLevel)를 따른다.
 */
function nightLights(look: BuildingLook): { p: [number, number, number]; s: [number, number, number] }[] {
  const { front, dh } = shopDims(look)
  const tier = SHOP_TIERS.findIndex((t) => t.look.sign === look.sign)
  // 노점: 가판 높이(1.6 근처) 한쪽 끝에 지름 0.45 둥근 등 하나.
  if (tier === 0) return [{ p: [look.w / 2 - 0.25, 1.6, front + 0.3], s: [0.45, 0.45, 0.45] }]
  // 큰 가게: 간판 아래 얇은 조명 막대(타원체로 늘인다).
  if (tier === 2) {
    const w = Math.min(look.w * 0.7, 3.2)
    return [{ p: [0, dh + 0.7 - w * 0.125 - 0.1, front + 0.12], s: [Math.min(look.w * 0.6, 2.4), 0.07, 0.1] }]
  }
  // 백화점: 정면 위쪽 처마선을 따라 11개를 살짝 늘어뜨린다(catenary). 양 끝은 낮고 가운데가 처진다.
  if (tier === 3) {
    const N = 11
    const half = look.w / 2 - 0.5
    const sag = 0.12
    return Array.from({ length: N }, (_, i) => {
      const t = (i / (N - 1)) * 2 - 1
      return { p: [t * half, dh + 0.1 - sag * (1 - t * t), front + 0.12] as [number, number, number], s: [0.23, 0.23, 0.23] as [number, number, number] }
    })
  }
  return []
}

function ShopNight({ look, closed }: { look: BuildingLook; closed: boolean }) {
  const items = useMemo(() => nightLights(look), [look])
  const ref = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  // 창 불빛(WindowPane)과 같은 발광 세기(1 + 밤 × 0.8)로 맞춘다.
  const mat = useMemo(() => new THREE.MeshToonMaterial({ color: '#ffe3a3', emissive: '#ffc86e', gradientMap: gradient }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    items.forEach((it, i) => ref.current?.setMatrixAt(i, m.compose(new THREE.Vector3(...it.p), new THREE.Quaternion(), new THREE.Vector3(...it.s))))
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  useFrame(() => {
    const n = nightLevel()
    mat.emissiveIntensity = 1 + n * 1.0
    if (group.current) group.current.visible = !closed && n > 0.02
  })
  if (!items.length) return null
  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={ref} args={[undefined, undefined, items.length]} material={mat}>
        <sphereGeometry args={[0.5, 10, 8]} />
      </instancedMesh>
    </group>
  )
}

function ShopGlass({ look, closed }: { look: BuildingLook; closed: boolean }) {
  const { front, dh, winX, winY, winW, small } = shopDims(look)
  const wh = small ? 0.66 : 0.88
  return (
    <>
      {/* 상점 유리: 영업 중에는 밤에 등불색으로 켜지고, 공사 중(shop 공사 상태)에는 불이 꺼진 어두운 유리다 */}
      <ShopPane dark={closed} position={[0, dh * 0.74, front + 0.095]}>
        <boxGeometry args={[0.66, 0.5, 0.01]} />
      </ShopPane>
      <group position={[winX, winY, front + 0.03]}>
        <ShopPane dark={closed} position={[0, 0, 0.035]}>
          <boxGeometry args={[winW * 0.82, wh * 0.8, 0.01]} />
        </ShopPane>
        <mesh position={[-winW * 0.2, wh * 0.19, 0.05]}>
          <circleGeometry args={[0.07, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      </group>
    </>
  )
}

/**
 * 한 단계의 상점 몸체. 단계가 바뀌면 키가 바뀌어 새로 짓는다(병합 형상과 가림 반경을 다시 맞춘다).
 */
function ShopBody({ look, closed, flash }: { look: BuildingLook; closed: boolean; flash: boolean }) {
  // 처마 네 모서리. 비 오는 날 여기서 빗방울이 떨어진다(건물 그룹 기준, 땅이 y=0).
  const eaves = useMemo<[number, number, number][]>(() => {
    const { roofY } = shopDims(look)
    const hx = look.w / 2 + 0.1
    const hz = look.d / 2 + 0.1
    return [[-hx, roofY, -hz], [hx, roofY, -hz], [-hx, roofY, hz], [hx, roofY, hz]]
  }, [look])
  const y = heightAt(SHOP.x, SHOP.z)
  const ref = useRef<THREE.Group>(null)
  const center = useMemo(() => [SHOP.x, y + look.h / 2 + 0.6, SHOP.z] as const, [y, look])
  // 상점 뒤로 돌아가면 상점이 반투명해져 플레이어가 보인다.
  useOcclusionFade(ref, center, Math.max(look.w, look.d) / 2 + 0.3, 0.18)
  const mats = useOwnMaterials()
  const season = useSeason()
  const g = useMerged((b) => buildShop(b, look, season), [look, season])
  // 공사 표지판·점원과 재개장 리본은 상점 바깥 좌표를 쓰므로 건물 그룹 밖에 둔다
  return (
    <>
      <group ref={ref} position={[SHOP.x, y, SHOP.z]}>
        <Merge g={g} lit={mats.lit} basic={mats.basic} />
        <ShopGlass look={look} closed={closed} />
        <ShopNight look={look} closed={closed} />
        <ShopNameBoard look={look} />
        {look.hangSign && <ShopHangSign look={look} />}
        <EaveDrips points={eaves} />
        {closed && <Scaffold look={look} />}
        {flash && !closed && <ShopFlag look={look} />}
      </group>
      {closed && <ShopSiteSign />}
      {closed && <ShopWorker />}
      <ShopReopenCeremony />
    </>
  )
}

/** 지금 단계의 상점. 공사 중이면 옛 건물에 비계를 씌운다. 저장된 단계와 날짜로 정해진다. */
export function Shop() {
  const shop = useGame((s) => s.shop)
  const day = useGame((s) => s.day)
  const st = upgradeState(shop, day)
  return <ShopBody key={st.tier} look={lookFor(st.tier)} closed={st.status === 'closed'} flash={isFlashDay(day)} />
}

/**
 * 바닥 물건. 막 튀어나온 것은 출발점에서 포물선을 그리며 날아와 착지한 뒤 통통 두 번 튀고,
 * 그 다음부터는 둥실 떠서 돈다.
 */
function Pickup({ id, itemId, x, z, shell }: { id: string; itemId: string; x: number; z: number; shell: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const base = heightAt(x, z) + 0.2
  const seed = id.length + x
  const halo = useRef<THREE.Sprite>(null)
  // 반짝이는 조약돌은 낮에도 옅은 푸른 빛을 두르고 더 자주 번쩍인다(비 오는 어두운 낮에도 찾기 쉽게)
  const pebble = itemId === RAIN_STONE_ID
  const glow = useMemo(() => glowMaterial(pebble ? '#bfe9ff' : '#fff6d8'), [pebble])
  // 조개의 반짝임: 낮에도 주기마다 한 번 짧게 번쩍인다(각자 다른 박자)
  const spark = useRef<THREE.Sprite>(null)
  const sparkMat = useMemo(() => glowMaterial('#ffffff'), [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g || !halo.current) return
    const t = clock.elapsedTime + seed
    if (shell && spark.current) {
      const rate = pebble ? 0.9 : 0.45
      const win = pebble ? 0.16 : 0.1
      const k = (t * rate) % 1
      const flash = k < win ? Math.sin((k / win) * Math.PI) : 0
      sparkMat.opacity = flash * (pebble ? 1 : 0.9)
      spark.current.scale.setScalar((pebble ? 0.22 : 0.18) + flash * (pebble ? 0.4 : 0.3))
    }
    // 밤엔 옅은 빛 테두리를 둘러 땅 위에 떨어진 물건을 찾기 쉽게 한다. 낮엔 안 보인다.
    const night = nightLevel()
    halo.current.visible = pebble || night > 0.02
    halo.current.scale.setScalar(0.85 + Math.sin(t * 2.2) * 0.08)
    glow.opacity = pebble ? 0.25 + night * 0.45 : night * 0.55
    const fx = runtime.drops[id]
    if (fx) {
      const k = (now() - fx.t0) / DROP_TIME
      if (k >= 1) delete runtime.drops[id]
      else {
        const FLIGHT = 0.6
        if (k < FLIGHT) {
          const f = k / FLIGHT
          const [ox, oy, oz] = fx.from
          g.position.set(ox + (x - ox) * f, oy + (base - oy) * f + Math.sin(f * Math.PI) * fx.arc, oz + (z - oz) * f)
          g.rotation.set(f * 6, f * 4, 0)
          g.scale.setScalar(0.6 + f * 0.4)
        } else {
          // 착지: 두 번 통통 튀며 눌렸다 펴진다.
          const b = (k - FLIGHT) / (1 - FLIGHT)
          const bounce = Math.abs(Math.sin(b * Math.PI * 2)) * 0.28 * (1 - b)
          const squash = 1 - Math.max(0, 0.25 - bounce) * (1 - b)
          g.position.set(x, base + bounce, z)
          g.rotation.set(0, b * 2, 0)
          g.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
        }
        return
      }
    }
    g.scale.setScalar(1)
    // 물가에 떠밀려 온 병과 소포는 물결에 몸을 맡긴 듯 천천히 흔들린다
    const drift = itemId === 'bottle' || itemId === 'parcel'
    g.rotation.set(drift ? Math.sin(t * 1.3) * 0.2 : 0, t * (drift ? 0.25 : 0.8), drift ? Math.sin(t * 1.7) * 0.14 : 0)
    g.position.set(x, base + Math.sin(t * (drift ? 1.6 : 2.4)) * (drift ? 0.1 : 0.06), z)
  })
  return (
    <group ref={ref} position={[x, base, z]}>
      <ItemModel id={itemId} />
      <sprite ref={halo} position={[0, 0.25, 0]} material={glow} visible={false} />
      {shell && <sprite ref={spark} position={[0.12, 0.3, 0.05]} material={sparkMat} />}
    </group>
  )
}

/** 바닥에 떨어진 것과 그날 해변의 조개. 둥실 떠서 돌며 주울 수 있다는 걸 보여준다. */
export function Pickups() {
  const day = useGame((s) => s.day)
  const collected = useGame((s) => s.collected)
  const ground = useGame((s) => s.ground)
  const shells = getLayout(day).shells.filter((s) => !collected.includes(s.id))
  const items = [...shells.map((s) => ({ id: s.id, itemId: s.itemId, x: s.x, z: s.z, shell: true })), ...ground.map((g) => ({ ...g, shell: false }))]
  return (
    <>
      {items.map((it) => (
        <Pickup key={it.id} {...it} />
      ))}
    </>
  )
}
