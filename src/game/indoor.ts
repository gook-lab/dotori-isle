/**
 * 실내 판단을 한 곳에 모은다. 바깥 섬과 실내(집·전시관·마을회관·동굴·상점)를 나누는 기준은 여기서만 정한다.
 * 새 실내를 만들면 IndoorFlags 에 플래그를 더하고 indoorKind 에 한 줄 넣는다.
 */

export type IndoorKind = 'inside' | 'home' | 'museum' | 'hall' | 'cave' | 'shop'

/** 실내 여부를 가리는 플래그. 게임 상태가 이 모양을 그대로 갖는다. */
export interface IndoorFlags {
  inside: string | null
  inHome: boolean
  inMuseum: boolean
  inHall: boolean
  inCave: boolean
  inShop?: boolean
}

/** 지금 어느 실내에 있는지. 바깥이면 null. 한 번에 한 실내만 열리므로 먼저 적힌 쪽을 쓴다. */
export function indoorKind(s: IndoorFlags): IndoorKind | null {
  if (s.inside !== null) return 'inside'
  if (s.inHome) return 'home'
  if (s.inMuseum) return 'museum'
  if (s.inHall) return 'hall'
  if (s.inCave) return 'cave'
  if (s.inShop) return 'shop'
  return null
}

/** 실내에 있으면 true. 바깥 섬의 소리·날씨·하늘·발견거리 판단이 여기에 기댄다. */
export const isIndoor = (s: IndoorFlags): boolean => indoorKind(s) !== null
