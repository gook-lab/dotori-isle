import { useMemo, useRef } from 'react'
import { currentHour } from '../core/clock'
import { groundAt, heightAt } from '../core/island'
import { firstSnowHelpers, isFirstSnowDay } from '../core/firstSnow'
import { snowmanBuilder, snowmanScale } from '../core/weatherLife'
import { weatherFor } from '../core/weather'
import { presentVillagers } from '../game/actions'
import { useGame } from '../game/store'
import { Chibi, type Motion, type Pose } from './Chibi'
import { Part, Toon } from './toon'
import { lookOf } from './Villagers'
import { VILLAGERS } from '../core/villagers'

/** 눈 오는 날 하루에 한 번, 주민 한 명이 눈사람을 만든다. 아침엔 작고 저녁엔 다 커 있다. */
export function Snowman() {
  const day = useGame((s) => s.day)
  const houses = useGame((s) => s.houses)
  const tripGuests = useGame((s) => s.tripGuests)
  const snowy = weatherFor(day) === 'snow'
  const spot = useMemo(
    () => (snowy ? snowmanBuilder(day, presentVillagers(houses, tripGuests).map((v) => v.id), (x, z) => groundAt(x, z) === 'grass') : null),
    [day, snowy, houses, tripGuests],
  )
  const motion = useRef<Motion>({ moving: false, pace: 1, talking: false })
  const pose: Pose = { lean: 0.45, armL: -1.2, armR: -1.2 }
  if (!spot) return null
  const who = VILLAGERS.find((v) => v.id === spot.villagerId)
  if (!who) return null
  // 그 해 첫눈 날에는 두 주민이 더 와서 함께 만든다(자리는 눈사람 둘레)
  const firstSnow = isFirstSnowDay(day, weatherFor)
  const helpers = firstSnow ? firstSnowHelpers(day, presentVillagers(houses, tripGuests).map((v) => v.id), spot.villagerId) : []
  const progress = (currentHour() - 6) / 14
  const k = snowmanScale(progress)
  const bx = spot.x + 1.2
  return (
    <>
      <group position={[spot.x, heightAt(spot.x, spot.z), spot.z]} scale={k}>
        <Part color="#f7fbff" position={[0, 0.35, 0]} outline={0.05}>
          <sphereGeometry args={[0.38, 14, 10]} />
        </Part>
        <Part color="#f7fbff" position={[0, 0.9, 0]} outline={0.05}>
          <sphereGeometry args={[0.27, 12, 10]} />
        </Part>
        <Part color="#f7fbff" position={[0, 1.3, 0]} outline={0.05}>
          <sphereGeometry args={[0.2, 12, 10]} />
        </Part>
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 1.33, 0.18]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshBasicMaterial color="#2b2018" />
          </mesh>
        ))}
        <mesh position={[0, 1.27, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.14, 6]} />
          <Toon color="#ff9a3c" />
        </mesh>
      </group>
      <group position={[bx, heightAt(bx, spot.z), spot.z]} rotation-y={-Math.PI / 2}>
        <Chibi look={lookOf(spot.villagerId)} motion={() => motion.current} pose={() => pose} seed={0} />
      </group>
      {helpers.map((id, i) => {
        // 눈사람 쪽을 바라보며 둘레에 선다
        const pos = [{ x: spot.x - 1.1, z: spot.z + 0.8 }, { x: spot.x + 0.5, z: spot.z - 1.2 }][i]
        if (!pos) return null
        return <SnowHelper key={id} id={id} x={pos.x} z={pos.z} target={spot} pose={pose} seed={i + 1} />
      })}
    </>
  )
}

/** 첫눈 날 눈사람을 함께 만드는 주민 한 명. 눈사람 쪽을 보고 선다. */
function SnowHelper({ id, x, z, target, pose, seed }: { id: string; x: number; z: number; target: { x: number; z: number }; pose: Pose; seed: number }) {
  const motion = useRef<Motion>({ moving: false, pace: 1, talking: false })
  return (
    <group position={[x, heightAt(x, z), z]} rotation-y={Math.atan2(target.x - x, target.z - z)}>
      <Chibi look={lookOf(id)} motion={() => motion.current} pose={() => pose} seed={seed} />
    </group>
  )
}
