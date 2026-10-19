import { useRef } from 'react'
import * as THREE from 'three'
import { heightAt } from '../core/island'
import { GIFT_PROJECTS, GIFT_PROJECTS_2, type IslandGiftState, NEW_ISLAND_GIFT } from '../core/islandGift'
import { useGame } from '../game/store'
import { Part, Toon } from './toon'
import { useOutdoorFrame } from './outdoorFrame'

/**
 * 완성된 섬 공공시설을 정해진 자리에 세운다. 시설 수는 기부 진행(islandGift.built)을 따른다.
 * 빛은 점광원 없이 발광 재질로만 낸다(물 반짝임, 등대 회전 빛줄기).
 */
export function IslandGifts() {
  const gift: IslandGiftState = useGame((s) => s.islandGift) ?? NEW_ISLAND_GIFT
  const acorn: IslandGiftState = useGame((s) => s.islandAcorn) ?? NEW_ISLAND_GIFT
  const night = useGame((s) => s.night)
  return (
    <>
      {GIFT_PROJECTS.slice(0, gift.built).map((p) => (
        <group key={p.id} position={[p.anchor.x, heightAt(p.anchor.x, p.anchor.z), p.anchor.z]}>
          {p.id === 'flower-bench' && <Bench />}
          {p.id === 'plaza-fountain' && <Fountain />}
          {p.id === 'pebble-bridge' && <Pebbles />}
          {p.id === 'lighthouse-glow' && <Lighthouse night={night} />}
        </group>
      ))}
      {GIFT_PROJECTS_2.slice(0, acorn.built).map((p) => (
        <group key={p.id} position={[p.anchor.x, heightAt(p.anchor.x, p.anchor.z), p.anchor.z]}>
          {p.id === 'lighthouse-lamps' && <LampLine night={night} />}
          {p.id === 'beach-parasol' && <Parasol />}
          {p.id === 'hill-pavilion' && <Pavilion />}
          {p.id === 'plaza-clock' && <ClockTower night={night} />}
        </group>
      ))}
    </>
  )
}

/** 등대 산책로 가로등 줄의 등 위치(자리 기준 x 오프셋). 바닥 빛 웅덩이(OutdoorLampPool)도 같은 자리를 쓴다. */
export const LAMP_LINE_X = [-2.4, -0.8, 0.8, 2.4]

/** 등대 산책로 가로등: 돌기둥 네 개와 가로등 등불. 밤에는 등불이 켜진다(발광 재질). */
function LampLine({ night }: { night: boolean }) {
  return (
    <>
      {LAMP_LINE_X.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Part color="#7d7466" position={[0, 0.7, 0]} outline={0.04}>
            <cylinderGeometry args={[0.1, 0.13, 1.4, 10]} />
          </Part>
          <Part color="#4a4036" position={[0, 1.5, 0]} outline={0.04}>
            <boxGeometry args={[0.36, 0.1, 0.36]} />
          </Part>
          <mesh position={[0, 1.7, 0]}>
            <boxGeometry args={[0.26, 0.3, 0.26]} />
            <Toon color="#ffe9a8" emissive={night ? '#ffd76a' : '#000000'} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** 해변 파라솔: 가운데 기둥, 줄무늬 차양 두 겹, 그 아래 선베드 두 개 */
function Parasol() {
  return (
    <>
      <Part color="#f5f1e8" position={[0, 1.1, 0]} outline={0.04}>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
      </Part>
      <Part color="#e8554e" position={[0, 2.25, 0]} outline={0.05}>
        <coneGeometry args={[1.5, 0.55, 12]} />
      </Part>
      <Part color="#fff8ea" position={[0, 2.1, 0]} outline={0.05}>
        <coneGeometry args={[1.52, 0.2, 12]} />
      </Part>
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x * 0.6, 0, 0.9]}>
          <Part color="#e9d7b5" position={[0, 0.42, 0]} outline={0.03}>
            <boxGeometry args={[0.7, 0.1, 1.5]} />
          </Part>
          <Part color="#c9b18a" position={[0, 0.2, 0.62]} outline={0.02}>
            <boxGeometry args={[0.7, 0.4, 0.14]} />
          </Part>
        </group>
      ))}
    </>
  )
}

/** 서쪽 언덕 전망 정자: 기둥 네 개, 팔각 지붕, 가운데 나무 벤치 */
function Pavilion() {
  return (
    <>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Part key={`${sx}${sz}`} color="#b07a4a" position={[sx * 0.9, 1.1, sz * 0.9]} outline={0.04}>
            <cylinderGeometry args={[0.1, 0.11, 2.2, 8]} />
          </Part>
        )),
      )}
      <Part color="#8f5f3a" position={[0, 2.35, 0]} outline={0.05}>
        <cylinderGeometry args={[1.5, 1.5, 0.12, 8]} />
      </Part>
      <Part color="#c8553d" position={[0, 3.05, 0]} outline={0.05}>
        <coneGeometry args={[1.8, 1.3, 8]} />
      </Part>
      <Part color="#d9b98a" position={[0, 0.5, 0]} outline={0.03}>
        <boxGeometry args={[1.6, 0.1, 0.5]} />
      </Part>
    </>
  )
}

