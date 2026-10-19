import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { heightAt } from '../core/island'
import { GLOWING } from '../core/items'
import { OUTDOOR_LAMP_SLOTS, pickLampSlots, type LampCandidate } from '../core/lampSlots'
import { festivalOn, SUMMER_LANTERNS } from '../core/festivals'
import { MARKET_SITE } from '../core/market'
import type { Placed } from '../core/placement'
import { isIndoor } from '../game/indoor'
import { useGame } from '../game/store'
import { GIFT_PROJECTS_2 } from '../core/islandGift'
import { LAMP_LINE_X } from './IslandGifts'

const LAMP_COLOR = '#ffcf8a'
const LAMP_INTENSITY = 3
const LAMP_DISTANCE = 6
/** 배정이 바뀔 때 세기를 줄였다 올리는 시간(초). 짧아서 빛이 깜빡이기 전에 끝난다. */
export const LAMP_FADE_SECONDS = 0.2

interface Source {
  id: string
  x: number
  z: number
}

/** 바깥의 켜진 등 자리: 놓은 등(꺼 두지 않은 것), 여름 축제 등불 두 개, 2차 등대 산책로 가로등 줄 */
function sourcesOf(placed: readonly Placed[], day: string | null, acornBuilt: number): Source[] {
  const out: Source[] = placed.filter((p) => GLOWING.has(p.itemId) && !p.off).map((p) => ({ id: p.id, x: p.x, z: p.z }))
  const fest = day ? festivalOn(day) : null
  const site = MARKET_SITE
  if (site && fest?.season === 'summer') SUMMER_LANTERNS.forEach((o, i) => out.push({ id: `fest${i}`, x: site.x + o.x, z: site.z + o.z }))
  // 가로등 줄이 완성됐으면 네 등을 같은 바닥 빛 방식으로 비춘다(새 광원은 만들지 않고 기존 슬롯만 쓴다)
  if (acornBuilt >= 1) {
    const a = GIFT_PROJECTS_2[0].anchor
    // 가운데 두 등은 양 끝 등의 빛에 묻히므로 바닥 빛 자리는 양 끝 두 개만 쓴다(빛이 한데 겹쳐 너무 밝아지지 않게)
    LAMP_LINE_X.filter((_, i) => i === 0 || i === LAMP_LINE_X.length - 1).forEach((dx, i) => out.push({ id: `gift-lamp${i}`, x: a.x + dx, z: a.z }))
  }
  return out
}

interface Slot {
  /** 지금 배정된 등 */
  id: string | null
  /** 실제로 빛이 놓인 등(페이드 중에는 아직 옛 등일 수 있다) */
  shown: string | null
  level: number
}

/**
 * 바깥 섬의 켜진 등 빛. 실제 점광원은 OUTDOOR_LAMP_SLOTS 개만 두고, 카메라에 가장 가까운 등에 배정한다.
 * 배정이 바뀌면 옛 자리의 빛을 LAMP_FADE_SECONDS 동안 줄여 0으로 만든 뒤 새 자리로 옮겨 다시 올린다.
 * 나머지 등은 발광 재질(FurnitureModel 의 night)만으로 빛난다. 밤이 아니거나 실내면 세기를 0으로 둔다.
 */
export function OutdoorLampPool({ placed }: { placed: readonly Placed[] }) {
  const camera = useThree((s) => s.camera)
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const slots = useRef<Slot[]>(Array.from({ length: OUTDOOR_LAMP_SLOTS }, () => ({ id: null, shown: null, level: 0 })))
  const picked = useRef<(string | null)[]>(Array.from({ length: OUTDOOR_LAMP_SLOTS }, () => null))
  // 자리 목록은 놓은 등·날짜·가로등 줄이 바뀔 때만 다시 만든다(매 프레임 새로 만들지 않는다)
  const day = useGame((s) => s.day)
  const acornBuilt = useGame((s) => s.islandAcorn?.built ?? 0)
  const list = useMemo(() => sourcesOf(placed, day, acornBuilt), [placed, day, acornBuilt])
  const latestList = useRef(list)
  latestList.current = list
  useFrame((_, dt) => {
    const st = useGame.getState()
    const indoor = isIndoor(st)
    const on = st.night && !indoor
    // 실내에서는 배정을 다시 고르지 않는다. 빛 세기만 0 쪽으로 줄여 실내에 등빛이 남지 않게 한다.
    if (!indoor) {
      const cands: LampCandidate[] = latestList.current.map((p) => ({ id: p.id, d2: (p.x - camera.position.x) ** 2 + (p.z - camera.position.z) ** 2 }))
      picked.current = pickLampSlots(cands, picked.current)
    }
    const shown = latestList.current
    const step = (dt > 0.05 ? 0.05 : dt) / LAMP_FADE_SECONDS
    for (let k = 0; k < OUTDOOR_LAMP_SLOTS; k++) {
      const slot = slots.current[k]
      const l = lights.current[k]
      const want = picked.current[k]
      // 배정이 바뀌었으면 먼저 끄고, 꺼진 뒤에 새 자리로 옮긴다
      if (want !== slot.id) slot.id = want
      if (slot.id !== slot.shown && slot.level <= 0) slot.shown = slot.id
      const p = slot.shown === null ? undefined : shown.find((x) => x.id === slot.shown)
      const goal = on && p && slot.shown === slot.id ? LAMP_INTENSITY : 0
      slot.level += Math.max(-step * LAMP_INTENSITY, Math.min(step * LAMP_INTENSITY, goal - slot.level))
      if (!l) continue
      if (p) l.position.set(p.x, heightAt(p.x, p.z) + 1.2, p.z)
      l.intensity = slot.level
    }
  })
  return (
    <>
      {Array.from({ length: OUTDOOR_LAMP_SLOTS }, (_, k) => (
        <pointLight key={k} ref={(el) => { lights.current[k] = el }} color={LAMP_COLOR} intensity={0} distance={LAMP_DISTANCE} decay={1.5} />
      ))}
    </>
  )
}
