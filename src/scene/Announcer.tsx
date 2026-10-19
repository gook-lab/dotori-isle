import { useEffect, useRef, useState } from 'react'
import { heightAt } from '../core/island'
import { currentHour } from '../core/clock'
import { announcerSpot, tourneyWindow } from '../core/tourney'
import { useGame } from '../game/store'
import { Chibi, type Look, type Motion } from './Chibi'
import { Part } from './toon'

const ANNOUNCER_LOOK: Look = { skin: '#f2c9a0', outfit: '#2f6f9f', ears: 'round', hair: '#3b2a20', spikes: '#3b2a20', snout: '#3b2a20' }

/** 낚시 대회 진행자. 일요일 9시부터 6시 전까지 광장에 서서 대회 이야기를 한다. 밖에서는 보이지 않는다. */
export function Announcer() {
  const day = useGame((s) => s.day)
  const [open, setOpen] = useState(() => tourneyWindow(day, currentHour()))
  useEffect(() => setOpen(tourneyWindow(day, currentHour())), [day])
  // 시간이 바뀌는 것을 15초마다 본다(정각에 맞춰 나타나고 사라진다)
  useEffect(() => {
    const id = setInterval(() => setOpen(tourneyWindow(useGame.getState().day, currentHour())), 15_000)
    return () => clearInterval(id)
  }, [])
  const motion = useRef<Motion>({ moving: false, pace: 0.5, talking: false, hype: 0 })
  const spot = announcerSpot()
  if (!spot || !open) return null
  return (
    <group position={[spot.x, heightAt(spot.x, spot.z), spot.z]}>
      {/* 나무 연단: 위에 낚싯대 모양 깃대를 세운다 */}
      <Part color="#a77a48" position={[0, 0.2, 0]} outline={0.05}>
        <boxGeometry args={[0.8, 0.4, 0.6]} />
      </Part>
      <group position={[0, 0.4, 0]}>
        <Chibi look={ANNOUNCER_LOOK} motion={() => motion.current} seed={21} />
      </group>
    </group>
  )
}
