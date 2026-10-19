import { currentHour } from '../core/clock'
import { GLOWING } from '../core/items'
import { VILLAGERS } from '../core/villagers'
import { interiorLight, type InteriorLight } from '../core/interiorLight'
import { useGame } from '../game/store'

/**
 * 지금 실내 밝기. 실내에 있을 때만 값이 있고, 밖이면 null 이다.
 * Sky 가 매 프레임 채우고, 방 안의 창과 천장 전구가 이 값을 읽는다(store 를 거치지 않아 저장과 무관하다).
 */
export const interiorMood: { current: InteriorLight | null } = { current: null }

/** 지금 방에서 켜 둔 등 수. 집은 이 층의 불빛 가구, 주민 집은 켜 둔 선물 등이다. */
function lampsNow(): number {
  const s = useGame.getState()
  if (s.inHome) return s.homeFurniture.filter((p) => (p.floor ?? 0) === s.homeFloor && GLOWING.has(p.itemId) && !p.off).length
  const v = VILLAGERS.find((x) => x.id === s.inside)
  if (v) return v.gifts.filter((g, k) => GLOWING.has(g) && !s.roomLampsOff.includes(`${v.id}/gift${k}`)).length
  return 0
}

/** 실내에 있을 때 Sky 에서 부른다. 밖이면 null 을 돌려준다. */
export function updateInteriorMood(): InteriorLight | null {
  const s = useGame.getState()
  const indoor = s.inHome || s.inside !== null
  interiorMood.current = indoor ? interiorLight(currentHour(), lampsNow()) : null
  return interiorMood.current
}