/** 광장 시계탑: 사각 탑, 시계판(시침·분침), 뾰족 지붕. 밤에는 시계판이 켜진다. */
function ClockTower({ night }: { night: boolean }) {
  return (
    <>
      <Part color="#e9e2d0" position={[0, 1.6, 0]} outline={0.05}>
        <boxGeometry args={[1.2, 3.2, 1.2]} />
      </Part>
      <Part color="#c9bfa8" position={[0, 3.3, 0]} outline={0.05}>
        <boxGeometry args={[1.4, 0.2, 1.4]} />
      </Part>
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[0, 2.5, 0.61]}>
            <circleGeometry args={[0.36, 16]} />
            <Toon color="#fff8ea" emissive={night ? '#ffe9a8' : '#000000'} />
          </mesh>
        </group>
      ))}
      <Part color="#6b4a2e" position={[0, 3.9, 0]} outline={0.05}>
        <coneGeometry args={[0.95, 1.0, 4]} />
      </Part>
      <Part color="#d9b98a" position={[0, 4.6, 0]} outline={0.03}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
      </Part>
    </>
  )
}

/** 꽃길 벤치: 긴 나무 의자 양옆에 꽃 화분 한 개씩 */
function Bench() {
  const pot = (x: number, color: string) => (
    <group position={[x, 0, 0]}>
      <Part color="#b5673d" position={[0, 0.22, 0]} outline={0.05}>
        <cylinderGeometry args={[0.26, 0.2, 0.44, 14]} />
      </Part>
      {[
        [-0.12, 0.6, 0.08],
        [0.1, 0.66, -0.06],
        [0.02, 0.72, 0.12],
      ].map(([fx, fy, fz], i) => (
        <Part key={i} color={i === 1 ? '#fff1a8' : color} position={[fx, fy, fz]} outline={0.02}>
          <sphereGeometry args={[0.13, 8, 6]} />
        </Part>
      ))}
    </group>
  )
  return (
    <>
      {/* 좌판과 등받이 */}
      <Part color="#b07a4a" position={[0, 0.62, 0]} outline={0.05}>
        <boxGeometry args={[2.4, 0.16, 0.7]} />
      </Part>
      <Part color="#b07a4a" position={[0, 1.02, -0.32]} outline={0.05}>
        <boxGeometry args={[2.4, 0.56, 0.1]} />
      </Part>
      {/* 다리 네 개 */}
      {[-1, 1].map((sx) =>
        [-0.26, 0.26].map((sz) => (
          <Part key={`${sx}${sz}`} color="#7a4f2c" position={[sx * 1.02, 0.3, sz]} outline={0.03}>
            <boxGeometry args={[0.14, 0.6, 0.14]} />
          </Part>
        )),
      )}
      {pot(-1.6, '#e8738a')}
      {pot(1.6, '#f2a0c0')}
    </>
  )
}

/** 광장 물분수: 넓은 돌 받침, 물웅덩이(반짝임), 가운데 기둥과 떨어지는 물방울 */
function Fountain() {
  const water = useRef<THREE.MeshToonMaterial>(null)
  const drops = useRef<THREE.Group>(null)
  const base = new THREE.Color('#9fd3e6')
  const shine = new THREE.Color('#e6fbff')
  useOutdoorFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (water.current) water.current.emissive.copy(base).lerp(shine, 0.25 + 0.2 * Math.sin(t * 2.4))
    if (drops.current)
      drops.current.children.forEach((d, i) => {
        const k = (t * 0.6 + i / 3) % 1
        d.position.set(Math.cos(i * 2.1) * 0.4, 1.0 + 0.5 * Math.sin(k * Math.PI) - 0.1, Math.sin(i * 2.1) * 0.4)
      })
  })
  return (
    <>
      <Part color="#c9c2b5" position={[0, 0.2, 0]} outline={0.06}>
        <cylinderGeometry args={[1.5, 1.7, 0.4, 24]} />
      </Part>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.08, 24]} />
        <Toon color="#9fd3e6" />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.02, 24]} />
        <meshToonMaterial ref={water} color="#9fd3e6" emissive="#9fd3e6" />
      </mesh>
      <Part color="#c9c2b5" position={[0, 0.9, 0]} outline={0.05}>
        <cylinderGeometry args={[0.18, 0.26, 1.0, 14]} />
      </Part>
      <Part color="#d8d0c2" position={[0, 1.42, 0]} outline={0.04}>
        <cylinderGeometry args={[0.6, 0.4, 0.14, 18]} />
      </Part>
      <group ref={drops}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshBasicMaterial color="#d6f3ff" />
          </mesh>
        ))}
      </group>
    </>
  )
}

