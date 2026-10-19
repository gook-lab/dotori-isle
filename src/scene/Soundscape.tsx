import { isIndoor } from '../game/indoor'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { currentHour } from '../core/clock'
import { FALLS_AT, islandDist, nearWaters } from '../core/island'
import { streamDist } from '../core/waters'
import { MUSEUM_ROOM, roomCenter } from '../core/interior'
import { museumLayout } from '../core/museum'
import { proximity } from '../core/soundscape'
import { weatherFor } from '../core/weather'
import { windLevel } from '../core/wind'
import { bubbleLevel, startAmbience, updateAmbience } from '../game/ambience'
import { runtime } from '../game/runtime'
import { useGame } from '../game/store'

/** 배경음악과 환경음을 플레이어 위치·시각·날씨에 맞춰 이어 준다. 화면에는 아무것도 그리지 않는다. */
export function Soundscape() {
  useEffect(() => {
    // 브라우저는 첫 입력 전에는 소리를 막으니 그때 켠다.
    const start = () => startAmbience()
    window.addEventListener('pointerdown', start)
    window.addEventListener('keydown', start)
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
  }, [])
  useFrame(() => {
    const s = useGame.getState()
    const p = runtime.player
    const d = islandDist(p.x, p.z)
    const indoor = isIndoor(s)
    const out = !indoor && nearWaters(p.x, p.z)
    // 전시관 안: 가장 가까운 수조까지의 거리로 거품 세기를 정한다
    let bubble = 0
    if (s.inMuseum) {
      const c = roomCenter(MUSEUM_ROOM)
      const tanks = museumLayout(s.museum).tanks
      const d = tanks.reduce((m, t) => Math.min(m, Math.hypot(p.x - (c.x + t.x), p.z - (c.z + t.z))), Infinity)
      bubble = bubbleLevel(d)
    }
    updateAmbience({
      museum: s.inMuseum,
      bubble,
      hour: currentHour(),
      shore: indoor ? 0 : Math.max(0, Math.min(1, (d - 0.7) / 0.3)),
      weather: weatherFor(s.day),
      wind: windLevel(s.day),
      indoor,
      cave: s.inCave,
      brook: out ? proximity(streamDist(p.x, p.z).d - 1, 8) : 0,
      falls: out ? proximity(Math.hypot(p.x - FALLS_AT.x, p.z - FALLS_AT.z) - 1, 13) : 0,
    })
  })
  return null
}
