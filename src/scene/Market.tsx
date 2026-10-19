import { useRef } from 'react'
import { heightAt } from '../core/island'
import { isMarketDay, MARKET_SITE } from '../core/market'
import { useGame } from '../game/store'
import { Chibi, type Look, type Motion } from './Chibi'
import { Part } from './toon'

/** 토요일 장터 가판대. 장날에만 세우고, 다음 날 아침이면 걷힌다. 줄무늬 차양과 나무 좌판이다. */
export function MarketStall() {
  const day = useGame((s) => s.day)
  if (!MARKET_SITE || !isMarketDay(day)) return null
  const { x, z } = MARKET_SITE
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]} rotation-y={0.4}>
      {/* 기둥 네 개와 줄무늬 차양. 차양은 앞으로 당겨 뒤에 선 상인의 머리를 가리지 않게 한다. */}
      {[-0.9, 0.9].map((px) =>
        [-0.5, 0.5].map((pz) => (
          <Part key={`${px}-${pz}`} color="#8c5a3c" position={[px, 1.225, pz]} outline={0.06}>
            <cylinderGeometry args={[0.05, 0.05, 2.45, 6]} />
          </Part>
        )),
      )}
      {Array.from({ length: 6 }, (_, i) => (
        <Part key={i} color={i % 2 ? '#fff6e3' : '#f2a541'} position={[-1.125 + i * 0.45, 2.45, 0.4]} outline={0.05}>
          <boxGeometry args={[0.45, 0.08, 1]} />
        </Part>
      ))}
      {/* 좌판과 물건 몇 개 */}
      <Part color="#b9864f" position={[0, 0.5, 0.2]} outline={0.06}>
        <boxGeometry args={[1.9, 0.9, 0.5]} />
      </Part>
      <Part color="#f4e4c1" position={[0, 1.02, 0.2]} outline={0.04}>
        <boxGeometry args={[1.9, 0.06, 0.6]} />
      </Part>
      <Part color="#ffd166" position={[-0.5, 1.12, 0.2]} outline={0.05}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </Part>
      <Part color="#9ad0ec" position={[0.4, 1.12, 0.15]} outline={0.05}>
        <boxGeometry args={[0.24, 0.16, 0.24]} />
      </Part>
      {/* 간판 */}
      <Part color="#8c5a3c" position={[0, 2.25, -0.5]} outline={0.05}>
        <boxGeometry args={[1.3, 0.35, 0.08]} />
      </Part>
      <Merchant />
    </group>
  )
}

/** 떠돌이 고슴도치 밤송이. 가판대 뒤에 서서 손님을 맞는다. 가시와 등짐이 있다. */
const MERCHANT_LOOK: Look = { skin: '#d9a878', outfit: '#7a8f5a', ears: 'round', spikes: '#6b4a2b', snout: '#3b2a20', hair: '#6b4a2b' }

/** 상인이 선 궤짝 높이. 카운터 윗면(1.02) 위로 머리가 나온다. */
const MERCHANT_LIFT = 0.34

/** 가판대 뒤의 상인. 장날에만 세우고 제자리에서 가볍게 숨 쉰다. */
export function Merchant() {
  const day = useGame((s) => s.day)
  const motion = useRef<Motion>({ moving: false, pace: 0.5, talking: false, hype: 0 })
  if (!MARKET_SITE || !isMarketDay(day)) return null
  return (
    // 가판대 로컬 좌표에서 카운터 뒤쪽(-z)에 선다. 차양 뒤 끝(-0.7)보다 더 뒤에 서야 장터 카메라에서 머리가 차양에 가려지지 않는다. 몸은 손님(+z) 쪽을 본다.
    <group position={[0, 0, -1.05]}>
      {/* 발판 궤짝: 머리와 등짐이 카운터 윗면 위로 나오도록 몸을 올린다 */}
      <Part color="#a77a48" position={[0, 0.17, 0]} outline={0.05}>
        <boxGeometry args={[0.7, 0.34, 0.5]} />
      </Part>
      <group position={[0, MERCHANT_LIFT, 0]}>
        <Chibi look={MERCHANT_LOOK} motion={() => motion.current} seed={7}>
          {/* 등짐: 등 뒤에 크게 멘 배낭 */}
          <Part color="#8c5a3c" position={[0, 0.55, -0.42]} outline={0.07}>
            <boxGeometry args={[0.55, 0.62, 0.32]} />
          </Part>
          <Part color="#c9a06a" position={[0, 0.9, -0.42]} outline={0.05}>
            <boxGeometry args={[0.4, 0.12, 0.3]} />
          </Part>
        </Chibi>
      </group>
    </group>
  )
}