/** 조약돌 징검다리: 크기와 높이가 조금씩 다른 돌 여섯 개를 엇갈려 놓고, 돌 사이에 작은 꽃을 피운다 */
function Pebbles() {
  const stones = [
    { x: -2.2, z: -0.25, w: 0.8, d: 0.7, h: 0.18, y: 0.09, c: '#c4bba9' },
    { x: -1.3, z: 0.25, w: 0.66, d: 0.6, h: 0.22, y: 0.11, c: '#d9d2c4' },
    { x: -0.4, z: -0.2, w: 0.9, d: 0.78, h: 0.14, y: 0.07, c: '#cbc2b0' },
    { x: 0.5, z: 0.3, w: 0.72, d: 0.62, h: 0.24, y: 0.12, c: '#d6cdbd' },
    { x: 1.4, z: -0.1, w: 0.84, d: 0.7, h: 0.17, y: 0.085, c: '#bfb6a4' },
    { x: 2.3, z: 0.2, w: 0.7, d: 0.66, h: 0.2, y: 0.1, c: '#d9d2c4' },
  ]
  // 돌 사이 빈 땅에 꽃 한 송이씩: 줄기와 꽃잎 다섯, 가운데 노란 점
  const flowers = [
    { x: -1.75, z: -0.55, c: '#ff8fb1' },
    { x: -0.85, z: 0.55, c: '#ffd166' },
    { x: 0.05, z: -0.6, c: '#c9a7ff' },
    { x: 0.95, z: 0.6, c: '#ff8fb1' },
    { x: 1.85, z: -0.55, c: '#ffd166' },
  ]
  return (
    <>
      {stones.map((st, i) => (
        <Part key={i} color={st.c} position={[st.x, st.y, st.z]} outline={0.04}>
          <boxGeometry args={[st.w, st.h, st.d]} />
        </Part>
      ))}
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <Part color="#6fbf6a" position={[0, 0.19, 0]} outline={0.03}>
            <cylinderGeometry args={[0.02, 0.026, 0.38, 5]} />
          </Part>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.cos((k / 5) * Math.PI * 2) * 0.11, 0.4, Math.sin((k / 5) * Math.PI * 2) * 0.11]}>
              <sphereGeometry args={[0.09, 6, 5]} />
              <meshBasicMaterial color={f.c} />
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.055, 6, 5]} />
            <meshBasicMaterial color="#fff1a8" />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** 등대: 빨강·흰 띠 탑, 유리 등실, 밤에 도는 빛줄기(발광 재질, 점광원 없음) */
function Lighthouse({ night }: { night: boolean }) {
  const beam = useRef<THREE.Group>(null)
  useOutdoorFrame(({ clock }) => {
    if (beam.current) beam.current.rotation.y = clock.elapsedTime * 0.9
  })
  return (
    <>
      <Part color="#f5f1e8" position={[0, 0.5, 0]} outline={0.05}>
        <cylinderGeometry args={[0.7, 0.9, 1.0, 18]} />
      </Part>
      <Part color="#d9584a" position={[0, 1.6, 0]} outline={0.05}>
        <cylinderGeometry args={[0.52, 0.66, 0.6, 18]} />
      </Part>
      <Part color="#f5f1e8" position={[0, 2.3, 0]} outline={0.05}>
        <cylinderGeometry args={[0.44, 0.52, 0.6, 18]} />
      </Part>
      <Part color="#d9584a" position={[0, 3.0, 0]} outline={0.05}>
        <cylinderGeometry args={[0.38, 0.44, 0.6, 18]} />
      </Part>
      <mesh position={[0, 3.45, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.5, 14]} />
        <Toon color="#ffe9a8" emissive={night ? '#ffd76a' : '#000000'} />
      </mesh>
      <Part color="#6b4a2e" position={[0, 3.8, 0]} outline={0.04}>
        <coneGeometry args={[0.55, 0.5, 14]} />
      </Part>
      {/* 밤의 빛줄기: 등실 높이에서 한쪽으로 뻗는 얇은 삼각 판 두 장을 돌린다 */}
      {night && (
        <group ref={beam} position={[0, 3.45, 0]}>
          {[0, Math.PI].map((a) => (
            <group key={a} rotation={[0, a, 0]}>
              <mesh position={[3.5, 0, 0]}>
                <planeGeometry args={[7, 0.8]} />
                <meshBasicMaterial color="#fff2b0" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </>
  )
}
