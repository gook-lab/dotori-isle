import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { VILLAGERS, type Villager } from '../core/villagers'
import { now, runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { Batch, Merge, mul, shape, useMerged, xf } from './batching'
import { Part, Toon } from './toon'
import { hasPlot } from '../game/actions'
import { useOcclusionFade } from './occlusion'
import { WindowPane } from './WindowPane'
import { useSeason } from './Island'

const POP_TIME = 1.1

/** 주민 색을 지붕에 쓴 작은 집. 막 지었으면 땅에서 퐁 솟아 통통 튄다. */
function House({ v }: { v: Villager }) {
  const ref = useRef<THREE.Group>(null)
  const smoke = useRef<THREE.Group>(null)
  // 증축을 끝낸 집에는 현관 위에 작은 차양이 달린다
  const expanded = useGame((s) => !!s.expanded?.includes(v.id))
  // 집 뒤로 돌아가면 집이 반투명해져 플레이어가 보인다.
  const center = useMemo(() => [v.house.x, heightAt(v.house.x, v.house.z) + 1.3, v.house.z] as const, [v])
  useOcclusionFade(ref, center, 2, 0.18)
  const season = useSeason()
  useFrame(({ clock }) => {
    const born = runtime.builtAt[v.id]
    if (ref.current) {
      const k = born === undefined ? 1 : Math.min(1, (now() - born) / POP_TIME)
      // 오버슈트가 있는 탄성 곡선으로 쑥 커졌다가 제자리
      const s = k >= 1 ? 1 : 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5)
      ref.current.scale.set(1 + (1 - s) * 0.3, s, 1 + (1 - s) * 0.3)
    }
    if (smoke.current) {
      const t = clock.elapsedTime
      smoke.current.children.forEach((c, i) => {
        const k = (t * 0.35 + i / 3) % 1
        c.position.set(Math.sin(k * 6 + i) * 0.1, k * 1.1, 0)
        c.scale.setScalar(0.08 + k * 0.16)
      })
    }
  })
  const { x, z, rot } = v.house
  return (
    <group position={[x, heightAt(x, z), z]} rotation-y={rot}>
      <group ref={ref}>
        {/* 돌 기초 위에 판자 벽. 가로 줄눈이 판자 이음새다. */}
        <Part color="#cfc6b8" position={[0, 0.09, 0]} outline={0.03}>
          <boxGeometry args={[2.74, 0.18, 2.54]} />
        </Part>
        <Part color="#fff4e2" position={[0, 0.99, 0]} outline={0.025}>
          <boxGeometry args={[2.6, 1.62, 2.4]} />
        </Part>
        {[0.5, 0.86, 1.22, 1.58].map((y) => (
          <group key={y}>
            <mesh position={[0, y, 1.203]}>
              <boxGeometry args={[2.6, 0.018, 0.01]} />
              <meshBasicMaterial color="#e6d6bd" />
            </mesh>
            {[-1.303, 1.303].map((sx) => (
              <mesh key={sx} position={[sx, y, 0]}>
                <boxGeometry args={[0.01, 0.018, 2.4]} />
                <meshBasicMaterial color="#e6d6bd" />
              </mesh>
            ))}
          </group>
        ))}
        {/* 모서리 기둥 */}
        {[-1.3, 1.3].flatMap((cx) =>
          [-1.2, 1.2].map((cz) => (
            <Part key={`${cx}${cz}`} color="#c98b55" position={[cx, 0.99, cz]} outline={0.05}>
              <boxGeometry args={[0.14, 1.62, 0.14]} />
            </Part>
          )),
        )}
        {/* 처마 띠와 지붕. 지붕 위에 기와 줄과 꼭대기 장식을 얹는다. */}
        <Part color="#c98b55" position={[0, 1.86, 0]} outline={0.03}>
          <boxGeometry args={[2.86, 0.14, 2.66]} />
        </Part>
        <Part color={v.accent} position={[0, 2.5, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.92]} outline={0.03}>
          <coneGeometry args={[2.3, 1.3, 4]} />
        </Part>
        {season === 'winter' && (
          <mesh position={[0, 2.5 + 0.65 - 0.15, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.02, 1, 0.94]}>
            <coneGeometry args={[(2.3 * 0.3) / 1.3, 0.3, 4]} />
            <Toon color="#f7fbff" />
          </mesh>
        )}
        {[0.32, 0.62].map((k) => (
          <mesh key={k} position={[0, 1.85 + 0.15 + k * 1.3, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.92]}>
            <cylinderGeometry args={[2.3 * (1 - k) + 0.02, 2.3 * (1 - k) + 0.02, 0.035, 4, 1, true]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
          </mesh>
        ))}
        <Part color="#ffd166" position={[0, 3.22, 0]} outline={0.1}>
          <sphereGeometry args={[0.12, 12, 10]} />
        </Part>
        {/* 증축한 집: 문 바로 위에 앞으로 나온 줄무늬 천막과 양옆 기둥. 기존 현관 차양 앞에 얹혀 따로 보인다. */}
        {expanded && (
          <>
            <group position={[0, 1.5, 1.85]} rotation={[0.25, 0, 0]}>
              {[-0.56, -0.19, 0.19, 0.56].map((sx, i) => (
                <Part key={sx} color={i % 2 ? '#fffaf0' : v.accent} position={[sx, 0, 0]} outline={0.03}>
                  <boxGeometry args={[0.36, 0.05, 0.7]} />
                </Part>
              ))}
            </group>
            {[-0.72, 0.72].map((px) => (
              <Part key={px} color="#8a5a3b" position={[px, 0.7, 2.15]} outline={0.03}>
                <boxGeometry args={[0.07, 1.4, 0.07]} />
              </Part>
            ))}
          </>
        )}
        {/* 벽돌 굴뚝과 테 */}
        <Part color="#c98b55" position={[0.8, 2.7, -0.3]} outline={0.08}>
          <boxGeometry args={[0.32, 0.8, 0.32]} />
        </Part>
        <Part color="#a8744a" position={[0.8, 3.12, -0.3]} outline={0.08}>
          <boxGeometry args={[0.42, 0.1, 0.42]} />
        </Part>
        {/* 아치형 문: 문틀, 세로 판자, 작은 창, 손잡이, 위에 작은 차양 */}
        <Part color="#8a5a3b" position={[0, 0.66, 1.2]} scale={[1, 1, 0.22]} outline={0.05}>
          <capsuleGeometry args={[0.38, 0.52, 4, 12]} />
        </Part>
        <Part color="#a8744a" position={[0, 0.64, 1.25]} scale={[1, 1, 0.22]} outline={0}>
          <capsuleGeometry args={[0.31, 0.5, 4, 12]} />
        </Part>
        {[-0.12, 0.12].map((dx) => (
          <mesh key={dx} position={[dx, 0.6, 1.32]}>
            <boxGeometry args={[0.015, 0.8, 0.01]} />
            <meshBasicMaterial color="#7a4e30" />
          </mesh>
        ))}
        <WindowPane position={[0, 0.98, 1.322]}><circleGeometry args={[0.1, 14]} /></WindowPane>
        <mesh position={[0.19, 0.58, 1.34]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <Toon color="#ffd166" />
        </mesh>
        <Part color={v.accent} position={[0, 1.52, 1.4]} rotation={[0.45, 0, 0]} outline={0.05}>
          <boxGeometry args={[1.0, 0.06, 0.42]} />
        </Part>
        {[-0.42, 0.42].map((bx) => (
          <Part key={bx} color="#c98b55" position={[bx, 1.38, 1.36]} rotation={[-0.6, 0, 0]} outline={0.1}>
            <boxGeometry args={[0.05, 0.05, 0.3]} />
          </Part>
        ))}
        {/* 십자 창살 동그란 창과 창 밑 꽃상자 */}
        {[-0.85, 0.85].map((wx, i) => (
          <group key={wx} position={[wx, 1.18, 1.21]}>
            <mesh position={[0, 0, -0.005]}>
              <circleGeometry args={[0.3, 18]} />
              <Toon color={v.accent} />
            </mesh>
            <WindowPane position={[0, 0, 0.005]}><circleGeometry args={[0.24, 18]} /></WindowPane>
            <mesh position={[0.08, 0.08, 0.008]}>
              <circleGeometry args={[0.06, 10]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
            </mesh>
            {[0, Math.PI / 2].map((r) => (
              <mesh key={r} position={[0, 0, 0.012]} rotation-z={r}>
                <boxGeometry args={[0.48, 0.03, 0.01]} />
                <meshBasicMaterial color="#fff4e2" />
              </mesh>
            ))}
            <Part color="#a8744a" position={[0, -0.4, 0.1]} outline={0.05}>
              <boxGeometry args={[0.62, 0.16, 0.2]} />
            </Part>
            {[-0.2, 0, 0.2].map((fx, j) => (
              <Part key={fx} color={['#ff8fa3', '#ffe066', '#ffffff', '#b8c0ff'][(i + j) % 4]} position={[fx, -0.27 + (j % 2) * 0.04, 0.12]} outline={0.12}>
                <sphereGeometry args={[0.07, 8, 6]} />
              </Part>
            ))}
          </group>
        ))}
        {/* 문 앞 디딤돌 */}
        <Part color="#d9c7a8" position={[0, 0.06, 1.48]} outline={0.05}>
          <boxGeometry args={[0.95, 0.12, 0.36]} />
        </Part>
        {[0.25, -0.2].map((sx, i) => (
          <mesh key={i} position={[sx, 0.02, 1.95 + i * 0.45]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.2 - i * 0.03, 10]} />
            <Toon color="#cfc6b8" />
          </mesh>
        ))}
        <group ref={smoke} position={[0.8, 3.2, -0.3]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

const PLOT_CORNERS: [number, number][] = [
  [-1.3, -1.3],
  [1.3, -1.3],
  [1.3, 1.3],
  [-1.3, 1.3],
]

/** 빈 집터 한 곳의 본체(흙바닥·말뚝·울타리·문기둥·문패)를 집터 위치와 방향에 맞춰 묶음에 넣는다. */
function addPlot(b: Batch, v: Villager) {
  const { x, z, rot } = v.house
  const place = xf([x, heightAt(x, z), z], [0, rot, 0])
  b.add(shape(THREE.PlaneGeometry, 2.8, 2.8), mul(place, xf([0, 0.02, 0], [-Math.PI / 2, 0, 0])), '#c9a27a', { cast: false })
  for (const [cx, cz] of PLOT_CORNERS) b.add(shape(THREE.CylinderGeometry, 0.05, 0.06, 0.5, 6), mul(place, xf([cx, 0.25, cz])), '#a8744a', { outline: 0.1 })
  PLOT_CORNERS.forEach(([cx, cz], i) => {
    const [nx, nz] = PLOT_CORNERS[(i + 1) % 4]
    const len = Math.hypot(nx - cx, nz - cz)
    b.add(shape(THREE.BoxGeometry, 0.02, 0.02, len), mul(place, xf([(cx + nx) / 2, 0.4, (cz + nz) / 2], [0, Math.atan2(nx - cx, nz - cz), 0])), '#f6e7c8', { unlit: true })
  })
  b.add(shape(THREE.CylinderGeometry, 0.05, 0.05, 1, 6), mul(place, xf([0, 0.5, 1.5])), '#a8744a', { outline: 0.1 })
  b.add(shape(THREE.BoxGeometry, 0.7, 0.42, 0.06), mul(place, xf([0, 0.95, 1.52])), v.newcomer ? '#f6e7c8' : v.accent, { outline: 0.06 })
}

/** 빈 집터 본체 전부를 재질별 몇 덩어리로 굳힌다. 집터 목록이 바뀔 때만 다시 굳힌다. 간판은 PlotSign 이 따로 뜬다. */
function PlotBodies({ plots }: { plots: Villager[] }) {
  const key = plots.map((v) => `${v.id}:${v.newcomer ? 1 : 0}:${v.accent}:${v.house.x},${v.house.z},${v.house.rot}`).join('|')
  const g = useMerged((b) => plots.forEach((v) => addPlot(b, v)), [key])
  return <Merge g={g} />
}

/** 빈 집터의 간판. 위아래로 떠서 본체 묶음과 따로 둔다. */
function PlotSign({ v }: { v: Villager }) {
  const sign = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (sign.current) sign.current.position.y = 1.15 + Math.sin(clock.elapsedTime * 2 + v.seed) * 0.06
  })
  const { x, z, rot } = v.house
  return (
    <group position={[x, heightAt(x, z), z]} rotation-y={rot}>
      <group ref={sign} position={[0, 1.15, 1.5]}>
        <Part color={v.newcomer ? '#ffd166' : '#ff8fa3'} position={[0, 0.25, 0]} outline={0.1}>
          {v.newcomer ? <octahedronGeometry args={[0.13, 0]} /> : <sphereGeometry args={[0.12, 10, 8]} />}
        </Part>
      </group>
    </group>
  )
}

export function Houses() {
  const houses = useGame((s) => s.houses)
  const recruits = useGame((s) => s.recruits)
  const plots = VILLAGERS.filter((v) => !houses.includes(v.id) && hasPlot(v, recruits))
  return (
    <>
      {VILLAGERS.filter((v) => houses.includes(v.id)).map((v) => (
        <House key={v.id} v={v} />
      ))}
      <PlotBodies plots={plots} />
      {plots.map((v) => (
        <PlotSign key={v.id} v={v} />
      ))}
    </>
  )
}
